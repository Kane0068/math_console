import { auth } from './firebase.js'; 
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { FirestoreManager } from "./firestore.js";


export const AuthManager = {
    // Google ile giriş fonksiyonu
    signInWithGoogle: async function() {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            // Google ile giriş yapan kullanıcının verisini Firestore'da oluştur/kontrol et
            await FirestoreManager.createUserData(user);
            window.location.href = 'index.html'; // Giriş sonrası ana sayfaya yönlendir
        } catch (error) {
            console.error("Google ile giriş hatası:", error);
            // Kullanıcıya bir hata mesajı gösterebilirsiniz.
            alert("Google ile giriş yapılamadı. Lütfen tekrar deneyin.");
        }
    },

    // Şifre sıfırlama fonksiyonu
    sendPasswordReset: async function(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true, message: 'Sıfırlama linki e-posta adresinize gönderildi!' };
        } catch (error) {
            console.error("Şifre sıfırlama hatası:", error);
            if (error.code === 'auth/user-not-found') {
                return { success: false, message: 'Bu e-posta adresi ile kayıtlı bir kullanıcı bulunamadı.' };
            }
            return { success: false, message: 'Bir hata oluştu. Lütfen tekrar deneyin.' };
        }
    },

    initProtectedPage: function(onSuccess) {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = 'login.html';
            } else {
                const userData = await FirestoreManager.getUserData(user);
                if (onSuccess) {
                    onSuccess(userData);
                }
            }
        });
    },

    initPublicPage: function() {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                window.location.href = 'index.html';
            }
        });
    },

    logout: function() {
        signOut(auth).then(() => {
            window.location.href = "login.html";
        }).catch((error) => {
            console.error('Logout error:', error);
            window.location.href = "login.html";
        });
    }
};

export { auth };