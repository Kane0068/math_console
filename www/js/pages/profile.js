// www/js/pages/profile.js - HATASI GİDERİLMİŞ NİHAİ VERSİYON

import { AuthManager, auth } from '../modules/auth.js'; // <-- DÜZELTME 1: 'auth' nesnesini de import et

// Gerekli HTML elementlerini seç
const nameEl = document.getElementById('display-name');
const emailEl = document.getElementById('display-email');
const membershipEl = document.getElementById('display-membership');
const upgradeSection = document.getElementById('upgrade-section');
const logoutBtn = document.getElementById('logout-btn');
const changePasswordBtn = document.getElementById('change-password-btn');

// www/js/pages/profile.js -> fillProfileData için NİHAİ ve EKSİKSİZ VERSİYON

function fillProfileData(userData) {
    if (!userData) {
        // Bu durum normalde AuthManager tarafından engellenir.
        nameEl.textContent = "Veri bulunamadı.";
        emailEl.textContent = "Veri bulunamadı.";
        return;
    }

    // Gerekli tüm elementleri seç
    const dailyQueriesEl = document.getElementById('display-daily-queries');
    const tokenQueriesContainer = document.getElementById('token-queries-container');
    const tokenQueriesEl = document.getElementById('display-token-queries');
    const monthlyQueriesContainer = document.getElementById('monthly-queries-container');
    const monthlyQueriesEl = document.getElementById('display-monthly-queries');
    const expiryContainer = document.getElementById('expiry-container');
    const expiryEl = document.getElementById('display-expiry');

    // Temel bilgileri doldur
    nameEl.textContent = userData.displayName || 'İsimsiz';
    emailEl.textContent = userData.email;
    dailyQueriesEl.textContent = `${userData.dailyQueryCount || 0} / 3`;
    
    // Jetonları göster (varsa)
    const hasTokens = userData.tokenQueries > 0;
    if (hasTokens) {
        tokenQueriesContainer.classList.remove('hidden');
        tokenQueriesEl.textContent = userData.tokenQueries;
    } else {
        tokenQueriesContainer.classList.add('hidden');
    }

    const sub = userData.subscription || { tier: 'free' };
    
    // DURUM 1: Kullanıcı ücretsiz planda
    if (sub.tier === 'free') {
        membershipEl.textContent = 'Standart Üye';
        membershipEl.className = 'font-bold text-gray-800 px-3 py-1 bg-gray-200 rounded-full text-xs';
        upgradeSection.classList.remove('hidden');
        // Ücretsiz kullanıcı için aylık ve bitiş tarihi alanlarını gizle
        monthlyQueriesContainer.classList.add('hidden');
        expiryContainer.classList.add('hidden');
    } 
    // DURUM 2: Kullanıcı bir aboneliğe sahip
    else {
        if (sub.tier === 'premium_student') {
            membershipEl.textContent = 'Öğrenci Paketi';
        } else if (sub.tier === 'premium_pro') {
            membershipEl.textContent = 'Premium Paket';
        }
        membershipEl.className = 'font-bold text-purple-800 px-3 py-1 bg-purple-200 rounded-full text-xs';
        upgradeSection.classList.add('hidden');

        // Aylık hakları ve bitiş tarihini göster
        monthlyQueriesContainer.classList.remove('hidden');
        const remainingMonthly = (sub.monthlyQueryLimit || 0) - (sub.monthlyQueryCount || 0);
        monthlyQueriesEl.textContent = `${remainingMonthly} / ${sub.monthlyQueryLimit || 0}`;

        if (sub.expiresDate) {
            const expiryDate = sub.expiresDate.toDate(); // Firestore timestamp'ini Date objesine çevir
            expiryContainer.classList.remove('hidden');
            expiryEl.textContent = expiryDate.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
}

// --- OLAY DİNLEYİCİLERİ (EVENT LISTENERS) ---

// Sayfa yüklendiğinde, korumalı sayfa başlatıcısını çağır.
window.addEventListener('load', () => {
    AuthManager.initProtectedPage(fillProfileData);
});

// Çıkış yap butonuna olay dinleyici ekle.
logoutBtn.addEventListener('click', () => {
    AuthManager.logout();
});

// Şifre değiştirme butonu
changePasswordBtn.addEventListener('click', async () => {
    // DÜZELTME 2: 'auth' nesnesini doğrudan kullan
    const userEmail = auth.currentUser.email; 
    
    if (userEmail) {
        if (confirm(`'${userEmail}' adresine şifre sıfırlama linki göndermek istediğinizden emin misiniz?`)) {
            const result = await AuthManager.sendPasswordReset(userEmail);
            alert(result.message);
        }
    } else {
        alert("Kullanıcı e-posta adresi bulunamadı. Lütfen tekrar giriş yapın.");
    }
});