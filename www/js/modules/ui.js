// =================================================================================
//  MathAi - UI Modülü - Yeni Render Sistemi ile Tam Entegre
// =================================================================================

import { globalRenderManager } from './globalRenderManager.js';

// Loading, Success, Error fonksiyonları (değişiklik yok)
export function showLoading(message) {
    const resultContainer = document.getElementById('result-container');
    const statusMessage = document.getElementById('status-message');

    if (!resultContainer || !statusMessage) return;

    if (message === false) {
        if (!statusMessage.innerHTML || statusMessage.innerHTML.trim() === '') {
             resultContainer.classList.add('hidden');
        }
        return;
    }

    resultContainer.classList.remove('hidden');
    statusMessage.innerHTML = `
         <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-8 w-8 animate-spin"></div>
         <p class="text-gray-600 font-medium">${message}</p>
    `;
    statusMessage.className = 'flex items-center justify-center space-x-3 p-4 bg-gray-50 rounded-lg';
    statusMessage.classList.remove('hidden');
}

export function showSuccess(message, autoHide = true, hideDelay = 3000) {
    const resultContainer = document.getElementById('result-container');
    const statusMessage = document.getElementById('status-message');

    if (!resultContainer || !statusMessage) return;

    resultContainer.classList.remove('hidden');
    statusMessage.className = 'flex flex-col items-center justify-center space-y-3 p-4 bg-green-100 text-green-700 rounded-lg';
    statusMessage.innerHTML = `
        <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <p class="font-medium text-center">${message}</p>
    `;
    statusMessage.classList.remove('hidden');

    if (autoHide) {
        setTimeout(() => {
            statusMessage.innerHTML = '';
            statusMessage.classList.add('hidden');
            const solutionOutput = document.getElementById('solution-output');
            if (solutionOutput && solutionOutput.classList.contains('hidden')) {
                resultContainer.classList.add('hidden');
            }
        }, hideDelay);
    }
}

export function showError(message, showResetButton = false, onReset = () => {}) {
    const resultContainer = document.getElementById('result-container');
    const statusMessage = document.getElementById('status-message');

    if (!resultContainer || !statusMessage) return;

    resultContainer.classList.remove('hidden');
    statusMessage.classList.remove('hidden');
    statusMessage.className = '';

    // Sistem sıfırlama mesajları için özel stil
    const isSystemResetMessage = message.includes('yoğun') || 
                                message.includes('meşgul') || 
                                message.includes('gecikme') || 
                                message.includes('sistem') ||
                                message.includes('yapay zeka');

    // Mesajı satırlara böl ve her satırı ayrı paragraf yap
    const messageLines = message.split('\n').filter(line => line.trim() !== '');
    let messageHTML = '';
    
    messageLines.forEach((line, index) => {
        if (line.trim() === '') return;
        
        if (line.startsWith('💡')) {
            // Öneri satırları için özel stil
            messageHTML += `<p class="text-sm text-blue-600 font-medium mt-2">${line}</p>`;
        } else if (line.startsWith('•')) {
            // Madde işaretli satırlar için özel stil
            messageHTML += `<p class="text-sm text-gray-600 ml-4">${line}</p>`;
        } else if (line.includes('⚠️')) {
            // Uyarı satırları için özel stil
            messageHTML += `<p class="text-lg font-bold text-orange-600">${line}</p>`;
        } else if (line.startsWith('"') && line.endsWith('"')) {
            // Tırnak içindeki metin için özel stil
            messageHTML += `<p class="text-sm text-gray-500 italic bg-gray-50 p-2 rounded">${line}</p>`;
        } else {
            // Normal satırlar için standart stil
            messageHTML += `<p class="font-medium text-center">${line}</p>`;
        }
    });

    // Sistem sıfırlama mesajları için farklı renk ve ikon kullan
    let errorHTML;
    if (isSystemResetMessage) {
        errorHTML = `
            <div class="flex flex-col items-center justify-center space-y-3 p-4 bg-blue-100 text-blue-700 rounded-lg max-w-md">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div class="text-center space-y-2">
                    ${messageHTML}
                </div>
            </div>
        `;
    } else {
        errorHTML = `
            <div class="flex flex-col items-center justify-center space-y-3 p-4 bg-red-100 text-red-700 rounded-lg max-w-md">
                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <div class="text-center space-y-2">
                    ${messageHTML}
                </div>
            </div>
        `;
    }

    statusMessage.innerHTML = errorHTML;

    if (showResetButton) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-4 text-center';
        const okButton = document.createElement('button');
        
        // Sistem sıfırlama mesajları için farklı buton metni
        if (isSystemResetMessage) {
            okButton.textContent = 'Anladım';
            okButton.className = 'btn btn-primary px-6 py-2 bg-blue-600 hover:bg-blue-700';
        } else {
            okButton.textContent = 'Tamam';
            okButton.className = 'btn btn-primary px-6 py-2';
        }

        okButton.onclick = function() {
            statusMessage.innerHTML = '';
            statusMessage.classList.add('hidden');
            resultContainer.classList.add('hidden');
            if (typeof onReset === 'function') {
                onReset();
            }
        };

        buttonContainer.appendChild(okButton);
        statusMessage.querySelector('.rounded-lg').appendChild(buttonContainer);
    }
}

// 🎯 Toast Bildirim Sistemi
export function showToast(message, type = 'info', duration = 3000) {
    // Mevcut toast'ları temizle
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => toast.remove());

    // Toast container oluştur
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(toastContainer);
    }

    // Toast tipine göre renk ve ikon belirle
    const toastConfig = {
        success: {
            bgColor: 'bg-green-500',
            textColor: 'text-white',
            icon: '✅',
            borderColor: 'border-green-600'
        },
        error: {
            bgColor: 'bg-red-500',
            textColor: 'text-white',
            icon: '❌',
            borderColor: 'border-red-600'
        },
        warning: {
            bgColor: 'bg-yellow-500',
            textColor: 'text-white',
            icon: '⚠️',
            borderColor: 'border-yellow-600'
        },
        info: {
            bgColor: 'bg-blue-500',
            textColor: 'text-white',
            icon: 'ℹ️',
            borderColor: 'border-blue-600'
        }
    };

    const config = toastConfig[type] || toastConfig.info;

    // Toast elementi oluştur
    const toast = document.createElement('div');
    toast.className = `toast-notification ${config.bgColor} ${config.textColor} px-4 py-3 rounded-lg shadow-lg border ${config.borderColor} transform translate-x-full transition-all duration-300 ease-out max-w-sm`;
    toast.innerHTML = `
        <div class="flex items-center space-x-3">
            <span class="text-lg">${config.icon}</span>
            <p class="text-sm font-medium">${message}</p>
            <button class="toast-close ml-auto text-white/80 hover:text-white transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `;

    // Toast'u container'a ekle
    toastContainer.appendChild(toast);

    // Animasyon ile göster
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
        toast.classList.add('translate-x-0');
    }, 100);

    // Kapatma butonu event listener
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        hideToast(toast);
    });

    // Otomatik kapatma
    if (duration > 0) {
        setTimeout(() => {
            hideToast(toast);
        }, duration);
    }

    return toast;
}

// Toast gizleme fonksiyonu
function hideToast(toast) {
    toast.classList.add('translate-x-full');
    toast.classList.remove('translate-x-0');
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

export function showAnimatedLoading(steps, stepDelay = 1500) {
    const resultContainer = document.getElementById('result-container');
    const statusMessage = document.getElementById('status-message');
    const solutionOutput = document.getElementById('solution-output');

    if (!resultContainer || !statusMessage || !solutionOutput) return;

    resultContainer.classList.remove('hidden');
    solutionOutput.classList.add('hidden');

    let currentStep = 0;
    const showStep = () => {
        if (currentStep >= steps.length) {
            resultContainer.classList.add('hidden');
            return;
        }

        const step = steps[currentStep];
        statusMessage.innerHTML = `
            <div class="flex items-center justify-center space-x-3">
                <div class="loader ease-linear rounded-full border-4 border-t-4 border-blue-200 h-8 w-8 animate-spin"></div>
                <div class="flex flex-col">
                    <p class="text-blue-600 font-medium">${step.title}</p>
                    <p class="text-gray-500 text-sm">${step.description}</p>
                </div>
            </div>
        `;
        statusMessage.className = 'flex items-center justify-center p-4 bg-blue-50 rounded-lg border border-blue-200';

        currentStep++;
        setTimeout(showStep, stepDelay);
    };

    showStep();
}

// =================================================================================
// ✅ YENİ RENDER FONKSİYONLARI - Metadata-Optimized
// =================================================================================

/**
 * Gelişmiş render fonksiyonu - Field name ile optimize edilmiş
 * @param {string} content - Render edilecek içerik
 * @param {HTMLElement} element - Hedef element
 * @param {boolean} displayMode - Blok render modu
 * @param {string} fieldName - API field adı (metadata için)
 */
export async function renderMath(content, element, displayMode = false, fieldName = null) {
    if (!content || !element) return false;
    
    try {
        // Field name'i element'e ekle (metadata için)
        if (fieldName) {
            element.setAttribute('data-field', fieldName);
        }
        
        // Gelişmiş render sistemi ile render et
        return await globalRenderManager.renderElement(element, content, { displayMode });
    } catch (error) {
        console.error(`Render işlemi başarısız:`, { content, fieldName, error });
        element.textContent = content;
        element.classList.add('render-error');
        return false;
    }
}

/**
 * Container render fonksiyonu - Progress tracking ile
 * @param {HTMLElement} container - Container element
 * @param {boolean} displayMode - Blok render modu
 * @param {Function} onProgress - Progress callback
 */
export async function renderMathInContainer(container, displayMode = false, onProgress = null) {
    if (!container) return;
    
    try {
        await globalRenderManager.renderContainer(container, {
            displayMode,
            onProgress: onProgress || ((completed, total) => {
                const percentage = Math.round((completed / total) * 100);
                console.log(`📊 Render: ${completed}/${total} (%${percentage})`);
            })
        });
        
        console.log('✅ Container render tamamlandı');
        
    } catch (error) {
        console.error('❌ Container render hatası:', error);
        // Hatalı elementler zaten .render-error sınıfına sahip
    }
}

/**
 * Smart content render - Field name detection ile
 * @param {HTMLElement} container - Container element
 */
export async function renderSmartContent(container) {
    if (!container) return;
    
    const smartElements = container.querySelectorAll('.smart-content[data-content]');
    console.log(`🎯 ${smartElements.length} smart element bulundu`);
    
    for (const element of smartElements) {
        const content = element.getAttribute('data-content');
        const fieldName = element.getAttribute('data-field') || inferFieldFromContext(element);
        
        if (content) {
            try {
                await renderMath(content, element, false, fieldName);
            } catch (error) {
                console.warn(`Smart content render hatası:`, { fieldName, error });
                element.textContent = content;
                element.classList.add('render-error');
            }
        }
    }
}

/**
 * LaTeX content render - Display mode ile
 * @param {HTMLElement} container - Container element
 */
export async function renderLatexContent(container) {
    if (!container) return;
    
    const latexElements = container.querySelectorAll('.latex-content[data-latex]');
    console.log(`📐 ${latexElements.length} latex element bulundu`);
    
    for (const element of latexElements) {
        const latex = element.getAttribute('data-latex');
        const fieldName = element.getAttribute('data-field') || 'cozum_lateks';
        
        if (latex) {
            try {
                await renderMath(latex, element, true, fieldName);
            } catch (error) {
                console.warn(`LaTeX content render hatası:`, { fieldName, error });
                element.textContent = latex;
                element.classList.add('render-error');
            }
        }
    }
}

// =================================================================================
// ✅ YENİ YARDIMCI FONKSİYONLAR
// =================================================================================

/**
 * Element context'inden field name'i çıkarsamaya çalışır
 * @param {HTMLElement} element - Analiz edilecek element
 * @returns {string|null} - Bulunan field name
 */
function inferFieldFromContext(element) {
    // Parent container'lardan çıkarım yap
    const parentSelectors = {
        '.solution-step': 'adimAciklamasi',
        '.interactive-workspace': 'adimAciklamasi', 
        '.option-label': 'metin_lateks',
        '.hint-container': 'ipucu',
        '.error-container': 'hataAciklamasi',
        '.result-container': 'sonucKontrolu'
    };
    
    for (const [selector, fieldName] of Object.entries(parentSelectors)) {
        if (element.closest(selector)) {
            return fieldName;
        }
    }
    
    // Class name'den çıkarım
    if (element.classList.contains('step-description')) return 'adimAciklamasi';
    if (element.classList.contains('option-text')) return 'metin_lateks';
    if (element.classList.contains('hint-text')) return 'ipucu';
    
    return null;
}

/**
 * Render sistemini başlatır ve hazırlık yapar
 * @returns {Promise<boolean>} - Başlatma başarılı mı?
 */
export async function initializeRenderSystem() {
    console.log('🚀 Gelişmiş render sistemi başlatılıyor...');
    
    try {
        const initialized = await globalRenderManager.initializeMathJax();
        
        if (initialized) {
            console.log('✅ Render sistemi hazır');
            
            // Performance monitoring başlat (sadece development'da)
            if (window.location.hostname === 'localhost') {
                setupRenderMonitoring();
            }
            
            return true;
        } else {
            console.error('❌ Render sistemi başlatılamadı');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Render sistemi başlatma hatası:', error);
        return false;
    }
}

/**
 * Render performance monitoring (sadece development)
 */
function setupRenderMonitoring() {
    setInterval(() => {
        const stats = globalRenderManager.getStats();
        if (stats.successful > 0) {
            console.log('📊 Render Stats:', {
                successful: stats.successful,
                failed: stats.failed,
                metadataEfficiency: stats.metadataEfficiency,
                avgRenderTime: stats.avgRenderTimeMs + 'ms'
            });
        }
    }, 30000); // Her 30 saniyede rapor
}

/**
 * API yanıt süresine göre çalışan akıllı loading animasyonu
 * @param {string|string[]} messages - Gösterilecek mesajlar
 * @param {string} icon - Mesaj ikonu
 * @param {number} minDuration - Minimum gösterim süresi (ms)
 * @param {boolean} autoResolve - true: otomatik kapanır, false: API yanıtı bekler
 * @returns {Promise} - API yanıtı geldiğinde veya süre dolduğunda resolve olur
 */
export function showTemporaryMessage(messages, icon = '🚀', minDuration = 2000, autoResolve = false) {
    return new Promise(resolve => {
        const messageArray = Array.isArray(messages) ? messages : [messages];
        let currentIndex = 0;
        let isResolved = false;
        
        // Önceki mesajı temizle
        const existingMessage = document.getElementById('temporary-message-overlay');
        if (existingMessage) {
            existingMessage.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'temporary-message-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 animate-fade-in';
        
        overlay.innerHTML = `
            <div class="flex flex-col items-center gap-4 bg-white rounded-2xl shadow-xl p-8 transform animate-scale-in w-72">
                <div class="text-6xl">${icon}</div>
                <p id="dynamic-message-p" class="text-lg font-semibold text-gray-800 text-center h-14 flex items-center justify-center transition-opacity duration-300"></p>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div id="progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
                <div class="flex items-center space-x-2 text-sm text-gray-500">
                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>${autoResolve ? 'İşlem devam ediyor...' : 'API yanıtı bekleniyor...'}</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const pElement = document.getElementById('dynamic-message-p');
        const progressBar = document.getElementById('progress-bar');

        const updateMessage = () => {
            if (!pElement || isResolved) return;
            
            pElement.style.opacity = '0';
            setTimeout(() => {
                if (!isResolved) {
                    pElement.textContent = messageArray[currentIndex];
                    pElement.style.opacity = '1';
                    
                    // Progress bar güncelle
                    const progress = ((currentIndex + 1) / messageArray.length) * 100;
                    progressBar.style.width = `${progress}%`;
                }
            }, 200);
        };

        // İlk mesajı göster
        updateMessage();
        
        // Çoklu mesaj için interval
        let messageInterval;
        if (messageArray.length > 1) {
            messageInterval = setInterval(() => {
                if (!isResolved) {
                    currentIndex = (currentIndex + 1) % messageArray.length;
                    updateMessage();
                }
            }, 1500); // Mesaj değişim süresini kısalt
        }

        // Minimum süre kontrolü
        let minDurationElapsed = false;
        setTimeout(() => {
            minDurationElapsed = true;
            checkIfReadyToResolve();
        }, minDuration);

        // API yanıtı geldiğinde çağrılacak fonksiyon
        const markAsReady = () => {
            if (!isResolved) {
                isResolved = true;
                checkIfReadyToResolve();
            }
        };

        // Hem minimum süre hem de API yanıtı geldiğinde resolve et
        const checkIfReadyToResolve = () => {
            if (minDurationElapsed && (isResolved || autoResolve)) {
                if (messageInterval) clearInterval(messageInterval);
                
                // Başarı animasyonu göster
                overlay.querySelector('.text-6xl').textContent = '✅';
                overlay.querySelector('.text-sm').innerHTML = '<span class="text-green-600">✓ Tamamlandı!</span>';
                
                setTimeout(() => {
                    overlay.classList.remove('animate-fade-in');
                    overlay.classList.add('animate-fade-out');
                    
                    setTimeout(() => {
                        if (overlay.parentNode) {
                            overlay.remove();
                        }
                        resolve();
                    }, 300);
                }, 500);
            }
        };

        // Dışarıdan erişilebilir resolve fonksiyonu
        overlay.markAsReady = markAsReady;
        
        // Global olarak erişilebilir yap
        window.currentLoadingOverlay = overlay;
    });
}

/**
 * HTML escape utility - Türkçe karakter desteği ile
 */
export function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Türkçe karakterleri koruyan HTML escape
 */
export function escapeHtmlTurkish(text) {
    if (!text) return '';
    
    // Türkçe karakterleri koru
    const turkishChars = {
        'ğ': 'ğ', 'ü': 'ü', 'ş': 'ş', 'ı': 'ı', 'ö': 'ö', 'ç': 'ç',
        'Ğ': 'Ğ', 'Ü': 'Ü', 'Ş': 'Ş', 'İ': 'İ', 'Ö': 'Ö', 'Ç': 'Ç'
    };
    
    let escaped = text;
    for (const [char, replacement] of Object.entries(turkishChars)) {
        escaped = escaped.replace(new RegExp(char, 'g'), replacement);
    }
    
    const div = document.createElement('div');
    div.textContent = escaped;
    return div.innerHTML;
}

/**
 * Render cache temizleme (view değişikliklerinde)
 */
export function clearRenderCache() {
    if (globalRenderManager) {
        globalRenderManager.reset();
        console.log('🧹 Render cache temizlendi');
    }
}

/**
 * Render istatistiklerini göster (debug için)
 */
export function showRenderStats() {
    if (globalRenderManager) {
        const stats = globalRenderManager.getStats();
        console.table(stats);
        return stats;
    }
    return null;
}

// =================================================================================
// ✅ GLOBAL ERİŞİM ve EXPORT
// =================================================================================

// Global window erişimi (backward compatibility)
if (typeof window !== 'undefined') {
    window.mathUI = {
        renderMath, 
        renderMathInContainer, 
        renderSmartContent, 
        renderLatexContent,
        initializeRenderSystem,
        clearRenderCache,
        showRenderStats,
        globalRenderManager
    };
}

// Modern ES6 exports
export {
    //globalRenderManager,
    //clearRenderCache,
    //showRenderStats
};