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
        // Sistem sıfırlama durumlarında kullanıcı dostu mesajlar
        const systemResetMessages = [
            "Sistem şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.",
            "Yapay zeka şu anda meşgul. Lütfen biraz bekleyip tekrar deneyin.",
            "Geçici bir sistem gecikmesi yaşanıyor. Lütfen tekrar deneyin.",
            "Sistemlerimiz şu anda yoğun. Lütfen daha sonra tekrar deneyin."
        ];

        const invalidResponseMessages = [
            "Sorunuz tam olarak anlaşılamadı. Lütfen problemi daha net bir şekilde yazarak veya farklı bir fotoğraf çekerek tekrar deneyin.",
            "Bu problem için bir çözüm yolu oluşturamadım. Lütfen soruyu kontrol edip tekrar gönderin.",
            "Yapay zeka bir çözüm üretirken zorlandı. Bu genellikle sorunun belirsiz olmasından veya desteklenmeyen bir konudan kaynaklanır. Tekrar dener misiniz?",
            "Üzgünüm, şu anda bu soruya bir yanıt oluşturamıyorum. Lütfen daha sonra tekrar deneyin."
        ];

        // API'den gelen özel hata mesajları - Kullanıcı dostu ve imaj koruyucu
        const apiSpecificMessages = {
            'resource-exhausted': 'Şu anda sistemlerimiz yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',
            'deadline-exceeded': 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.',
            'invalid-argument': 'Gönderilen veri formatı uygun değil. Lütfen soruyu kontrol edin.',
            'not-found': 'İstenen kaynak bulunamadı. Lütfen tekrar deneyin.',
            'permission-denied': 'Bu işlem için yetkiniz bulunmuyor.',
            'already-exists': 'Bu işlem zaten yapılmış.',
            'failed-precondition': 'İşlem ön koşulları sağlanamadı.',
            'aborted': 'İşlem iptal edildi.',
            'out-of-range': 'İstek sınırlar dışında.',
            'unimplemented': 'Bu özellik henüz desteklenmiyor.',
            'internal': 'Sunucu iç hatası. Lütfen daha sonra tekrar deneyin.',
            'unavailable': 'Servis şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
            'data-loss': 'Veri kaybı oluştu. Lütfen tekrar deneyin.',
            'unauthenticated': 'Giriş yapmanız gerekiyor.'
        };

        // Ana hata mesajları - Kullanıcı dostu ve imaj koruyucu
        const messages = {
            RATE_LIMIT_EXCEEDED: 'Günlük kullanım limitinize ulaştınız. Lütfen daha sonra tekrar deneyin.',
            NETWORK_ERROR: 'İnternet bağlantınızı kontrol edin. Lütfen bağlantınızı yeniden kurup tekrar deneyin.',
            SERVER_ERROR: 'Sunucularımızda geçici bir sorun var. Ekibimiz ilgileniyor, lütfen biraz sonra tekrar deneyin.',
            TIMEOUT_ERROR: 'İstek çok uzun sürdü. İnternet bağlantınızı kontrol edip tekrar deneyin.',
            PARSE_ERROR: 'Sunucudan beklenmedik bir yanıt alındı. Lütfen tekrar deneyin.',
            AUTHENTICATION_ERROR: 'Yetkilendirme hatası. Lütfen yeniden giriş yapmayı deneyin.',
            UNKNOWN_ERROR: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
            INVALID_RESPONSE_ERROR: 'Yapay zeka yanıtı anlaşılamadı. Lütfen soruyu daha net bir şekilde tekrar deneyin.',
            API_ERROR: 'API ile iletişim kurulamadı. Lütfen internet bağlantınızı kontrol edin.',
            RENDER_ERROR: 'Çözüm görüntülenirken bir sorun oluştu. Lütfen tekrar deneyin.',
            CONTENT_ERROR: 'İçerik işlenirken bir hata oluştu. Lütfen soruyu kontrol edin.',
            SYSTEM_BUSY: 'Sistemlerimiz şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',
            INSUFFICIENT_DATA: 'Soruyu çözmek için yeterli bilgi yok. Lütfen daha detaylı bir soru sorun.',
            UNSUPPORTED_FORMAT: 'Bu format desteklenmiyor. Lütfen metin olarak yazın veya fotoğraf çekin.',
            IMAGE_QUALITY: 'Fotoğraf kalitesi yetersiz. Lütfen daha net bir fotoğraf çekin.',
            HANDWRITING_RECOGNITION: 'El yazısı tanınamadı. Lütfen daha okunaklı yazın veya klavye kullanın.',
            SYSTEM_RESET: systemResetMessages[Math.floor(Math.random() * systemResetMessages.length)]
        };

        // API'den gelen özel hata kodlarını kontrol et
        if (errorInfo && errorInfo.context && errorInfo.context.apiErrorCode) {
            const apiMessage = apiSpecificMessages[errorInfo.context.apiErrorCode];
            if (apiMessage) {
                const message = apiMessage;
                this.showDetailedError(message, errorType, errorInfo);
                return;
            }
        }

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

    /**
     * Detaylı hata mesajı gösterir ve kullanıcıya yardımcı olur
     */
    showDetailedError(message, errorType, errorInfo) {
        // Global showError fonksiyonunu çağır
        if (typeof window.showError === 'function') {
            let detailedMessage = message;
            
            // Hata tipine göre ek öneriler ekle - Kullanıcı dostu ve imaj koruyucu
            switch (errorType) {
                case 'API_ERROR':
                    detailedMessage += '\n\n💡 Öneriler:\n• İnternet bağlantınızı kontrol edin\n• Sayfayı yenileyin\n• Daha sonra tekrar deneyin';
                    break;
                case 'RENDER_ERROR':
                    detailedMessage += '\n\n💡 Öneriler:\n• Sayfayı yenileyin\n• Farklı bir tarayıcı kullanın\n• Soruyu tekrar gönderin';
                    break;
                case 'IMAGE_QUALITY':
                    detailedMessage += '\n\n💡 Öneriler:\n• Daha net bir fotoğraf çekin\n• İyi aydınlatma kullanın\n• Metin olarak yazmayı deneyin';
                    break;
                case 'HANDWRITING_RECOGNITION':
                    detailedMessage += '\n\n💡 Öneriler:\n• Daha okunaklı yazın\n• Klavye kullanın\n• Fotoğraf çekin';
                    break;
                case 'SYSTEM_BUSY':
                    detailedMessage += '\n\n💡 Öneriler:\n• Birkaç dakika bekleyin\n• Daha sonra tekrar deneyin\n• Sorunuzu kaydedin';
                    break;
                case 'INSUFFICIENT_DATA':
                    detailedMessage += '\n\n💡 Öneriler:\n• Daha detaylı soru sorun\n• Tüm verileri belirtin\n• Örnek ekleyin';
                    break;
                case 'SYSTEM_RESET':
                    detailedMessage += '\n\n💡 Öneriler:\n• Birkaç dakika bekleyin\n• Soruyu tekrar gönderin\n• Daha sonra tekrar deneyin';
                    break;
                default:
                    detailedMessage += '\n\n💡 Öneriler:\n• Sayfayı yenileyin\n• Daha sonra tekrar deneyin\n• Sorun devam ederse bize bildirin';
            }
            
            window.showError(detailedMessage, true, () => {
                if(window.stateManager) {
                    window.stateManager.reset();
                }
            });
        } else {
            // Fallback
            window.dispatchEvent(new CustomEvent('show-error-message', {
                detail: { message: message, isCritical: true, errorType: errorType }
            }));
        }
    }

    /**
     * Sistem sıfırlama durumunda özel mesaj gösterir
     */
    showSystemResetMessage(context = 'general') {
        const resetMessages = {
            'general': 'Sistem şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',
            'api_timeout': 'Yapay zeka şu anda meşgul. Lütfen biraz bekleyip tekrar deneyin.',
            'server_busy': 'Sunucularımız şu anda yoğun. Lütfen daha sonra tekrar deneyin.',
            'processing_error': 'İşlem sırasında bir gecikme yaşandı. Lütfen tekrar deneyin.',
            'ai_overload': 'Yapay zeka sistemleri şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',
            'temporary_issue': 'Geçici bir sistem gecikmesi yaşanıyor. Lütfen tekrar deneyin.'
        };

        const message = resetMessages[context] || resetMessages['general'];
        
        if (typeof window.showError === 'function') {
            window.showError(message, true, () => {
                if(window.stateManager) {
                    window.stateManager.reset();
                }
            });
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