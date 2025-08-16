// www/js/modules/adManager.js - IMPORT HATASI GİDERİLMİŞ NİHAİ VERSİYON

// SORUNLU IMPORT SATIRI BURADAN KALDIRILDI.

// --- Ortam Kontrolü ---
// Capacitor nesnesinin var olup olmadığını kontrol ederek native ortamda olup olmadığımızı anlıyoruz.
const isNativePlatform = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
let AdMob, RewardAdPluginEvents;

if (isNativePlatform) {
    // Sadece native platformda AdMob eklentisini Capacitor'un global nesnesinden alıyoruz.
    ({ AdMob, RewardAdPluginEvents } = Capacitor.Plugins);
}
// --------------------

// --- AYARLAR ---
const IS_DEVELOPMENT_MODE = true; 
const TEST_REWARDED_AD_ID_ANDROID = 'ca-app-pub-3940256099942544/5224354917';
const PRODUCTION_REWARDED_AD_ID = 'YOUR_REWARDED_AD_UNIT_ID'; 

// --- Web Tarayıcısı için Mock (Taklit) Reklam Yöneticisi ---
const mockAdManager = {
    isInitialized: false,
    initialize() {
        console.log('ADMOB MOCK: Tarayıcıda çalışılıyor, AdMob başlatıldı (simülasyon).');
        this.isInitialized = true;
    },
    async showRewardAd() {
        return new Promise((resolve) => {
            console.log('ADMOB MOCK: Ödüllü reklam gösteriliyor (simülasyon)...');
            setTimeout(() => {
                console.log('ADMOB MOCK: Reklam izlendi ve ödül kazanıldı (simülasyon).');
                resolve(true); // Her zaman başarılı say
            }, 1500);
        });
    }
};

// --- Gerçek Native Reklam Yöneticisi ---
const nativeAdManager = {
    isInitialized: false,
    async initialize() {
        if (this.isInitialized || !AdMob) return;
        try {
            await AdMob.initialize({
                requestTrackingAuthorization: true,
                initializeForTesting: IS_DEVELOPMENT_MODE,
            });
            this.isInitialized = true;
            console.log('✅ AdMob (Native) başarıyla başlatıldı. Geliştirme Modu:', IS_DEVELOPMENT_MODE);
        } catch (error) {
            console.error('❌ AdMob (Native) başlatma hatası:', error);
        }
    },
    async showRewardAd() {
        return new Promise(async (resolve, reject) => {
            if (!this.isInitialized) return reject(new Error('AdMob başlatılmadı'));

            const adId = IS_DEVELOPMENT_MODE ? TEST_REWARDED_AD_ID_ANDROID : PRODUCTION_REWARDED_AD_ID;
            console.log(`(Native) Ödüllü reklam hazırlanıyor... ID: ${adId}`);
            
            try {
                const options = { adId };
                let rewardListener, dismissListener, failedListener;

                const cleanupListeners = () => {
                    rewardListener?.remove();
                    dismissListener?.remove();
                    failedListener?.remove();
                };

                rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
                    console.log('✅ Reklam izlendi ve ödül kazanıldı:', reward);
                    resolve(true);
                    cleanupListeners();
                });

                dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
                    console.warn('Reklam ödül kazanılmadan kapatıldı.');
                    resolve(false);
                    cleanupListeners();
                });

                failedListener = await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
                    console.error('❌ Reklam yüklenemedi:', error);
                    reject(new Error('Reklam yüklenemedi'));
                    cleanupListeners();
                });

                await AdMob.prepareRewardVideoAd(options);
                await AdMob.showRewardVideoAd();

            } catch (error) {
                console.error('❌ Reklam gösterme hatası:', error);
                reject(error);
            }
        });
    }
};

// Ortama göre doğru reklam yöneticisini dışa aktar
export const adManager = isNativePlatform ? nativeAdManager : mockAdManager;