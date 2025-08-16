// www/js/pages/profile.js - YENİ PREMIUM SİSTEM ENTEGRASYONU İLE NİHAİ VERSİYON

import { AuthManager, auth } from '../modules/auth.js';
import { FirestoreManager } from '../modules/firestore.js';
import { getSubscriptionPlan } from '../modules/purchaseManager.js';

// Gerekli HTML elementlerini seç
const nameEl = document.getElementById('display-name');
const emailEl = document.getElementById('display-email');
const membershipEl = document.getElementById('display-membership');
const upgradeSection = document.getElementById('upgrade-section');
const logoutBtn = document.getElementById('logout-btn');
const changePasswordBtn = document.getElementById('change-password-btn');

// Profil fotoğrafı elementleri
const profilePhotoContainer = document.getElementById('profile-photo-container');
const profilePhoto = document.getElementById('profile-photo');
const profileInitials = document.getElementById('profile-initials');
const changePhotoBtn = document.getElementById('change-photo-btn');
const photoInput = document.getElementById('photo-input');

// Premium sistem elementleri
const premiumStatusContainer = document.getElementById('premium-status-container');
const planDetailsContainer = document.getElementById('plan-details-container');
const tokenStatusContainer = document.getElementById('token-status-container');

function fillProfileData(userData) {
    if (!userData) {
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
    
    // Profil fotoğrafını yükle
    loadProfilePhoto(userData);
    
    // YENİ PREMIUM SİSTEM ENTEGRASYONU
    updatePremiumStatus(userData);
    
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
        const freePlan = getSubscriptionPlan('free');
        membershipEl.textContent = freePlan.name;
        membershipEl.className = 'font-bold text-gray-800 px-3 py-1 bg-gray-200 rounded-full text-xs';
        upgradeSection.classList.remove('hidden');
        
        // Ücretsiz kullanıcı için aylık sorgu hakkını göster
        monthlyQueriesContainer.classList.remove('hidden');
        const remainingMonthly = freePlan.monthlyTokens - (userData.monthlyQueryCount || 0);
        monthlyQueriesEl.textContent = `${remainingMonthly} / ${freePlan.monthlyTokens}`;
        expiryContainer.classList.add('hidden');
    } 
    // DURUM 2: Kullanıcı premium planda
    else {
        const plan = getSubscriptionPlan(sub.tier);
        membershipEl.textContent = plan.name;
        membershipEl.className = 'font-bold text-purple-800 px-3 py-1 bg-purple-200 rounded-full text-xs';
        upgradeSection.classList.add('hidden');

        // Aylık hakları ve bitiş tarihini göster
        monthlyQueriesContainer.classList.remove('hidden');
        const remainingMonthly = plan.monthlyTokens - (userData.monthlyQueryCount || 0);
        monthlyQueriesEl.textContent = `${remainingMonthly} / ${plan.monthlyTokens}`;

        if (sub.expiresDate) {
            const expiryDate = sub.expiresDate.toDate ? sub.expiresDate.toDate() : new Date(sub.expiresDate);
            expiryContainer.classList.remove('hidden');
            expiryEl.textContent = expiryDate.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
}

/**
 * YENİ: Premium durum bilgilerini günceller
 */
function updatePremiumStatus(userData) {
    if (!premiumStatusContainer) return;
    
    const sub = userData.subscription || { tier: 'free' };
    const plan = getSubscriptionPlan(sub.tier);
    const monthlyQueryCount = userData.monthlyQueryCount || 0;
    const tokenQueries = userData.tokenQueries || 0;
    
    // Premium durum kartı
    premiumStatusContainer.innerHTML = `
        <div class="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-purple-800">${plan.name}</h3>
                <span class="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    ${sub.tier === 'free' ? 'Ücretsiz' : 'Premium'}
                </span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-600">${plan.monthlyTokens}</div>
                    <div class="text-sm text-gray-600">Aylık Jeton</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600">${plan.monthlyTokens - monthlyQueryCount}</div>
                    <div class="text-sm text-gray-600">Kalan Hak</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${tokenQueries}</div>
                    <div class="text-sm text-gray-600">Jeton Paketi</div>
                </div>
            </div>
            
            ${sub.tier === 'free' ? `
                <div class="text-center">
                    <a href="premium.html" class="inline-block bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors">
                        Premium'a Geç
                    </a>
                </div>
            ` : ''}
        </div>
    `;
    
    // Plan detayları
    if (planDetailsContainer) {
        planDetailsContainer.innerHTML = `
            <div class="bg-white p-4 rounded-lg border border-gray-200">
                <h4 class="font-semibold text-gray-800 mb-3">Plan Özellikleri</h4>
                <ul class="space-y-2">
                    ${plan.features.map(feature => `
                        <li class="flex items-center text-sm text-gray-600">
                            <span class="text-green-500 mr-2">✓</span>
                            ${feature}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    // Jeton durumu
    if (tokenStatusContainer && tokenQueries > 0) {
        tokenStatusContainer.innerHTML = `
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 class="font-semibold text-blue-800 mb-2">Jeton Durumu</h4>
                <div class="flex items-center justify-between">
                    <span class="text-blue-600">${tokenQueries} jeton kullanılabilir</span>
                    <a href="premium.html" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Daha Fazla Al →
                    </a>
                </div>
            </div>
        `;
    }
}

/**
 * Profil fotoğrafını yükler ve gösterir
 */
function loadProfilePhoto(userData) {
    if (userData.profilePhoto) {
        profilePhoto.src = userData.profilePhoto;
        profilePhoto.classList.remove('hidden');
        profileInitials.classList.add('hidden');
    } else {
        profilePhoto.classList.add('hidden');
        profileInitials.classList.remove('hidden');
        
        const displayName = userData.displayName || 'K';
        const initials = displayName.split(' ').map(name => name.charAt(0)).join('').toUpperCase();
        profileInitials.textContent = initials || 'K';
    }
}

/**
 * Profil fotoğrafını günceller
 */
async function updateProfilePhoto(file) {
    try {
        if (file.size > 5 * 1024 * 1024) {
            alert('Fotoğraf boyutu 5MB\'dan küçük olmalıdır.');
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('Lütfen geçerli bir resim dosyası seçin.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(e) {
            const photoDataUrl = e.target.result;
            
            const user = auth.currentUser;
            if (user) {
                await FirestoreManager.updateUserField(user.uid, 'profilePhoto', photoDataUrl);
                
                profilePhoto.src = photoDataUrl;
                profilePhoto.classList.remove('hidden');
                profileInitials.classList.add('hidden');
                
                localStorage.setItem('userProfilePhoto', photoDataUrl);
                
                alert('Profil fotoğrafınız başarıyla güncellendi!');
            }
        };
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('Profil fotoğrafı güncellenirken hata:', error);
        alert('Fotoğraf güncellenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

// --- OLAY DİNLEYİCİLERİ ---

window.addEventListener('load', () => {
    AuthManager.initProtectedPage(fillProfileData);
});

logoutBtn.addEventListener('click', () => {
    AuthManager.logout();
});

changePasswordBtn.addEventListener('click', async () => {
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

changePhotoBtn.addEventListener('click', () => {
    photoInput.click();
});

profilePhotoContainer.addEventListener('click', () => {
    photoInput.click();
});

photoInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        updateProfilePhoto(file);
    }
});