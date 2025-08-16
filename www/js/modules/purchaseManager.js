// www/js/modules/purchaseManager.js - ORTAM BİLİNÇLİ VE NİHAİ VERSİYON

// SORUNLU IMPORT SATIRINI SİLİYORUZ
// import { Purchases } from '@revenuecat/purchases-capacitor';

// --- Ortam Kontrolü ---
const isNativePlatform = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
let Purchases;

if (isNativePlatform) {
    // Sadece native platformda Purchases eklentisini Capacitor'un global nesnesinden alıyoruz.
    ({ Purchases } = Capacitor.Plugins);
}
// --------------------

// --- AYARLAR ---
// RevenueCat panelinden -> API Keys -> Public API Keys -> Google
const REVENUECAT_API_KEY = 'YOUR_REVENUECAT_GOOGLE_API_KEY';

// --- Web Tarayıcısı için Mock (Taklit) Satın Alma Yöneticisi ---
const mockPurchaseManager = {
    isInitialized: false,
    async initialize(userId) {
        console.log(`PURCHASE MOCK: Tarayıcıda çalışılıyor, RevenueCat başlatıldı (simülasyon) - Kullanıcı: ${userId}`);
        this.isInitialized = true;
    },
    async getOfferings() {
        console.log('PURCHASE MOCK: Sahte teklifler getiriliyor...');
        // Gerçek uygulamadakine benzer sahte paketler döndür
        return [
            { product: { identifier: 'premium_basic', priceString: '150 TL' } },
            { product: { identifier: 'premium_full', priceString: '350 TL' } }
        ];
    },
    async purchasePackage(packageToPurchase) {
        console.log(`PURCHASE MOCK: "${packageToPurchase.product.identifier}" paketi satın alınıyor (simülasyon)...`);
        // Simülasyon: Kullanıcının satın almayı onayladığını varsayalım
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniyelik gecikme
        console.log('PURCHASE MOCK: Satın alma başarılı (simülasyon).');
        // Başarılı bir satın alma sonrası beklenen sonucu döndür
        return {
            tier: packageToPurchase.product.identifier,
            expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 gün sonrası
        };
    },
    async checkSubscription() {
        console.log('PURCHASE MOCK: Abonelik durumu kontrol ediliyor (simülasyon).');
        return { tier: 'free' }; // Tarayıcıda her zaman ücretsiz başla
    }
};

// --- Gerçek Native Satın Alma Yöneticisi ---
const nativePurchaseManager = {
    // ... (Bu kısım bir önceki adımdaki nativePurchaseManager ile tamamen aynı olacak,
    // sadece Purchases'ı import etmek yerine globalden alacak şekilde düzenlendi.
    // Hiçbir değişiklik yapmanıza gerek yok, kopyalayıp yapıştırın.)
    isInitialized: false,
    async initialize(userId) {
        if (!userId || !Purchases) return;
        try {
            await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
            await Purchases.logIn(userId);
            console.log(`✅ RevenueCat (Native) başlatıldı.`);
            this.isInitialized = true;
        } catch (error) {
            console.error('❌ RevenueCat (Native) başlatma hatası:', error);
        }
    },
    async getOfferings() {
        if (!this.isInitialized) return null;
        try {
            const offerings = await Purchases.getOfferings();
            return offerings.current?.availablePackages || [];
        } catch (error) {
            console.error('❌ (Native) Teklifler alınamadı:', error);
            return null;
        }
    },
    async purchasePackage(packageToPurchase) {
        if (!this.isInitialized) return { success: false, message: 'Satın alma sistemi başlatılmadı.' };
        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });
            console.log(`(Native) Satın alma başarılı.`);
            return this.checkSubscription(customerInfo);
        } catch (error) {
            if (error.userCancelled) {
                console.log('(Native) Kullanıcı satın almayı iptal etti.');
                return { success: false, userCancelled: true };
            }
            console.error('❌ (Native) Satın alma hatası:', error);
            return { success: false, message: 'Satın alma sırasında bir hata oluştu.' };
        }
    },
    async checkSubscription(customerInfo = null) {
        if (!this.isInitialized) return { tier: 'free' };
        try {
            const info = customerInfo || await Purchases.getCustomerInfo();
            if (info.entitlements.active['full_access']) {
                return { tier: 'premium_full', expiresDate: info.entitleishments.active['full_access'].expirationDate };
            }
            if (info.entitlements.active['basic_access']) {
                return { tier: 'premium_basic', expiresDate: info.entitlements.active['basic_access'].expirationDate };
            }
            return { tier: 'free' };
        } catch (error) {
            console.error("(Native) Üyelik durumu kontrol edilemedi:", error);
            return { tier: 'free', error: true };
        }
    }
};

// Ortama göre doğru yöneticiyi dışa aktar
export const purchaseManager = isNativePlatform ? nativePurchaseManager : mockPurchaseManager;