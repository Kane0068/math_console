// www/js/pages/premium.js - YENİ FİYATLANDIRMA MODELİ İÇİN NİHAİ VERSİYON

import { AuthManager, auth } from '../modules/auth.js';
import { purchaseManager, getSubscriptionPlan, getTokenPackage, getAllPlans, getAllTokenPackages } from '../modules/purchaseManager.js';
import { FirestoreManager } from '../modules/firestore.js';

// Satın alınabilir paketleri global olarak saklayalım
let availablePackages = [];
let currentUser = null;

/**
 * Sayfadaki tüm satın alma butonlarının durumunu ayarlar.
 * @param {boolean} isLoading Yükleme durumunda mı?
 * @param {string|null} message Gösterilecek mesaj.
 */
function setButtonState(isLoading, message = null) {
    const buttons = document.querySelectorAll('.purchase-btn');
    buttons.forEach(button => {
        button.disabled = isLoading;
        if (isLoading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.textContent;
            }
            button.textContent = message || 'İşleniyor...';
        } else {
            button.textContent = button.dataset.originalText || 'Bu Planı Seç';
        }
    });
}

/**
 * Belirli bir ürünü (abonelik veya jeton) satın alma akışını yönetir.
 * @param {string} packageId - Satın alınacak paketin ID'si
 */
async function handlePurchase(packageId) {
    const selectedPackage = availablePackages.find(pkg => pkg.identifier === packageId);

    if (!selectedPackage) {
        showError("Seçilen paket şu anda mevcut değil. Lütfen sayfayı yenileyip tekrar deneyin.");
        return;
    }

    setButtonState(true, 'Satın alma başlatılıyor...');

    try {
        const result = await purchaseManager.purchasePackage(selectedPackage);

        if (result.userCancelled) {
            console.log('Kullanıcı satın almayı iptal etti.');
            setButtonState(false);
            return;
        }

        if (!result.success) {
            throw new Error(result.message || 'Satın alma başarısız oldu.');
        }

        // Satın almanın türüne göre işlem yap
        if (result.type === 'token') {
            setButtonState(true, 'Jetonlar hesabınıza ekleniyor...');
            
            // Firestore'a jeton ekle
            await FirestoreManager.addTokenQueries(result.tokens);
            
            showSuccess(`${result.tokens} jeton başarıyla eklendi!`);
            
            // 2 saniye sonra profile yönlendir
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 2000);
            
        } else if (result.type === 'subscription') {
            setButtonState(true, 'Aboneliğiniz doğrulanıyor...');
            
            // Firestore'daki abonelik verisini güncelle
            await FirestoreManager.updateUserSubscription(result.tier, result.expiresDate);
            
            showSuccess(`${getSubscriptionPlan(result.tier).name} aboneliği aktif edildi!`);
            
            // 2 saniye sonra profile yönlendir
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 2000);
        }

    } catch (error) {
        console.error('Satın alma hatası:', error);
        showError(`Satın alma sırasında bir hata oluştu: ${error.message}`);
        setButtonState(false);
    }
}

/**
 * Premium sayfasının ana arayüzünü oluşturur.
 */
function createPremiumInterface() {
    const container = document.getElementById('premium-container');
    if (!container) return;

    const plans = getAllPlans();
    const tokenPackages = getAllTokenPackages();

    let html = `
        <div class="max-w-6xl mx-auto px-4 py-8">
            <!-- Başlık Bölümü -->
            <div class="text-center mb-12">
                <h1 class="text-4xl font-bold text-gray-900 mb-4">Premium Matematik Asistanı</h1>
                <p class="text-xl text-gray-600">Sınırsız matematik çözümü ve kişisel rehberlik</p>
            </div>

            <!-- İlk Ay %50 İndirim Banner -->
            <div id="first-time-discount-banner" class="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-2xl mb-8 text-center hidden">
                <h3 class="text-2xl font-bold mb-2">🎉 İlk Ay %50 İndirim!</h3>
                <p class="text-lg">Yeni kullanıcılar için özel fırsat</p>
            </div>

            <!-- Abonelik Planları -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
    `;

    // Her plan için kart oluştur
    plans.forEach(plan => {
        if (plan.id === 'free') return; // Ücretsiz planı gösterme
        
        const isPopular = plan.id === 'pro';
        const popularBadge = isPopular ? '<span class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold">En Popüler</span>' : '';
        
        html += `
            <div class="relative bg-white rounded-2xl shadow-lg border-2 ${isPopular ? 'border-yellow-400' : 'border-gray-200'} p-6 hover:shadow-xl transition-shadow">
                ${popularBadge}
                <div class="text-center">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">${plan.name}</h3>
                    <div class="mb-6">
                        <span class="text-4xl font-bold text-purple-600">${plan.monthlyTokens}</span>
                        <span class="text-gray-600"> Jeton/Ay</span>
                    </div>
                    
                    <div class="space-y-3 mb-6 text-left">
                        ${plan.features.map(feature => `<div class="flex items-center"><span class="text-green-500 mr-2">✓</span>${feature}</div>`).join('')}
                    </div>
                    
                    <div class="mb-6">
                        <div class="text-3xl font-bold text-gray-900 mb-1">
                            ${plan.monthlyPrice ? `${plan.monthlyPrice} TL` : 'Ücretsiz'}
                        </div>
                        ${plan.yearlyPrice ? `<div class="text-sm text-gray-500">Yıllık: ${plan.yearlyPrice} TL</div>` : ''}
                    </div>
                    
                    <button class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors purchase-btn" 
                            data-plan-id="${plan.id}">
                        ${plan.id === 'free' ? 'Ücretsiz Başla' : 'Bu Planı Seç'}
                    </button>
                </div>
            </div>
        `;
    });

    html += `
            </div>

            <!-- Jeton Paketleri -->
            <div class="mb-12">
                <h2 class="text-3xl font-bold text-gray-900 text-center mb-8">Acil Durum Jeton Paketleri</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    `;

    // Her jeton paketi için kart oluştur
    tokenPackages.forEach(pkg => {
        html += `
            <div class="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div class="text-center">
                    <h3 class="text-xl font-bold text-gray-900 mb-2">${pkg.name}</h3>
                    <p class="text-gray-600 mb-4">${pkg.description}</p>
                    <div class="text-3xl font-bold text-blue-600 mb-4">${pkg.tokens} Jeton</div>
                    <div class="text-2xl font-bold text-gray-900 mb-6">${pkg.price} TL</div>
                    <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors purchase-btn" 
                            data-package-id="${pkg.id}">
                        Hemen Al
                    </button>
                </div>
            </div>
        `;
    });

    html += `
                </div>
            </div>

            <!-- SSS Bölümü -->
            <div class="bg-gray-50 rounded-2xl p-8">
                <h2 class="text-3xl font-bold text-gray-900 text-center mb-8">Sık Sorulan Sorular</h2>
                <div class="space-y-6">
                    <div class="border-b border-gray-200 pb-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">Jeton nedir ve nasıl kullanılır?</h3>
                        <p class="text-gray-600">Jeton, matematik sorusu çözme hakkınızı temsil eder. Her soru için 1 jeton kullanılır. Premium üyeler aylık jeton limitlerine sahiptir.</p>
                    </div>
                    <div class="border-b border-gray-200 pb-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">Aboneliğimi nasıl iptal edebilirim?</h3>
                        <p class="text-gray-600">Google Play Store üzerinden aboneliğinizi istediğiniz zaman iptal edebilirsiniz. İptal sonrası dönem sonuna kadar hizmet almaya devam edersiniz.</p>
                    </div>
                    <div class="border-b border-gray-200 pb-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">Jeton paketleri ne kadar süre geçerli?</h3>
                        <p class="text-gray-600">Jeton paketleri süresiz olarak geçerlidir. Satın aldığınız jetonlar hesabınızda kalır ve istediğiniz zaman kullanabilirsiniz.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Satın alma butonlarına event listener'ları ekler.
 */
function setupPurchaseButtons() {
    // Plan butonları
    document.querySelectorAll('[data-plan-id]').forEach(button => {
        button.addEventListener('click', () => {
            const planId = button.dataset.planId;
            if (planId === 'free') return;
            
            // Şimdilik PRO planını varsayılan olarak seç
            handlePurchase('pro_monthly');
        });
    });

    // Jeton paketi butonları
    document.querySelectorAll('[data-package-id]').forEach(button => {
        button.addEventListener('click', () => {
            const packageId = button.dataset.packageId;
            handlePurchase(packageId);
        });
    });
}

/**
 * İlk kez alım indirimini kontrol eder ve banner'ı gösterir.
 */
async function checkFirstTimeDiscount() {
    try {
        const discountInfo = await purchaseManager.getFirstTimeDiscount();
        const banner = document.getElementById('first-time-discount-banner');
        
        if (discountInfo.isEligible && banner) {
            banner.classList.remove('hidden');
        }
    } catch (error) {
        console.error('İndirim kontrolü hatası:', error);
    }
}

/**
 * Sayfa yüklendiğinde çalışacak ana fonksiyon.
 */
async function initializePremiumPage(userData) {
    if (!userData) {
        showError('Kullanıcı verisi bulunamadı. Lütfen tekrar giriş yapın.');
        setTimeout(() => window.location.href = 'login.html', 2000);
        return;
    }

    currentUser = userData;

    try {
        // PurchaseManager'ı başlat
        await purchaseManager.initialize(userData.uid);
        
        // Teklifleri al
        availablePackages = await purchaseManager.getOfferings();
        
        if (!availablePackages || availablePackages.length === 0) {
            showError('Abonelik seçenekleri şu anda mevcut değil. Lütfen daha sonra tekrar deneyin.');
            return;
        }

        // Arayüzü oluştur
        createPremiumInterface();
        
        // Butonları hazırla
        setupPurchaseButtons();
        
        // İndirim kontrolü
        await checkFirstTimeDiscount();
        
        console.log('✅ Premium sayfası başarıyla başlatıldı');
        
    } catch (error) {
        console.error('Premium sayfa başlatma hatası:', error);
        showError('Sayfa yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

// --- Yardımcı fonksiyonlar ---
function showSuccess(message) {
    // Basit success mesajı gösterimi
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        document.body.removeChild(successDiv);
    }, 3000);
}

function showError(message) {
    // Basit error mesajı gösterimi
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        document.body.removeChild(errorDiv);
    }, 5000);
}

// --- Sayfa Yüklendiğinde Çalışacak Kod ---
window.addEventListener('load', () => {
    AuthManager.initProtectedPage(initializePremiumPage);
});