// www/js/pages/premium.js - YENİ ÜCRETLENDİRME MODELİ İÇİN NİHAİ VERSİYON

import { AuthManager, auth } from '../modules/auth.js';
import { purchaseManager } from '../modules/purchaseManager.js';
import { FirestoreManager } from '../modules/firestore.js';

// Satın alınabilir paketleri global olarak saklayalım
let availablePackages = [];

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
            // Butonun orijinal metnini sakla ki sonra geri yükleyebilelim
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.textContent;
            }
            button.textContent = message || 'İşleniyor...';
        } else {
            // Orijinal metni geri yükle
            button.textContent = button.dataset.originalText || 'Bu Planı Seç';
        }
    });
}

/**
 * Belirli bir ürünü (abonelik veya jeton) satın alma akışını yönetir.
 * @param {string} productId - Satın alınacak ürünün ID'si (örn: 'premium_pro', 'token_15').
 */
async function handlePurchase(productId) {
    const selectedPackage = availablePackages.find(pkg => pkg.product.identifier === productId);

    if (!selectedPackage) {
        alert("Seçilen paket şu anda mevcut değil. Lütfen sayfayı yenileyip tekrar deneyin.");
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

        // Satın almanın türüne göre işlem yap
        if (productId === 'token_15') {
            setButtonState(true, 'Jetonlar hesabınıza ekleniyor...');
            // Firestore'a 15 jeton ekle
            await FirestoreManager.addTokenQueries(15);
            alert('Başarılı! Hesabınıza 15 soru kredisi eklendi. Profil sayfanıza yönlendiriliyorsunuz.');
        } 
        // Abonelik alımı kontrolü
        else if (result.tier && result.tier !== 'free') {
            setButtonState(true, 'Aboneliğiniz doğrulanıyor...');
            // Firestore'daki abonelik verisini güncelle
            await FirestoreManager.updateUserSubscription(result.tier, result.expiresDate);
            alert('Satın alma başarılı! Premium üyeliğiniz aktif edildi. Profil sayfanıza yönlendiriliyorsunuz.');
        } 
        // Beklenmedik bir durum
        else {
            throw new Error(result.message || 'Satın alma doğrulanamadı. Lütfen destek ile iletişime geçin.');
        }
        
        // Başarılı işlem sonrası profle yönlendir
        window.location.href = 'profile.html';

    } catch (error) {
        alert(`Satın alma sırasında bir hata oluştu: ${error.message}`);
        setButtonState(false);
    }
}

/**
 * Sayfa yüklendiğinde RevenueCat'ten mevcut teklifleri çeker ve arayüzü hazırlar.
 */
async function initializePremiumPage(userData) {
    if (!userData) {
        alert('Kullanıcı verisi bulunamadı. Lütfen tekrar giriş yapın.');
        window.location.href = 'login.html';
        return;
    }

    const offeringsContainer = document.getElementById('offerings-container');
    offeringsContainer.innerHTML = '<p class="text-center text-gray-500">Abonelik seçenekleri yükleniyor...</p>';
    
    // AuthManager'dan gelen kullanıcı ID'si ile purchaseManager'ı başlat
    await purchaseManager.initialize(userData.uid);
    availablePackages = await purchaseManager.getOfferings();

    if (!availablePackages || availablePackages.length === 0) {
        offeringsContainer.innerHTML = '<p class="text-center text-red-500">Abonelik seçenekleri şu anda mevcut değil. Lütfen daha sonra tekrar deneyin.</p>';
        return;
    }
    
    // Teklifler yüklendi, arayüzü hazırla
    offeringsContainer.innerHTML = ''; 
    
    const purchaseButtons = document.querySelectorAll('.purchase-btn');
    purchaseButtons.forEach(button => {
        // Her butona kendi ürün ID'si ile bir tıklama olayı ata
        button.addEventListener('click', () => handlePurchase(button.dataset.productId));
    });
    
    setButtonState(false); // Butonları aktif et
}

// --- Sayfa Yüklendiğinde Çalışacak Kod ---
window.addEventListener('load', () => {
    // AuthManager'a, kullanıcı durumu netleştiğinde `initializePremiumPage` fonksiyonunu
    // kullanıcı verileriyle birlikte çalıştırmasını söylüyoruz. Bu, zamanlama hatalarını önler.
    AuthManager.initProtectedPage(initializePremiumPage);
});