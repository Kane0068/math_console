// Dosya Adı: www/js/modules/errorHandler.js

export class AdvancedErrorHandler {
    constructor() {
        this.maxRetries = 2; // Maksimum deneme sayısı
        this.retryDelay = 1500; // Denemeler arası bekleme süresi
        this.setupGlobalErrorHandlers();
    }

    setupGlobalErrorHandlers() {
        // Yakalanamayan promise hataları
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.logError('UNHANDLED_PROMISE_REJECTION', event.reason);
            this.showUserError('UNKNOWN_ERROR', { message: 'Beklenmedik bir sorun oluştu.' });
            event.preventDefault();
        });

        // Global JavaScript hataları
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.logError('GLOBAL_ERROR', event.error);
        });

        // Ağ bağlantısı durumunu dinle
        window.addEventListener('offline', () => this.handleNetworkChange(false));
        window.addEventListener('online', () => this.handleNetworkChange(true));
    }

    /**
     * API veya diğer kritik hataları yönetir.
     * @param {Error} error - Yakalanan hata nesnesi.
     * @param {Object} context - Hatanın oluştuğu bağlam (örn: hangi operasyon).
     * @returns {Promise<Object|null>} - Fallback verisi veya yeniden deneme sonucu.
     */
    async handleError(error, context = { operation: null, payload: null }) {
        const errorType = this.classifyError(error);

        const errorInfo = {
            type: errorType,
            message: error.message,
            context: context.operation,
            timestamp: new Date().toISOString(),
        };

        this.logError(errorType, errorInfo);

        // Kullanıcıya her zaman bir hata gösterelim
        this.showUserError(errorType, errorInfo);
        
        // Sadece belirli hatalar için fallback verisi döndür
        return this.getFallbackData(errorType);
    }

    classifyError(error) {
        const message = error.message?.toLowerCase() || '';
        const status = error.status || 0;
         // handleNewProblem içinde fırlattığımız özel hatayı burada yakalıyoruz.
        if (message.includes('invalid_response_error')) return 'INVALID_RESPONSE_ERROR';

        if (!navigator.onLine) return 'NETWORK_ERROR';
        if (status === 429 || message.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
        if (status === 401 || status === 403) return 'AUTHENTICATION_ERROR';
        if (status >= 500) return 'SERVER_ERROR';
        if (message.includes('timeout') || error.name === 'AbortError') return 'TIMEOUT_ERROR';
        if (message.includes('json') || message.includes('parse')) return 'PARSE_ERROR';
        
        return 'UNKNOWN_ERROR';
    }
    
    showUserError(errorType, errorInfo) {

        const invalidResponseMessages = [
            "Sorunuz tam olarak anlaşılamadı. Lütfen problemi daha net bir şekilde yazarak veya farklı bir fotoğraf çekerek tekrar deneyin.",
            "Bu problem için bir çözüm yolu oluşturamadım. Lütfen soruyu kontrol edip tekrar gönderin.",
            "Yapay zeka bir çözüm üretirken zorlandı. Bu genellikle sorunun belirsiz olmasından veya desteklenmeyen bir konudan kaynaklanır. Tekrar dener misiniz?",
            "Üzgünüm, şu anda bu soruya bir yanıt oluşturamıyorum. Lütfen daha sonra tekrar deneyin."
        ];
        const messages = {
            RATE_LIMIT_EXCEEDED: 'Günlük kullanım limitinize ulaştınız veya çok sık istek gönderiyorsunuz. Lütfen daha sonra tekrar deneyin.',
            NETWORK_ERROR: 'İnternet bağlantınız yok gibi görünüyor. Lütfen bağlantınızı kontrol edin.',
            SERVER_ERROR: 'Sunucularımızda geçici bir sorun var. Ekibimiz ilgileniyor, lütfen biraz sonra tekrar deneyin.',
            TIMEOUT_ERROR: 'İstek çok uzun sürdü ve zaman aşımına uğradı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
            PARSE_ERROR: 'Sunucudan beklenmedik bir yanıt alındı. Lütfen tekrar deneyin.',
            AUTHENTICATION_ERROR: 'Yetkilendirme hatası. Lütfen yeniden giriş yapmayı deneyin.',
            UNKNOWN_ERROR: 'Beklenmeyen bir hata oluştu. Sorun devam ederse lütfen bize bildirin.'
        };
        const message = messages[errorType] || messages['UNKNOWN_ERROR'];
        
        // Global showError fonksiyonunu çağır
        if (typeof window.showError === 'function') {
            // Hata mesajını göster ve arayüzü sıfırlamak için bir "Tamam" butonu ekle.
            // ui.js'deki showError fonksiyonu zaten reset butonu göstermeyi destekliyor.
            window.showError(message, true, () => {
                if(window.stateManager) {
                    window.stateManager.reset();
                }
            });
        } else {
            // Fallback
            window.dispatchEvent(new CustomEvent('show-error-message', {
                detail: { message: message, isCritical: true }
            }));
        }
    }

    createErrorModal() {
        // Bu kısım artık `ui.js` veya `index.js` içinde yönetilecek.
        // `showError` fonksiyonu bu işlevi görecek.
    }

    logError(type, error) {
        console.group(`[Hata Yönetimi] Tip: ${type}`);
        console.error(error);
        console.groupEnd();

        // İleride buraya Sentry, LogRocket gibi bir servise hata gönderme kodu eklenebilir.
    }

    getFallbackData(errorType) {
        // Sadece belirli, kurtarılamaz hatalarda fallback verisi döndür
        const fallbackErrorTypes = ['SERVER_ERROR', 'PARSE_ERROR', 'TIMEOUT_ERROR', 'UNKNOWN_ERROR'];

        if (fallbackErrorTypes.includes(errorType)) {
            return {
                problemOzeti: {
                    verilenler: ["Problem analiz edilirken bir sorun oluştu."],
                    istenen: "Lütfen soruyu daha net bir şekilde tekrar deneyin."
                },
                adimlar: [],
                tamCozumLateks: ["\\text{Çözüm adımları üretilemedi.}"],
                _error: 'Fallback data due to ' + errorType,
                _fallback: true
            };
        }
        return null;
    }

    handleNetworkChange(isOnline) {
        let notification = document.getElementById('network-status-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'network-status-notification';
            notification.className = 'fixed top-4 right-4 text-white px-4 py-2 rounded-lg z-50 transition-transform duration-300 translate-x-full';
            document.body.appendChild(notification);
        }

        if (isOnline) {
            notification.textContent = 'İnternet bağlantısı yeniden kuruldu!';
            notification.classList.remove('bg-red-600');
            notification.classList.add('bg-green-600');
        } else {
            notification.textContent = 'İnternet bağlantınız kesildi.';
            notification.classList.remove('bg-green-600');
            notification.classList.add('bg-red-600');
        }

        // Bildirimi göster
        notification.classList.remove('translate-x-full');

        // Bir süre sonra gizle
        setTimeout(() => {
            notification.classList.add('translate-x-full');
        }, 3000);
    }
}

// Global bir instance oluşturup dışa aktar
// export const errorHandler = new AdvancedErrorHandler();