import { auth, db } from './firebase.js'; 
import { doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// Tüm Firestore veritabanı işlemlerini yöneten merkezi nesne.
export const FirestoreManager = {
    /**
     * Yeni bir kullanıcı için Firestore'da veri kaydı oluşturur.
     * @param {object} user - Firebase Auth'dan gelen kullanıcı nesnesi.
     * @param {object} additionalData - Kayıt formundan gelen ek veriler veya Google'dan gelen bilgiler.
     */
    async createUserData(user, additionalData = {}) {
        const userRef = doc(db, "users", user.uid);
        
        // Kullanıcının daha önce oluşturulup oluşturulmadığını kontrol et
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            console.log("Firestore: Mevcut kullanıcı, veri oluşturma atlandı.", user.uid);
            return docSnap.data();
        }

        const today = new Date();
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: additionalData.displayName || user.displayName || 'Kullanıcı',
            provider: user.providerData[0].providerId, // 'password', 'google.com' etc.
            
            // Ücretsiz Kullanıcı Limitleri
            dailyQueryCount: 3, // Herkese başlangıçta 3 hak veriyoruz.
            tokenQueries: 0,
            lastQueryDate: today.toISOString().split('T')[0], // YYYY-MM-DD formatı

            mistakeProfile: {}, // Kullanıcının uzun süreli hata geçmişi için boş bir nesne

            // Abonelik Bilgileri (Varsayılan olarak 'free')
            subscription: {
                tier: 'free',
                monthlyQueryLimit: 0,
                monthlyQueryCount: 0,
                lastMonthlyResetDate: today,
                expiresDate: null
            },
            
            createdAt: today
        };
        await setDoc(userRef, userData);
        console.log("Firestore: Kullanıcı verisi başarıyla oluşturuldu:", user.uid);
        return userData;
    },

    /**
     * Mevcut kullanıcının verilerini Firestore'dan çeker.
     * Günlük sorgu hakkını kontrol eder ve gerekirse sıfırlar.
     * @param {object} user - Firebase Auth'dan gelen kullanıcı nesnesi.
     * @returns {object|null} Kullanıcı verisi veya null.
     */
    async getUserData(user) {
        if (!user) {
            console.error("FirestoreManager: getUserData çağrıldı ama user nesnesi sağlanmadı!");
            return null;
        }

        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            console.error(`Firestore: Veri bulunamadı! UID: ${user.uid}.`);
            return null;
        }

        let userData = docSnap.data();
        const today = new Date().toISOString().split('T')[0];

        // Günlük sorgu sayısını sıfırlama mantığı
        if (userData.lastQueryDate !== today) {
            userData.dailyQueryCount = 0;
            userData.lastQueryDate = today;
            await updateDoc(userRef, {
                dailyQueryCount: 0,
                lastQueryDate: today
            });
            console.log("Firestore: Günlük sorgu hakkı sıfırlandı.");
        }

        return userData;
    },

    /**
     * Kullanıcının günlük sorgu sayısını artırır/azaltır.
     * @param {number} amount - Eklenecek veya çıkarılacak miktar (varsayılan: 1).
     * @returns {number|null} Yeni sorgu sayısı veya null.
     */
    async incrementQueryCount(amount = 1) {
        const user = auth.currentUser;
        if (!user) return null;
        
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return null;

        const currentCount = docSnap.data().dailyQueryCount || 0;
        const newCount = currentCount + amount;

        await updateDoc(userRef, { dailyQueryCount: newCount });
        console.log("Firestore: Sorgu sayısı güncellendi:", newCount);
        return newCount;
    },

    /**
     * Kullanıcının hata profilindeki belirli bir hata türünün sayısını artırır.
     * @param {string} mistakeType - Artırılacak hata türü (örn: 'Sign Error').
     */
    async incrementMistakeCount(mistakeType) {
        const user = auth.currentUser;
        if (!user || !mistakeType) return;

        const userRef = doc(db, "users", user.uid);
        
        // Firestore'un 'increment' özelliğini kullanarak atomik bir güncelleme yapıyoruz.
        // Bu, 'mistakeProfile.Sign Error' gibi bir alanı güvenli bir şekilde 1 artırır.
        // Eğer alan mevcut değilse, Firestore onu otomatik olarak 1 değeriyle oluşturur.
        const updatePayload = {
            [`mistakeProfile.${mistakeType}`]: increment(1)
        };

        try {
            await updateDoc(userRef, updatePayload);
            console.log(`Firestore: Kullanıcının hata profili güncellendi -> ${mistakeType}`);
        } catch (error) {
            console.error("Firestore hata profili güncelleme hatası:", error);
        }
    },
    async updateUserSubscription(tier, expiresDate) {
        const user = auth.currentUser;
        if (!user) throw new Error("Abonelik güncellemek için kullanıcı giriş yapmalı.");
        const userRef = doc(db, "users", user.uid);
        
        const limits = {
            premium_student: 100,
            premium_pro: 300,
            free: 0
        };

        const newSubscriptionData = {
            tier: tier,
            expiresDate: expiresDate ? new Date(expiresDate) : null,
            monthlyQueryLimit: limits[tier] || 0,
            monthlyQueryCount: 0,
            lastMonthlyResetDate: new Date(),
        };
        
        await updateDoc(userRef, { subscription: newSubscriptionData });
        console.log(`Firestore: Kullanıcı aboneliği güncellendi. Yeni Seviye: ${tier}`);
    },

    async addTokenQueries(amount) {
        const user = auth.currentUser;
        if (!user) throw new Error("Jeton eklemek için kullanıcı giriş yapmalı.");
        const userRef = doc(db, "users", user.uid);

        // Firestore'un artırma (increment) özelliğini kullanarak atomik bir şekilde ekleme yap
        await updateDoc(userRef, {
            tokenQueries: increment(amount)
        });
        console.log(`Firestore: Kullanıcıya ${amount} jeton eklendi.`);
    },

    /**
     * Kullanıcının üyelik tipini 'premium' olarak günceller.
     */
    async upgradeToPremium() {
        const user = auth.currentUser;
        if (!user) throw new Error("Önce giriş yapmalısınız.");

        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { membershipType: 'premium' });
        console.log("Firestore: Kullanıcı premium üyeliğe yükseltildi!");
    }
};
