// --- Gerekli Modülleri Import Et ---

import { AuthManager, auth } from '../modules/auth.js';
import { FirestoreManager } from '../modules/firestore.js';
import {
    showLoading,
    showError,
    showSuccess,
    renderMath,
    renderMathInContainer,
    renderSmartContent,
    initializeRenderSystem,showAnimatedLoading,
    showTemporaryMessage,
} from '../modules/ui.js';
import { OptimizedCanvasManager } from '../modules/canvasManager.js';
import { AdvancedErrorHandler } from '../modules/errorHandler.js';
import { StateManager } from '../modules/stateManager.js';
import { smartGuide } from '../modules/smartGuide.js';
//import { mathSymbolPanel } from '../modules/mathSymbolPanel.js';
import { interactiveSolutionManager } from '../modules/interactiveSolutionManager.js';
import { globalRenderManager } from '../modules/globalRenderManager.js';
import { generateWrongAnswer } from '../utils/mathUtils.js';
import { adManager } from '../modules/adManager.js';
import { purchaseManager } from '../modules/purchaseManager.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // FirestoreManager'a ek olarak bunu da ekleyelim

import { getUnifiedSolution, validateStudentStep,moderateUserInput  } from '../services/apiService.js';


const functions = getFunctions(undefined, 'europe-west1');

// Global instances - Singleton pattern
const canvasManager = new OptimizedCanvasManager();
const errorHandler = new AdvancedErrorHandler();
const stateManager = new StateManager();

// --- Global DOM Önbelleği ---
const elements = {};
let isProcessingNewProblem = false;


// --- UYGULAMA BAŞLANGIÇ NOKTASI ---
window.addEventListener('load', () => {
    AuthManager.initProtectedPage(initializeApp);
});

async function initializeApp(userData) {
    if (userData) {
        showLoading("Matematik render sistemi başlatılıyor...");
        const renderReady = await initializeRenderSystem(); // 👈 Bu zaten var!
        
        if (!renderReady) {
            showError("Render sistemi başlatılamadı. Sayfayı yenileyin.", true, () => location.reload());
            return;
        }

        await purchaseManager.initialize(userData.uid);

        await adManager.initialize();
        cacheDOMElements();
        setupEventListeners();
        setupGlobalSymbolPanelListener(); 
        stateManager.subscribe(renderApp);
        stateManager.setUser(userData);
        
        smartGuide.setCanvasManager(canvasManager);
        initializeSymbolPanels();
        showLoading(false);
        console.log('✅ Uygulama başarıyla başlatıldı');
    } else {
        document.body.innerHTML = '<p>Uygulama başlatılamadı.</p>';
    }
}

// --- KURULUM FONKSİYONLARI ---
function cacheDOMElements() {
    const ids = [
        'header-subtitle', 'query-count', 'query-label','question-setup-area', 'photo-mode-btn',
        'handwriting-mode-btn', 'photo-mode-container', 'handwriting-mode-container',
        'imageUploader', 'cameraUploader', 'imagePreview', 'startFromPhotoBtn',
        'upload-selection', 'preview-container', 'selectFileBtn', 'takePhotoBtn',
        'changePhotoBtn', 'handwriting-canvas-container', 'keyboard-input-container',
        'handwritingCanvas', 'recognizeHandwritingBtn', 'hw-pen-btn', 'hw-eraser-btn',
        'hw-undo-btn', 'hw-clear-btn', 'keyboard-input', 'startFromTextBtn',
        'switchToCanvasBtn', 'switchToKeyboardBtn', 'question', 'top-action-buttons',
        'start-solving-workspace-btn', 'solve-all-btn', 'new-question-btn',
        'goBackBtn', 'logout-btn', 'solving-workspace', 'result-container', 'status-message',
        'solution-output', 'question-summary-container', 'show-full-solution-btn',
        'step-by-step-container'
    ];
    ids.forEach(id => { elements[id] = document.getElementById(id); });
    canvasManager.initCanvas('handwritingCanvas');
    // Butonları başlangıçta pasif yap.
    if (elements['recognizeHandwritingBtn']) {
        elements['recognizeHandwritingBtn'].disabled = true;
    }
    if (elements['startFromTextBtn']) {
        elements['startFromTextBtn'].disabled = true;
    }
}
function setupGlobalSymbolPanelListener() {
    document.addEventListener('click', function(e) {
        const panels = document.querySelectorAll('.math-symbols-panel');
        panels.forEach(panel => {
            const targetId = panel.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);

            // Eğer tıklama, panelin hedef input'u veya panelin kendisi değilse paneli gizle.
            if (targetInput && !targetInput.contains(e.target) && !panel.contains(e.target)) {
                panel.classList.remove('show');
            }
        });
    });
    console.log('✅ Global symbol panel listener kuruldu.');
}
// index.js

// MEVCUT initializeSymbolPanels FONKSİYONUNU TAMAMEN BUNUNLA DEĞİŞTİRİN
function initializeSymbolPanels() {
    const panels = document.querySelectorAll('.math-symbols-panel:not([data-panel-initialized])');

    panels.forEach(panel => {
        const targetId = panel.getAttribute('data-target');
        const targetInput = document.getElementById(targetId);
        const toggleBtn = panel.querySelector('.toggle-symbols-btn');
        const symbolBtns = panel.querySelectorAll('.symbol-btn');
        const symbolsContent = panel.querySelector('.symbols-content, #symbols-content');

        if (!targetInput) {
            console.warn(`Panel için hedef input bulunamadı: ${targetId}`);
            return;
        }

        // --- Panel-spesifik dinleyiciler ---

        // 1. Input'a tıklandığında (focus olduğunda) paneli göster.
        targetInput.addEventListener('click', function(e) {
            // Click olayının document'e yayılmasını durdurarak çakışmayı önle.
            e.stopPropagation();
            panel.classList.add('show');
        });
        
        targetInput.addEventListener('focus', function() {
            panel.classList.add('show');
        });
        
        // 2. Panelin içine tıklandığında yayılmayı durdur, kapanmasını engelle.
        panel.addEventListener('click', function(e) {
             e.stopPropagation();
        });


        // 3. Gizle/Göster butonu
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Sadece "show" class'ını toggle etmek yerine, içeriği de yönetelim
                const isVisible = panel.classList.toggle('show');
                if (symbolsContent) {
                   symbolsContent.style.display = isVisible ? 'block' : 'none';
                }
            });
        }

        // 4. Sembol butonları
        symbolBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const symbol = this.getAttribute('data-symbol');
                const start = targetInput.selectionStart;
                const end = targetInput.selectionEnd;
                const text = targetInput.value;

                targetInput.value = text.substring(0, start) + symbol + text.substring(end);

                targetInput.focus();
                targetInput.setSelectionRange(start + symbol.length, start + symbol.length);

                this.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
        });

        // 5. Panelin tekrar işlenmemesi için işaretle.
        panel.setAttribute('data-panel-initialized', 'true');
        console.log(`✅ Symbol panel başarıyla kuruldu: target='${targetId}'`);
    });
}

// www/js/pages/index.js -> Bu fonksiyonu eskisiyle tamamen değiştirin

function resetForNewProblem() {
    console.log('🧹 YENİ PROBLEM İÇİN TAM SIFIRLAMA BAŞLATILDI...');

    // 1. ÖNCEKİ CANVAS'I SİLMEK YERİNE SADECE İÇİNİ TEMİZLE
    if (canvasManager.isCanvasReady('handwritingCanvas')) {
        canvasManager.clear('handwritingCanvas', false); // Durumu kaydetmeden temizle
        console.log('✅ Canvas içeriği temizlendi.');
    } else {
        canvasManager.initCanvas('handwritingCanvas');
        console.log('✅ Canvas yeniden başlatıldı.');
    }

    clearInputAreas();
    preRenderedCache.clear();
    
    // Modül Yöneticilerini Sıfırla
    interactiveSolutionManager.reset();
    smartGuide.reset();
    console.log('✅ İnteraktif ve Mentor modülleri sıfırlandı.');

    // Dinamik içerik alanlarını temizle
    const dynamicContentIds = ['question', 'solution-output', 'step-by-step-container'];
    dynamicContentIds.forEach(id => {
        if (elements[id]) elements[id].innerHTML = '';
    });

    // Ana konteynerları gizle
    const containerIdsToHide = ['question-summary-container', 'top-action-buttons', 'solving-workspace', 'result-container', 'goBackBtn'];
    containerIdsToHide.forEach(id => {
        if (elements[id]) elements[id].classList.add('hidden');
    });
    console.log('✅ Konteynerlar temizlendi ve gizlendi.');

    // Giriş butonlarını tekrar aktif hale getir.
    if (elements['recognizeHandwritingBtn']) elements['recognizeHandwritingBtn'].disabled = true; // Başlangıçta pasif
    if (elements['startFromTextBtn']) elements['startFromTextBtn'].disabled = true; // Başlangıçta pasif
    
    // --- BURASI KRİTİK DÜZELTME ---
    // Problem çözümü sırasında pasif hale getirilen tüm mod butonlarını tekrar etkinleştir.
    const buttonsToEnable = [
        'photo-mode-btn', 
        'handwriting-mode-btn', 
        'switchToCanvasBtn', 
        'switchToKeyboardBtn'
    ];
    buttonsToEnable.forEach(id => {
        if (elements[id]) {
            elements[id].disabled = false;
            elements[id].classList.remove('disabled-btn'); // Görsel stili de sıfırla
        }
    });
    console.log('✅ Mod değiştirme butonları tekrar aktif edildi.');
    // --- DÜZELTME SONU ---


    // Durum mesajını temizle
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.innerHTML = '';
        statusMessage.classList.add('hidden');
    }
    showLoading(false);

    // State'i sıfırla (bu işlem view'i 'setup' olarak değiştirir ve UI'ı günceller)
    stateManager.reset(); 
    console.log('✅ State Manager (UI & Problem) sıfırlandı.');
    console.log('✅ Sistem yeni bir problem için tamamen hazır.');
}

function resetToSummary() {
    console.log('🔄 ANA MENÜYE DÖNÜLÜYOR (DURUM KORUNARAK)...');
    // BU FONKSİYON KASITLI OLARAK HİÇBİR YÖNETİCİYİ (manager) SIFIRLAMAZ.
    // Sadece görünümü değiştirir. stateManager, verileri korumaya devam eder.
    stateManager.setView('summary');
    console.log('✅ Görünüm "summary" olarak ayarlandı.');
}

function setupEventListeners() {
    // ErrorHandler'dan gelen hata mesajlarını dinle
    window.addEventListener('show-error-message', (event) => {
        const { message, isCritical } = event.detail;
        showError(message, isCritical, () => stateManager.clearError());
    });

    const add = (id, event, handler) => {
        if (elements[id]) elements[id].addEventListener(event, handler);
        else console.warn(`Element bulunamadı: ${id}`);
    };
    
    // --- KLAVYE İÇİN DÜZELTİLMİŞ DİNLEYİCİ ---
    add('keyboard-input', 'input', (e) => {
        // Butonun aktif olup olmayacağına karar vermek için KIRPILMIŞ değeri kullan.
        const textInput = e.target.value.trim();
        if (elements['startFromTextBtn'] && elements['question-setup-area']) {
            const isAreaLocked = elements['question-setup-area'].classList.contains('disabled-area');
            elements['startFromTextBtn'].disabled = isAreaLocked || textInput === '';
        }
    });

    // YENİ YAKLAŞIM: 'blur' olayı (kullanıcı input'tan ayrıldığında) state'i günceller.
    // Bu, her tuş vuruşunda state'in güncellenmesini ve arayüzün yeniden çizilmesini önler.
    add('keyboard-input', 'blur', (e) => {
        // State'i güncellemek için ORİJİNAL (kırpılmamış) değeri kullan.
        const rawTextInput = e.target.value; 
        
        // Sadece input'ta gerçekten bir metin varsa state'i güncelle.
        if (rawTextInput) {
            stateManager.setProblemSource({ type: 'text', data: rawTextInput });
            console.log(`✅ Klavye girdisi state'e kaydedildi: "${rawTextInput}"`);
        }
    });

    // --- CANVAS İÇİN DÜZELTİLMİŞ DİNLEYİCİLER ---
    const updateHandwritingButtonState = () => {
        setTimeout(() => {
            if (elements['recognizeHandwritingBtn'] && elements['question-setup-area']) {
                // YENİ MANTIK: Butonun aktif olması için hem alanın kilitli OLMAMASI hem de canvas'ın dolu olması gerekir.
                const isAreaLocked = elements['question-setup-area'].classList.contains('disabled-area');
                const canvasIsEmpty = isCanvasEmpty(canvasManager.toDataURL('handwritingCanvas'));
                elements['recognizeHandwritingBtn'].disabled = isAreaLocked || canvasIsEmpty;
            }
        }, 100);
    };

    // Kullanıcı çizim yapmayı bitirdiğinde (fareyi veya parmağını kaldırdığında)
    add('handwritingCanvas', 'mouseup', updateHandwritingButtonState);
    add('handwritingCanvas', 'touchend', updateHandwritingButtonState);

    // Temizle butonuna basıldığında
    add('hw-clear-btn', 'click', () => {
        canvasManager.clear('handwritingCanvas');
        updateHandwritingButtonState(); // Durumu kontrol et
    });

    // Geri Al butonuna basıldığında
    add('hw-undo-btn', 'click', () => {
        canvasManager.undo('handwritingCanvas');
        updateHandwritingButtonState(); // Durumu kontrol et
    });
    // --- DÜZELTMELERİN SONU ---

    // --- TEMEL NAVİGASYON BUTONLARI ---
    add('logout-btn', 'click', AuthManager.logout);
    add('new-question-btn', 'click', async () => {
        await showTemporaryMessage('Sistem sıfırlanıyor...', '🧹', 1200);
        resetForNewProblem();
        stateManager.setView('setup');
    });
    add('goBackBtn', 'click', () => {
        resetToSummary();
    });
    

   

    // Kullanıcı çizim yapmayı bitirdiğinde (fareyi veya parmağını kaldırdığında)
    add('handwritingCanvas', 'mouseup', updateHandwritingButtonState);
    add('handwritingCanvas', 'touchend', updateHandwritingButtonState);

    // --- MEVCUT DİNLEYİCİLERİ GÜNCELLE ---

    // Temizle butonuna basıldığında
    add('hw-clear-btn', 'click', () => {
        canvasManager.clear('handwritingCanvas');
        updateHandwritingButtonState(); // Durumu kontrol et
    });

    // Geri Al butonuna basıldığında
    add('hw-undo-btn', 'click', () => {
        canvasManager.undo('handwritingCanvas');
        updateHandwritingButtonState(); // Durumu kontrol et
    });

    // --- SORU GİRİŞ AYARLARI ---
    add('photo-mode-btn', 'click', () => stateManager.setInputMode('photo'));
    add('handwriting-mode-btn', 'click', () => stateManager.setInputMode('handwriting'));
    add('switchToCanvasBtn', 'click', () => stateManager.setHandwritingInputType('canvas'));
    add('switchToKeyboardBtn', 'click', () => stateManager.setHandwritingInputType('keyboard'));
    
    // --- KRİTİK DÜZELTME BURADA ---
    // Butonlar artık sadece handleNewProblem'ı parametresiz olarak tetikliyor.
    add('startFromPhotoBtn', 'click', handleNewProblem);
    add('recognizeHandwritingBtn', 'click', handleNewProblem);
    add('startFromTextBtn', 'click', handleNewProblem);
    // --- DÜZELTME SONU ---


    add('start-solving-workspace-btn', 'click', async () => {
        const messages = ['Akıllı mentöre bağlanılıyor...', 'Sohbet arayüzü hazırlanıyor...'];
        await showTemporaryMessage(messages, '🧠', 1500);
        stateManager.setView('solving');
    });

    add('show-full-solution-btn', 'click', async () => {
        await showTemporaryMessage('Tüm çözüm adımları getiriliyor...', '📜', 2000);
        stateManager.setView('fullSolution');
    });

    add('solve-all-btn', 'click', async () => {
        const messages = ['Seçenekler taranıyor...', 'İnteraktif arayüz çiziliyor...'];
        await showTemporaryMessage(messages, '🧩', 1500);
        stateManager.setView('interactive');
    });


    // --- DİĞER EVENT'LER ---
    add('hw-pen-btn', 'click', () => setQuestionCanvasTool('pen', ['hw-pen-btn', 'hw-eraser-btn']));
    add('hw-eraser-btn', 'click', () => setQuestionCanvasTool('eraser', ['hw-pen-btn', 'hw-eraser-btn']));
    add('hw-clear-btn', 'click', () => canvasManager.clear('handwritingCanvas'));
    add('hw-undo-btn', 'click', () => canvasManager.undo('handwritingCanvas'));
    add('selectFileBtn', 'click', () => elements['imageUploader'].click());
    add('takePhotoBtn', 'click', takePicture);
    
    // 🎯 Hızlı çekim modunu etkinleştir
    
    
    // 🎯 Kamera yardım butonu
    
    add('imageUploader', 'change', (e) => handleFileSelect(e.target.files[0]));
    add('cameraUploader', 'change', (e) => handleFileSelect(e.target.files[0]));
    add('changePhotoBtn', 'click', () => {
        // Sadece merkezi durumu temizle. Arayüzün nasıl güncelleneceğine renderApp karar verir.
        stateManager.setProblemSource(null);
    });

    // Event Delegation: Dinamik olarak oluşturulan butonlar için
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        // "Ana Menüye Dön" butonu (farklı yerlerdeki)
        if (target.id === 'back-to-main-menu-btn' || target.id === 'failure-back-to-menu-btn') {
            resetToSummary(); // Güvenli fonksiyona yönlendirildi.
        }

        // Çözüm tamamlandıktan sonra çıkan "Yeni Problem" butonu
        if (target.id === 'interactive-new-problem-btn' || target.id === 'guide-new-problem-btn') {
            resetForNewProblem(); // <-- DOĞRU FONKSİYON KULLANILIYOR
            stateManager.setView('setup');
        }
    });
}
// --- AKILLI REHBER FONKSİYONLARI ---
async function initializeSmartGuide() {
    try {
        const solutionData = stateManager.getStateValue('problem').solution;

        if (!solutionData) {
            throw new Error('Çözüm verisi bulunamadı');
        }

        showLoading("İnteraktif çözüm başlatılıyor...");

        await smartGuide.initializeGuidance(solutionData);
        stateManager.setView('solving');

        showSuccess("İnteraktif çözüm hazır! Adım adım çözüme başlayabilirsiniz.");

    } catch (error) {
        errorHandler.handleError(error, {
            operation: 'initializeSmartGuide',
            fallbackMessage: 'İnteraktif çözüm başlatılamadı'
        });
        showError("İnteraktif çözüm başlatılırken bir hata oluştu. Lütfen tekrar deneyin.", false);
    } finally {
        showLoading(false);
    }
}



// --- PERFORMANS OPTİMİZASYONU: ÖN YÜKLEME (PRE-RENDERING) ---
const preRenderedCache = new Map(); // Render edilmiş HTML'i hafızada tutmak için.

async function preRenderSolutionViews(solution) {
    if (!solution) return;

    console.log('🚀 Performans Optimizasyonu: Arka planda render işlemleri başlatılıyor...');

    if (preRenderedCache.has('fullSolution') && preRenderedCache.has('interactive')) {
        console.log('✅ Görünümler zaten önceden render edilmiş. Atlanıyor.');
        return;
    }

    // --- "Tüm Çözüm" Ön Yüklemesi ---
    const fullSolutionPromise = (async () => {
        if (preRenderedCache.has('fullSolution')) return;

        // 1. Geçici bir container oluştur.
        const container = document.createElement('div');
        container.innerHTML = generateSolutionHTML(solution);

        // 2. GÖRÜNMEZ HALE GETİR ve DOM'A EKLE (KRİTİK ADIM)
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '0px';
        container.style.visibility = 'hidden'; // Önce gizle, renderContainer içinde görünür olacak
        document.body.appendChild(container);

        try {
            // 3. RENDER ET (Artık DOM'da olduğu için ölçüm yapabilir)
            await globalRenderManager.renderContainer(container);
            preRenderedCache.set('fullSolution', container.innerHTML);
            console.log('✅ Arka Plan: "Tüm Çözüm" render edildi ve cache\'lendi.');
        } catch (error) {
            console.error('❌ "Tüm Çözüm" ön yüklemesi başarısız:', error);
        } finally {
            // 4. GARANTİLİ TEMİZLİK: İşlem bitince elementi DOM'dan kaldır.
            document.body.removeChild(container);
        }
    })();

    // --- "İnteraktif Çözüm" Ön Yüklemesi (Aynı mantık) ---
    const interactivePromise = (async () => {
        if (preRenderedCache.has('interactive')) return;

        interactiveSolutionManager.initializeInteractiveSolution(solution);
        const firstStepData = interactiveSolutionManager.generateStepOptions(0);
        
        const container = document.createElement('div');
        container.innerHTML = generateInteractiveHTML(firstStepData);

        // DOM'a ekle
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '0px';
        container.style.visibility = 'hidden';
        document.body.appendChild(container);

        try {
            // Render et
            await globalRenderManager.renderContainer(container);
            preRenderedCache.set('interactive', container.innerHTML);
            console.log('✅ Arka Plan: "İnteraktif Çözüm" render edildi ve cache\'lendi.');
        } catch(error) {
            console.error('❌ "İnteraktif Çözüm" ön yüklemesi başarısız:', error);
        } finally {
            // Temizle
            document.body.removeChild(container);
        }
    })();

    await Promise.allSettled([fullSolutionPromise, interactivePromise]);
}
// www/js/pages/index.js -> updateUserDashboard için NİHAİ ve EKSİKSİZ VERSİYON

function updateUserDashboard(user) {
    if (!user) return;

    // Elementlerin var olup olmadığını kontrol et
    const headerSubtitleEl = elements['header-subtitle'];
    const queryCountEl = elements['query-count'];
    const queryLabelEl = elements['query-label']; 

    if (!headerSubtitleEl || !queryLabelEl || !queryCountEl) {
        console.error("Dashboard elementlerinden biri (başlık, etiket veya sayaç) bulunamadı!");
        return;
    }
    
    headerSubtitleEl.textContent = `Hoş geldin, ${user.displayName}!`;
    
    const sub = user.subscription || { tier: 'free' };

    // DURUM 1: Kullanıcı bir aboneliğe sahip (Öğrenci veya Premium)
    if (sub.tier !== 'free') {
        const remainingMonthly = (sub.monthlyQueryLimit || 0) - (sub.monthlyQueryCount || 0);
        queryLabelEl.textContent = 'Aylık Hakkınız: ';
        queryCountEl.textContent = `${remainingMonthly} / ${sub.monthlyQueryLimit || 0}`;
    } 
    // DURUM 2: Kullanıcı ücretsiz planda
    else {
        const remainingTokens = user.tokenQueries || 0;
        const dailyText = `Ücretsiz (Bugün): ${user.dailyQueryCount || 0} / 3`;
        
        // Eğer kullanıcının jetonu varsa, onu da göster
        const tokenText = ` | Jeton: ${remainingTokens}`;
        
        queryLabelEl.textContent = 'Kalan Haklarınız: ';
        queryCountEl.textContent = dailyText + (remainingTokens > 0 ? tokenText : '');
    }

    // Butonların görünürlüğünü yönetme
    // Yeni stratejimize göre, tüm kullanıcılar tüm butonları görür.
    // Kullanıcıyı engelleyecek olan şey, sorgu hakkı limitidir.
    if (elements['start-solving-workspace-btn']) {
        elements['start-solving-workspace-btn'].classList.remove('hidden');
    }
    if (elements['solve-all-btn']) {
        elements['solve-all-btn'].classList.remove('hidden');
    }
}
async function renderApp(state) {
    const { user, ui, problem } = state;
    const { view } = ui; // Mevcut görünümü bir değişkene alalım.
    console.log('renderApp executed, current view:', view);

    // 1. Kullanıcı ve Yükleme Durumlarını Yönet (Değişiklik yok)
    if (user) {
        updateUserDashboard(user);
    }
    if (ui.isLoading) {
        showLoading(ui.loadingMessage || "Yükleniyor...");
    } else {
        showLoading(false);
    }
    if (ui.error) {
        showError(ui.error, true, () => stateManager.clearError());
    }

    // --- YENİ VE DAHA SAĞLAM GÖRÜNÜRLÜK MANTIĞI ---

    // Hangi görünümde hangi elementlerin görüneceğini tanımlayan bir harita oluşturalım.
    const visibilityMap = {
        'question-setup-area': true,
        'question-summary-container': ['summary', 'fullSolution', 'interactive', 'solving'].includes(view),
        'top-action-buttons': ['summary'].includes(view),
        'solving-workspace': ['solving'].includes(view),
        'result-container': ['fullSolution', 'interactive'].includes(view),
        'solution-output': ['fullSolution', 'interactive'].includes(view),
        'goBackBtn': ['fullSolution', 'interactive', 'solving'].includes(view)
    };

    // Bu haritaya göre tüm elementlerin görünürlüğünü ayarla.
    Object.keys(visibilityMap).forEach(id => {
        if (elements[id]) {
            elements[id].classList.toggle('hidden', !visibilityMap[id]);
        }
    });

    if (elements['question-setup-area']) {
        const isSetupView = view === 'setup';
        // Bir işlem devam ediyor mu veya artık kurulum ekranında değil miyiz?
        const shouldBeDisabled = !isSetupView || ui.isLoading;

        // 1. Ana kurulum alanını pasifleştir (Mevcut kodun aynısı)
        elements['question-setup-area'].classList.toggle('disabled-area', shouldBeDisabled);

        // 2. Mod değiştirme butonlarını doğrudan hedef alarak pasifleştir (YENİ EKLENEN KISIM)
        const photoModeBtn = elements['photo-mode-btn'];
        const handwritingModeBtn = elements['handwriting-mode-btn'];

        if (photoModeBtn && handwritingModeBtn) {
            // Butonların tıklanmasını engelle
            photoModeBtn.disabled = shouldBeDisabled;
            handwritingModeBtn.disabled = shouldBeDisabled;

            // Görsel olarak da pasif olduklarını belirtmek için bir sınıf ekle
            photoModeBtn.classList.toggle('disabled-btn', shouldBeDisabled);
            handwritingModeBtn.classList.toggle('disabled-btn', shouldBeDisabled);
        }

        // 3. Canvas ve klavye girdisini yönet (Mevcut kodun aynısı)
        if (shouldBeDisabled) {
            canvasManager.lock('handwritingCanvas');
        } else {
            canvasManager.unlock('handwritingCanvas');
        }

        if (elements['keyboard-input']) {
            elements['keyboard-input'].readOnly = shouldBeDisabled;
        }
    }

    
    if (problem.source) {
        if (problem.source.type === 'image') {
            // Resim kaynağı varsa, önizlemeyi göster
            elements['imagePreview'].src = problem.source.data;
            elements['preview-container'].classList.remove('hidden');
            elements['upload-selection'].classList.add('hidden');
            elements['startFromPhotoBtn'].disabled = false;
        } else if (problem.source.type === 'text') {
            // Metin kaynağı varsa, metin alanını doldur
            elements['keyboard-input'].value = problem.source.data;
        }
    } else {
        // Kaynak yoksa, giriş alanını temizle (Sadece RESET durumunda çalışır)
        clearInputAreas();
    }
    // --- GÖRÜNÜRLÜK MANTIĞI SONU ---


    // 3. Mevcut Görünüme Göre İçerikleri Çiz
    try {
        // Çözüm verisi gerektiren görünümler için ortak kontrol
        if (['summary', 'fullSolution', 'interactive', 'solving'].includes(view) && !problem.solution) {
            console.error(`'${view}' görünümü için çözüm verisi bulunamadı. Setup'a yönlendiriliyor.`);
            stateManager.setView('setup');
            return;
        }
        if (elements['solution-output']) {
            elements['solution-output'].innerHTML = '';
        }
        switch (view) {
            case 'setup':
                await renderSetupView(ui.inputMode, ui.handwritingInputType);
                break;

            case 'summary':
                await displayQuestionSummary(problem.solution.problemOzeti);
                preRenderSolutionViews(problem.solution);
                break;

            case 'fullSolution':
                // Önce sorunun özetini göster (isteğe bağlı ama iyi bir pratik)
                await displayQuestionSummary(problem.solution.problemOzeti);
                // Yeni ve sadeleştirilmiş fonksiyonumuzu çağır.
                await renderFullSolution(problem.solution);
                break;

            case 'interactive':
                // Sadece interaktif çözümü render etmeye odaklan
                await displayQuestionSummary(problem.solution.problemOzeti);
                
                // --- YENİ VE DURUMA DUYARLI RENDER MANTIĞI ---
                
                // Önce yöneticinin başlatıldığından emin ol (yeni "akıllı" fonksiyonumuz ile)
                interactiveSolutionManager.initializeInteractiveSolution(problem.solution);

                if (interactiveSolutionManager.isCompleted) {
                    // DURUM 1: Çözüm daha önceden başarıyla tamamlanmış.
                    console.log('RENDER: İnteraktif çözüm "Tamamlandı" ekranı çiziliyor.');
                    await displayInteractiveCompletion(interactiveSolutionManager.getCompletionStats());
                } else if (interactiveSolutionManager.isFailed) {
                    // DURUM 2: Deneme hakları daha önceden bitmiş.
                    console.log('RENDER: İnteraktif çözüm "Başarısız" ekranı çiziliyor.');
                    await displayInteractiveFailure();
                } else {
                    // DURUM 3: Oturum devam ediyor. Kaldığı yerden devam et.
                    console.log(`RENDER: İnteraktif çözüm ${interactiveSolutionManager.currentStep}. adımdan devam ediyor.`);
                    const stepOptionsToRender = interactiveSolutionManager.generateStepOptions(interactiveSolutionManager.currentStep);
                    await renderInteractiveStepSafe(stepOptionsToRender);
                }
                break;

            case 'solving':
                // Her durumda özeti gösterelim.
                await displayQuestionSummary(problem.solution.problemOzeti);

                // YENİ VE DAHA AKILLI KONTROL MANTIĞI
                if (smartGuide.finalState) {
                    // DURUM 1: OTURUM BİTMİŞ (KİLİTLİ)
                    // Eğer bir finalState varsa, oturum bitmiş demektir. Tartışmasız.
                    // Arayüzü kilitli modda çiz ve başka hiçbir şey yapma.
                    console.log("🧠 Akıllı Rehber oturumu daha önceden tamamlanmış. Kilitli görünüm yükleniyor.");
                    renderLockedMentorView();

                } else if (!smartGuide.isSessionActive) {
                    // DURUM 2: OTURUM HİÇ BAŞLAMAMIŞ
                    // Oturum bitmemiş AMA aktif de değil. Demek ki yeni başlıyor.
                    // O zaman initialize et.
                    console.log("🧠 Akıllı Rehber için YENİ bir oturum başlatılıyor...");
                    await smartGuide.initializeGuidance(problem.solution);
                    await renderSmartGuideWorkspace();

                } else {
                    // DURUM 3: OTURUM DEVAM EDİYOR
                    // Diğer tüm durumlar, oturumun aktif olduğu ve devam ettiği anlamına gelir.
                    // Sadece arayüzü yeniden çiz, state'e dokunma.
                    console.log("🧠 Mevcut Akıllı Rehber oturumuna geri dönülüyor.");
                    await renderSmartGuideWorkspace();
                }
                break;

            default:
                console.warn('Bilinmeyen view:', view);
        }
    } catch (error) {
        console.error(`'${view}' görünümü render edilirken hata oluştu:`, error);
        showError('Arayüz yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.', true, () => {
            stateManager.reset();
            stateManager.setView('setup');
        });
    }
}


function showSolutionContainers() {
    if (elements['result-container']) {
        elements['result-container'].classList.remove('hidden');
        elements['result-container'].style.display = 'block';
    }
    
    if (elements['solution-output']) {
        elements['solution-output'].classList.remove('hidden');
        elements['solution-output'].style.display = 'block';
    }
}

function hideSolutionContainers() {
    if (elements['result-container']) {
        elements['result-container'].classList.add('hidden');
    }
    
    if (elements['solution-output']) {
        elements['solution-output'].classList.add('hidden');
    }
}

// www/js/pages/index.js -> renderSetupView fonksiyonunu bununla değiştirin.

async function renderSetupView(inputMode, handwritingInputType) {
    const isPhoto = inputMode === 'photo';
    
    // Photo/Handwriting mode toggle
    if (elements['photo-mode-container']) {
        elements['photo-mode-container'].classList.toggle('hidden', !isPhoto);
    }
    if (elements['handwriting-mode-container']) {
        elements['handwriting-mode-container'].classList.toggle('hidden', isPhoto);
    }
    if (elements['photo-mode-btn']) {
        elements['photo-mode-btn'].classList.toggle('mode-btn-active', isPhoto);
    }
    if (elements['handwriting-mode-btn']) {
        elements['handwriting-mode-btn'].classList.toggle('mode-btn-active', !isPhoto);
    }

    // Handwriting sub-modes (canvas vs keyboard)
    if (!isPhoto) {
        const showCanvas = handwritingInputType === 'canvas';
        
        if (elements['handwriting-canvas-container']) {
            elements['handwriting-canvas-container'].classList.toggle('hidden', !showCanvas);
        }
        if (elements['keyboard-input-container']) {
            elements['keyboard-input-container'].classList.toggle('hidden', showCanvas);
        }
        
        // Canvas setup
        if (showCanvas && canvasManager) {
            setTimeout(() => {
                canvasManager.resizeCanvas('handwritingCanvas');
                const data = canvasManager.canvasPool.get('handwritingCanvas');
                if (data) {
                    // !!! DÜZELTME: BU SATIR KALDIRILDI -> data.ctx.clearRect(0, 0, data.canvas.width, data.canvas.height);
                    canvasManager.applyDrawingSettings('handwritingCanvas');
                }
            }, 100);
        }
    }
}



// Input alanlarını temizleme fonksiyonu (gerekirse ekleyin)
function clearInputAreas() {
    console.log('🧹 Clearing input areas...');
    
    // Klavye input'unu temizle
    const keyboardInput = document.getElementById('keyboard-input');
    if (keyboardInput) {
        keyboardInput.value = '';
    }
    
    // Fotoğraf preview'ını temizle
    const imagePreview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('preview-container');
    const uploadSelection = document.getElementById('upload-selection');
    const startFromPhotoBtn = document.getElementById('startFromPhotoBtn');
    
    if (imagePreview) imagePreview.src = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (uploadSelection) uploadSelection.classList.remove('hidden');
    if (startFromPhotoBtn) startFromPhotoBtn.disabled = true;
    
    // File input'ları temizle
    const imageUploader = document.getElementById('imageUploader');
    const cameraUploader = document.getElementById('cameraUploader');
    if (imageUploader) imageUploader.value = '';
    if (cameraUploader) cameraUploader.value = '';
    
    console.log('✅ All input areas cleared');
}


// www/js/pages/index.js -> Bu fonksiyonu mevcut olanla tamamen değiştirin

async function handleNewProblem() {
    // --- GÜVENLİK KİLİDİ BAŞLANGICI ---
    if (isProcessingNewProblem) {
        console.warn("Zaten bir problem işleniyor, lütfen bekleyin.");
        showTemporaryMessage("Lütfen mevcut işlemin bitmesini bekleyin...", "⏳", 1500);
        return;
    }
    
    isProcessingNewProblem = true;
    if (elements['recognizeHandwritingBtn']) elements['recognizeHandwritingBtn'].disabled = true;
    if (elements['startFromTextBtn']) elements['startFromTextBtn'].disabled = true;
    if (elements['startFromPhotoBtn']) elements['startFromPhotoBtn'].disabled = true;
    if (elements['switchToCanvasBtn']) elements['switchToCanvasBtn'].disabled = true;
    if (elements['switchToKeyboardBtn']) elements['switchToKeyboardBtn'].disabled = true;
    if (elements['photo-mode-btn']) elements['photo-mode-btn'].disabled = true;
    if (elements['handwriting-mode-btn']) elements['handwriting-mode-btn'].disabled = true;

    stateManager.setLoading(true, 'Soru analiz ediliyor...');
    // --- GÜVENLİK KİLİDİ SONU ---

    let animationPromise;

    try {
        const state = stateManager.state;
        const userData = state.user;
        let problemSource = null;

        const currentInputMode = state.ui.inputMode;
        if (currentInputMode === 'photo') {
            problemSource = state.problem.source;
        } else if (currentInputMode === 'handwriting') {
            const isCanvasVisible = elements['handwriting-canvas-container'] && !elements['handwriting-canvas-container'].classList.contains('hidden');
            if (isCanvasVisible) {
                const canvasDataUrl = canvasManager.toDataURL('handwritingCanvas');
                if (canvasDataUrl && !isCanvasEmpty(canvasDataUrl)) {
                    problemSource = { type: 'image', data: canvasDataUrl };
                }
            } else {
                const textInput = elements['keyboard-input'].value.trim();
                if (textInput) {
                    problemSource = { type: 'text', data: textInput };
                }
            }
        }

        if (!problemSource || !problemSource.data) {
            showError("Lütfen çözmek için bir soru girin, çizin veya fotoğrafını yükleyin.", false);
            return;
        }
        
        const sub = userData.subscription || { tier: 'free' };
        const hasTokens = (userData.tokenQueries || 0) > 0;
        const hasDailyQueries = (userData.dailyQueryCount || 0) < 3;
        const hasSubscriptionQueries = sub.tier !== 'free' && (sub.monthlyQueryCount < sub.monthlyQueryLimit);

        if (!hasTokens && !hasDailyQueries && !hasSubscriptionQueries) {
            showErrorWithAdOption(
                "Tüm Sorgu Haklarınız Bitti!",
                "Reklam izleyerek 1 kredi kazanabilir veya premium'a geçerek sınırları kaldırabilirsiniz."
            );
            return;
        }

        stateManager.setProblemSource(problemSource);
        const loadingMessages = ['Çözüm stratejisi belirleniyor...','Adımlar oluşturuluyor...','Son kontroller yapılıyor...','Soru Özeti Gösteriliyor...'];
        const problemContextForPrompt = (problemSource.type === 'text') ? problemSource.data : "Görseldeki matematik problemini çöz.";
        const imageBase64 = (problemSource.type === 'image') ? problemSource.data.split(',')[1] : null;

        // --- AKILLI HATA YÖNETİMİ BURADA BAŞLIYOR ---
        const apiCallPromise = getUnifiedSolution(problemContextForPrompt, imageBase64);
        animationPromise = showTemporaryMessage(loadingMessages, '⚙️', 2000);

        const [unifiedSolution] = await Promise.all([apiCallPromise, animationPromise]);

        if (!unifiedSolution) {
            throw new Error("API'den bir yanıt alınamadı. Lütfen internet bağlantınızı kontrol edin.");
        }

        // Eğer API soruyu "matematik değil" olarak işaretlediyse, hata fırlatmak yerine kullanıcıyı bilgilendir.
        if (unifiedSolution._fallback === true || unifiedSolution._error) {
            const userMessage = unifiedSolution.problemOzeti?.istenen || "Bu soru bir matematik problemi olarak anlaşılamadı. Lütfen daha net bir soru sorun.";
            showError(userMessage, false); // Kullanıcıya mesajı göster
            return; // Fonksiyondan çık, sistemi sıfırlama!
        }
        // --- AKILLI HATA YÖNETİMİ SONU ---

        const updatedUserData = await FirestoreManager.getUserData(auth.currentUser);
        if (updatedUserData) stateManager.setUser(updatedUserData);

        globalRenderManager.setSolutionMetadata(unifiedSolution);
        stateManager.setSolution(unifiedSolution);
        stateManager.setView('summary');
        showSuccess(`Soru başarıyla analiz edildi!`, true, 4000);

    } catch (error) {
        if(animationPromise) await animationPromise;
        console.error("handleNewProblem içinde bir hata oluştu:", error);
        showError(error.message || "Beklenmedik bir sorun oluştu.", true, resetForNewProblem);
        resetForNewProblem(); 
    } finally {
        isProcessingNewProblem = false;
        stateManager.setLoading(false);
        
        const currentState = stateManager.state.ui.view;
        if (currentState === 'setup') {
             if (elements['recognizeHandwritingBtn']) elements['recognizeHandwritingBtn'].disabled = isCanvasEmpty(canvasManager.toDataURL('handwritingCanvas'));
             if (elements['startFromTextBtn']) elements['startFromTextBtn'].disabled = (elements['keyboard-input'].value.trim() === '');
             if (elements['startFromPhotoBtn']) elements['startFromPhotoBtn'].disabled = !elements['imagePreview'].src;
        }
        console.log("✅ İşlem kilidi 'finally' bloğunda güvenli bir şekilde açıldı.");
    }
}

function isCanvasEmpty(dataUrl) {
    // GÜVENLİK KONTROLÜ: Eğer dataUrl null veya geçersiz bir değerse, boş kabul et.
    if (!dataUrl || typeof dataUrl !== 'string') {
        return true;
    }

    const marker = ';base64,';
    const base64Index = dataUrl.indexOf(marker);
    if (base64Index === -1) {
        return true;
    }

    const base64Data = dataUrl.substring(base64Index + marker.length);
    // Çok kısa bir base64 string'i (örn: 200 karakterden az) genellikle boş bir resmi temsil eder.
    return base64Data.length < 200; 
}
 

// www/js/pages/index.js -> watchAdForReward fonksiyonunu bununla değiştirin

async function watchAdForReward() {
    console.log("Reklam izleme akışı başlatıldı.");
    stateManager.setLoading(true, "Reklam hazırlanıyor...");

    try {
        const rewardEarned = await adManager.showRewardAd();

        if (rewardEarned) {
            stateManager.setLoading(true, "Ödülünüz işleniyor...");

            // Sunucudan güvenli bir şekilde ödülü iste
            const grantRewardFunction = httpsCallable(functions, 'grantAdReward');
            await grantRewardFunction();

            // Kullanıcı verisini ve arayüzü güncelle
            const updatedUserData = await FirestoreManager.getUserData(auth.currentUser);
            stateManager.setUser(updatedUserData);

            stateManager.setLoading(false);
            showSuccess("Tebrikler! 1 soru hakkı kazandınız.", true, 3000);
        } else {
            // Bu durum normalde listener'lar tarafından yakalanır ama her ihtimale karşı
            stateManager.setLoading(false);
            showError("Ödül kazanılamadı. Lütfen tekrar deneyin.", false);
        }
    } catch (error) {
        stateManager.setLoading(false);
        console.error("Reklam hatası:", error);
        showError("Reklam gösterilirken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.", false);
    }
}
/**
 * Kullanıcıya reklam veya premium seçeneği sunan özel bir hata mesajı gösterir.
 * @param {string} title Mesaj başlığı
 * @param {string} message Mesaj içeriği
 */
function showErrorWithAdOption(title, message) {
    const resultContainer = document.getElementById('result-container');
    const statusMessage = document.getElementById('status-message');

    if (!resultContainer || !statusMessage) return;

    resultContainer.classList.remove('hidden');
    statusMessage.classList.remove('hidden');
    statusMessage.className = 'flex items-center justify-center p-4';

    statusMessage.innerHTML = `
        <div class="p-6 bg-orange-100 text-orange-800 rounded-lg border border-orange-300 text-center shadow-lg max-w-md">
            <h4 class="font-bold text-lg mb-2">${title}</h4>
            <p class="text-sm mb-6">${message}</p>
            <div class="flex flex-col sm:flex-row gap-3">
                <button id="watch-ad-btn" class="btn bg-green-600 hover:bg-green-700 text-white flex-1">
                    Reklam İzle (+1 Hak)
                </button>
                <button id="go-premium-btn" class="btn bg-purple-600 hover:bg-purple-700 text-white flex-1">
                    Premium'a Geç
                </button>
            </div>
            <button id="close-error-btn" class="mt-4 text-xs text-gray-500 hover:underline">Kapat</button>
        </div>
    `;

    // Butonlara event listener ekle
    document.getElementById('watch-ad-btn').addEventListener('click', () => {
        statusMessage.innerHTML = '';
        statusMessage.classList.add('hidden');
        watchAdForReward();
    });
    document.getElementById('go-premium-btn').addEventListener('click', () => window.location.href = 'premium.html');
    document.getElementById('close-error-btn').addEventListener('click', () => {
        statusMessage.innerHTML = '';
        statusMessage.classList.add('hidden');
    });
}


async function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}
// www/js/pages/index.js
// ÖNCEKİ FONKSİYONU SİL VE BU TEMİZ VERSİYONU YAPIŞTIR:

async function takePicture() {
    try {
        const Camera = Capacitor.Plugins.Camera;
        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: true,
            resultType: 'DataUrl',
            source: 'Camera'
        });
        
        if (image && image.dataUrl) {
            const file = dataUrlToFile(image.dataUrl, `photo-${Date.now()}.jpg`);
            handleFileSelect(file);
        } else {
            showError("Kamera sonucu işlenemedi.", false);
        }
    } catch (error) {
        console.error("Kamera hatası:", error);
        if (!error.message.includes('User cancelled')) {
            showError("Kamera açılırken bir hata oluştu. Lütfen tekrar deneyin.", false);
        }
    }
}





// Capacitor'dan gelen DataUrl'i File nesnesine çeviren yardımcı fonksiyon
function dataUrlToFile(dataUrl, fileName) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, {type:mime});
}

async function handleFileSelect(file) {
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError("Dosya boyutu 5MB'dan büyük olamaz.", false);
        return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError("Sadece JPEG, PNG, GIF ve WebP dosyaları desteklenir.", false);
        return;
    }

     try {
        const fileDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
        });

        // DOM'u anında güncelle (görsel geri bildirim için)
        elements['imagePreview'].src = fileDataUrl;
        elements['preview-container'].classList.remove('hidden');
        elements['upload-selection'].classList.add('hidden');
        elements['startFromPhotoBtn'].disabled = false;

        // --- KRİTİK EKLEME: Girdiyi anında state'e kaydet ---
        stateManager.setProblemSource({ type: 'image', data: fileDataUrl });

    } catch (error) {
        showError("Dosya yüklenirken bir hata oluştu.", false);
    }
}

// --- CANVAS ARAÇLARI ---
// Ana soru sorma canvas'ı için araç ayarlama
function setQuestionCanvasTool(tool, buttonIds) {
    canvasManager.setTool('handwritingCanvas', tool);
    buttonIds.forEach(id => {
        elements[id].classList.remove('canvas-tool-active');
    });
    elements[`hw-${tool}-btn`].classList.add('canvas-tool-active');
}

// index.js

async function displayQuestionSummary(problemOzeti) {
    if (!problemOzeti) return;

    const { konu, verilenler, istenen } = problemOzeti;

    let summaryHTML = '<div class="problem-summary bg-blue-50 p-4 rounded-lg mb-4">';
    summaryHTML += '<h3 class="font-semibold text-blue-800 mb-3">Problem Özeti:</h3>';

    if (konu) {
        summaryHTML += `
            <div class="mb-3">
                <span class="bg-blue-100 text-blue-800 text-sm font-semibold me-2 px-3 py-1 rounded-full">
                    ${escapeHtml(konu)}
                </span>
            </div>
        `;
    }

    if (verilenler && verilenler.length > 0) {
        summaryHTML += '<div class="mb-2"><strong>Verilenler:</strong><ul class="list-disc list-inside ml-4">';
        verilenler.forEach((veri) => {
            // Elementin içi, render işlemi için boş bırakılıyor.
            summaryHTML += `<li class="smart-content" data-content="${escapeHtml(veri)}"></li>`;
        });
        summaryHTML += '</ul></div>';
    }

    if (istenen) {
        // Elementin içi, render işlemi için boş bırakılıyor.
        summaryHTML += `<div><strong>İstenen:</strong> <span class="smart-content" data-content="${escapeHtml(istenen)}"></span></div>`;
    }

    summaryHTML += '</div>';

    // 1. ADIM: HTML iskeletini DOM'a yerleştir.
    const container = elements['question'];
    await new Promise(resolve => requestAnimationFrame(resolve)); // Güvenli bekleme

    container.innerHTML = summaryHTML;

    // 2. ADIM: Genel render motoru yerine, her bir 'smart-content' elementini
    // manuel olarak bul ve 'renderMath' fonksiyonu ile tek tek işle.
    // Bu, render süreci üzerinde tam kontrol sağlar.
    const smartElements = container.querySelectorAll('.smart-content');
    const renderPromises = [];

    for (const el of smartElements) {
        const content = el.dataset.content;
        if (content) {
            // Her ihtimale karşı elementin içini temizle ve
            // 'renderMath' fonksiyonunu doğrudan çağırarak içeriği değiştir.
            el.innerHTML = ''; // Önemli: Elementin içinin boş olduğundan emin ol.
            renderPromises.push(renderMath(content, el, false)); // 'false' parametresi satır içi matematik olduğunu belirtir.
        }
    }

    // 3. ADIM: Tüm bireysel render işlemlerinin tamamlanmasını bekle.
    await Promise.all(renderPromises);
}


// www/js/pages/index.js -> Bu bölümü eskisiyle tamamen değiştirin.

/**
 * "KAPAN" OPERASYONU - NİHAİ ÇÖZÜM FONKSİYONU
 * "Tam Çözüm" görünümünü programatik olarak, element element inşa eder ve anında render eder.
 * Bu yöntem, innerHTML ve querySelector arasındaki zamanlama sorunlarını tamamen ortadan kaldırır.
 * @param {object} solution - İşlenecek çözüm verisi.
 */
async function renderFullSolution(solution) {
    console.log("🔥 'KAPAN' Operasyonu Başlatıldı: renderFullSolution (Nihai Versiyon)");

    // 1. ANA KONTEYNERİ HAZIRLA
    const solutionOutput = document.getElementById('solution-output');
    if (!solutionOutput) {
        console.error("AV KAÇTI: 'solution-output' konteyneri bulunamadı!");
        showError("Arayüz yüklenemedi. Lütfen sayfayı yenileyin.");
        return;
    }
    
    // Konteyneri her seferinde tamamen temizle ve görünür yap.
    solutionOutput.innerHTML = '';
    solutionOutput.classList.remove('hidden');

    // Ana başlık ve menü butonunu oluştur ve ekle.
    const headerContainer = document.createElement('div');
    headerContainer.className = 'flex justify-between items-center mb-4';
    headerContainer.innerHTML = `
        <h3 class="text-xl font-bold text-gray-800">Tam Çözüm</h3>
        <button id="back-to-main-menu-btn" class="btn btn-secondary !py-2 !px-3">Ana Menüye Dön</button>
    `;
    solutionOutput.appendChild(headerContainer);

    // Çözüm adımları yoksa bilgilendirme mesajı göster ve çık.
    if (!solution.adimlar || solution.adimlar.length === 0) {
        solutionOutput.innerHTML += `<div class="p-4 bg-yellow-100 text-yellow-800 rounded-lg">Çözüm adımları bulunamadı.</div>`;
        return;
    }

    // 2. ADIMLARI TEK TEK, PROGRAMATİK OLARAK İNŞA ET VE RENDER ET
    for (const [index, step] of solution.adimlar.entries()) {
        
        // --- Her bir çözüm adımı için ana "kart" elementi ---
        const stepElement = document.createElement('div');
        stepElement.className = 'solution-step p-4 mb-3 bg-white shadow-sm rounded-lg border border-gray-200';

        // --- Adım başlığı ---
        const stepHeader = document.createElement('div');
        stepHeader.className = 'step-header flex items-center gap-3 mb-4';
        stepHeader.innerHTML = `
            <div class="step-number w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold shadow-inner">
                ${index + 1}
            </div>
            <h4 class="font-semibold text-gray-800 text-lg">${escapeHtml(step.adimBasligi || `Adım ${index + 1}`)}</h4>
        `;
        stepElement.appendChild(stepHeader);
        
        const stepContent = document.createElement('div');
        stepContent.className = 'step-content space-y-4';

        // --- Adım Açıklaması (Metin) ---
        const combinedDescription = Array.isArray(step.adimAciklamasi) ? step.adimAciklamasi.join(' ') : step.adimAciklamasi;
        const descriptionElement = document.createElement('div');
        descriptionElement.className = 'step-description text-gray-700 smart-content';
        descriptionElement.dataset.content = combinedDescription || '';
        stepContent.appendChild(descriptionElement);

        // --- Matematiksel İşlem (LaTeX) ---
        if (step.cozum_lateks) {
            const mathContainer = document.createElement('div');
            mathContainer.className = 'math-container p-3 bg-slate-50 rounded-md border border-slate-200 shadow-inner';
            const latexElement = document.createElement('div');
            latexElement.className = 'latex-content text-center';
            latexElement.dataset.latex = step.cozum_lateks;
            mathContainer.appendChild(latexElement);
            stepContent.appendChild(mathContainer);
        }

        // --- İpucu ---
        if (step.ipucu) {
            const combinedHint = Array.isArray(step.ipucu) ? step.ipucu.join(' ') : step.ipucu;
            const hintContainer = document.createElement('div');
            hintContainer.className = 'step-hint p-3 bg-amber-50 rounded-lg border-l-4 border-amber-400';
            const hintContent = document.createElement('div');
            hintContent.className = 'smart-content step-hint-content flex-1 text-sm text-amber-800';
            hintContent.dataset.content = combinedHint || '';
            hintContainer.innerHTML = `<div class="flex items-start gap-3">
                <span class="text-amber-500 font-bold text-xl mt-[-2px]">💡</span>
            </div>`;
            hintContainer.querySelector('.flex').appendChild(hintContent);
            stepContent.appendChild(hintContainer);
        }
        
        stepElement.appendChild(stepContent);
        
        // Oluşturulan adım kartını ana konteynere ekle
        solutionOutput.appendChild(stepElement);
    }
    
    // 3. NİHAİ RENDER KOMUTU
    // Tüm HTML DOM'a eklendikten sonra, render motoruna genel bir tarama ve işleme komutu veriyoruz.
    try {
        console.log("DOM inşası tamamlandı. Nihai render komutu veriliyor...");
        await globalRenderManager.renderContainer(solutionOutput);
        console.log("✅ 'KAPAN' Operasyonu Başarıyla Tamamlandı.");
    } catch (error) {
        console.error("Nihai render sırasında kritik hata:", error);
        showError("Çözüm adımları gösterilirken bir render hatası oluştu.");
    }

    // 4. OLAY DİNLEYİCİLERİNİ BAĞLA
    setupFullSolutionEventListeners();
}

/**
 * "Tam Çözüm" ekranında dinamik olarak oluşturulan butonlar için olay dinleyicilerini kurar.
 */
function setupFullSolutionEventListeners() {
    const backToMainBtn = document.getElementById('back-to-main-menu-btn');
    if (backToMainBtn) {
        // Olası eski dinleyicileri temizlemek için butonu klonlayıp yerine koyuyoruz.
        const newBtn = backToMainBtn.cloneNode(true);
        backToMainBtn.parentNode.replaceChild(newBtn, backToMainBtn);

        newBtn.addEventListener('click', () => {
            // Bu fonksiyon, state'i SIFIRLAMADAN sadece ana menüye döner.
            resetToSummary();
        });
    }
}






// CSS animasyonları için stil ekle (eğer yoksa)
if (!document.getElementById('solution-animations')) {
    const style = document.createElement('style');
    style.id = 'solution-animations';
    style.textContent = `
        .loader {
            border-top-color: #3B82F6;
        }
        
        .solution-step {
            transition: all 0.3s ease;
        }
        
        .solution-step:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .opacity-0 {
            opacity: 0;
        }
        
        .opacity-100 {
            opacity: 1;
        }
        
        .transition-opacity {
            transition-property: opacity;
        }
        
        .duration-300 {
            transition-duration: 300ms;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .animate-spin {
            animation: spin 1s linear infinite;
        }
    `;
    document.head.appendChild(style);
}



// --- YENİ VE TEMİZ HALİ ---
async function renderInteractiveSolution(solution) {
    const container = elements['solution-output'];
    if (!container) return;
    // showLoading çağrıları kaldırıldı!

    // Cache'i kontrol et.
    if (preRenderedCache.has('interactive')) {
        console.log('⚡️ "İnteraktif Çözüm" cache\'den yüklendi!');
        container.innerHTML = preRenderedCache.get('interactive');
        // Yöneticiyi tekrar başlatmamız gerekebilir, çünkü state'i tutuyor.
        interactiveSolutionManager.initializeInteractiveSolution(solution);
        const firstStepData = interactiveSolutionManager.generateStepOptions(0);
        setupInteractiveEventListeners(firstStepData);
    } else {
        // Eğer cache'de yoksa, normal render süreci.
        console.log('⏳ "İnteraktif Çözüm" normal şekilde render ediliyor (cache boş)...');
        interactiveSolutionManager.initializeInteractiveSolution(solution);
        const stepOptionsToRender = interactiveSolutionManager.generateStepOptions(0);
        await renderInteractiveStepSafe(stepOptionsToRender);
    }
}

function forceShowContainers() {
    const containers = [
        'result-container',
        'solution-output'
    ];
    
    containers.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove('hidden');
            element.style.display = 'block';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
            console.log(`✅ Force shown: ${id}`);
        }
    });
}
// Güvenli DOM hazırlık bekleme
function waitForDOMReady() {
    return new Promise(resolve => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            setTimeout(resolve, 50); // Kısa gecikme
        }
    });
}
// index.js
// www/js/pages/index.js içine yeni fonksiyonlar ekleyin

/**
 * İnteraktif çözüm arayüzünün ana iskeletini SADECE BİR KEZ çizer.
 */
function buildInteractiveWorkspace() {
    const container = elements['solution-output'];
    if (!container) return false;

    container.innerHTML = `
        <div class="interactive-solution-workspace p-4 md:p-6 bg-white rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-gray-800">İnteraktif Çözüm</h3>
                <button id="back-to-main-menu-btn" class="btn btn-secondary !py-2 !px-3">Ana Menüye Dön</button>
            </div>
            
            <div class="progress-section mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="progress-info">
                        <div class="flex justify-between items-center mb-2">
                            <h4 id="interactive-step-counter" class="text-lg font-semibold text-gray-800">Adım Yükleniyor...</h4>
                            <span id="interactive-progress-percentage" class="text-sm text-gray-500"></span>
                        </div>
                        <div class="progress-bar bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div id="interactive-progress-fill" class="progress-fill bg-blue-500 h-full transition-all duration-500" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="attempt-info">
                        <div class="flex justify-end items-center gap-x-2 mb-2">
                            <h4 class="text-lg font-semibold text-gray-800">Deneme Hakkı:</h4>
                            <span id="interactive-attempt-counter" class="text-sm font-medium text-gray-500">Yükleniyor...</span>
                        </div>
                        <div id="interactive-attempt-dots" class="attempt-dots flex justify-end gap-1"></div>
                    </div>
                </div>
            </div>
            
            <div class="step-description mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 id="interactive-step-title" class="font-semibold text-blue-800 mb-2 flex items-center gap-2">Yükleniyor...</h4>
                <div class="text-blue-700 smart-content" id="interactive-step-desc"></div>
            </div>
            
            <div class="options-section mb-6">
                <h4 class="font-semibold text-gray-800 mb-4">Doğru çözüm adımını seçin:</h4>
                <div class="options-grid space-y-3" id="interactive-options-container"></div>
            </div>
            
            <div class="action-buttons flex flex-wrap gap-3 mb-4">
                <button id="interactive-submit-btn" class="btn btn-primary flex-1" disabled>Seçimi Onayla</button>
                <button id="interactive-hint-btn" class="btn btn-secondary">💡 İpucu</button>
            </div>
            <div id="interactive-result-container" class="result-section hidden mb-4"></div>
        </div>
    `;
    return true;
}
// www/js/pages/index.js içine ekleyin veya mevcut olanı kontrol edin

function enableInteractiveUI() {
    const submitBtn = document.getElementById('interactive-submit-btn');
    const optionLabels = document.querySelectorAll('.option-label');

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Seçimi Onayla';
    }

    optionLabels.forEach(label => {
        label.style.pointerEvents = 'auto';
        label.style.opacity = '1';
    });
}
// www/js/pages/index.js -> Bu fonksiyonu eskisiyle tamamen değiştirin

/**
 * Mevcut adım verisine göre interaktif arayüzü günceller. (Yeniden çizmez)
 */
async function updateInteractiveWorkspace(stepData) {
    // Statik elementleri ID'leri ile bul ve içeriklerini güncelle
    document.getElementById('interactive-step-counter').textContent = `Adım ${stepData.stepNumber} / ${stepData.totalSteps}`;
    document.getElementById('interactive-progress-percentage').textContent = `${Math.round((stepData.stepNumber / stepData.totalSteps) * 100)}% tamamlandı`;
    document.getElementById('interactive-progress-fill').style.width = `${(stepData.stepNumber / stepData.totalSteps) * 100}%`;
    document.getElementById('interactive-attempt-counter').textContent = `${stepData.remainingAttempts} / ${stepData.maxAttempts} kaldı`;
    document.getElementById('interactive-attempt-dots').innerHTML = generateAttemptDots(stepData.attempts, stepData.maxAttempts);
    
    const stepTitle = document.getElementById('interactive-step-title');
    stepTitle.innerHTML = `
        <span class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">${stepData.stepNumber}</span>
        Bu Adımda Yapılacak:
    `;

    // Matematiksel içerik barındıran kısımları güncelle ve render et
    const stepDescEl = document.getElementById('interactive-step-desc');
    stepDescEl.setAttribute('data-content', stepData.stepDescription);
    
    const optionsContainer = document.getElementById('interactive-options-container');
    optionsContainer.innerHTML = generateInteractiveOptions(stepData.options);

    // Sadece değişen kısımları render et
    await globalRenderManager.renderElement(stepDescEl, stepData.stepDescription);
    await globalRenderManager.renderContainer(optionsContainer);
    await new Promise(resolve => requestAnimationFrame(resolve));

    // --- KRİTİK DÜZELTME BURADA ---
    // Sonuç alanını temizle ve bir sonraki adıma hazırlık yap.
    document.getElementById('interactive-result-container').innerHTML = '';
    document.getElementById('interactive-result-container').classList.add('hidden');
    
    // Butonları ve seçenekleri tekrar tamamen aktif hale getir.
    enableInteractiveUI();
    
    // Kullanıcının yeni bir seçim yapmasını beklemek için butonu tekrar pasifleştir.
    // Metni doğru olduğu için artık kilitli görünmeyecek.
    const submitBtn = document.getElementById('interactive-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
    }
}

async function renderInteractiveStepSafe(stepData) {
    console.log('🔄 İnteraktif adım render/update başlıyor:', stepData);
    try {
        const workspace = document.querySelector('.interactive-solution-workspace');

        // Eğer arayüz iskeleti henüz DOM'da yoksa, önce onu oluştur.
        if (!workspace) {
            console.log("İnteraktif arayüz ilk kez oluşturuluyor.");
            if (!buildInteractiveWorkspace()) {
                throw new Error('İnteraktif arayüz iskeleti oluşturulamadı.');
            }
            // Olay dinleyicilerini sadece bir kez, iskelet oluşturulduğunda kur.
            setupInteractiveEventListeners(stepData); 
        }

        // Arayüzü yeni adım verileriyle doldur/güncelle.
        await updateInteractiveWorkspace(stepData);

        console.log('✅ İnteraktif adım başarıyla güncellendi.');
    } catch (error) {
        console.error('❌ Adım render/update hatası:', error);
        displayInteractiveError(`Arayüz güncellenirken bir hata oluştu: ${error.message}`);
    }
}

// ESKİ generateInteractiveHTML FONKSİYONUNUZU SİLİP BUNU YAPIŞTIRIN
function generateInteractiveHTML(stepData) {
    if (!stepData || !stepData.options) {
        console.error('❌ generateInteractiveHTML: stepData eksik');
        return '<div class="p-4 text-red-600">Adım verisi eksik</div>';
    }

    // --- NİHAİ ÇÖZÜM BURADA ---
    const combinedDescription = Array.isArray(stepData.stepDescription)
        ? stepData.stepDescription.join(' ')
        : stepData.stepDescription;

    const progress = (stepData.stepNumber / stepData.totalSteps) * 100;

    return `
        <div class="interactive-solution-workspace p-6 bg-white rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">...</div>
            <div class="progress-section mb-6">...</div>
            
            <div class="step-description mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 class="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <span class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">${stepData.stepNumber}</span>
                    Bu Adımda Yapılacak:
                </h4>
                <div class="smart-content text-blue-700" id="interactive-step-desc" data-content="${escapeHtml(combinedDescription || '')}"></div>
            </div>
            
            </div>
    `;
}
function generateAttemptDots(attempts, maxAttempts) {
    return Array.from({ length: maxAttempts }, (_, i) => `
        <div class="w-3 h-3 rounded-full ${i < attempts ? 'bg-red-400' : 'bg-gray-200'
        }"></div>
    `).join('');
}

// www/js/pages/index.js dosyasındaki bu fonksiyonu güncelleyin.

// js/pages/index.js

function generateInteractiveOptions(options) {
    if (!Array.isArray(options) || options.length === 0) {
        console.error('❌ generateInteractiveOptions: Geçersiz options');
        return '<div class="text-red-600 p-4">Seçenekler yüklenemedi</div>';
    }

    return options.map((option, index) => {
        const displayId = option.displayId !== undefined ? option.displayId : index;
        const optionLetter = String.fromCharCode(65 + index);
        const content = option.latex || (option.text || 'Seçenek içeriği eksik');

        // --- YENİ VE GELİŞTİRİLMİŞ STİL ---
        // 'option-label' sınıfı artık style.css dosyasındaki stilleri kullanacak.
        return `
            <label class="option-label" data-option-id="${displayId}">
                <input type="radio" 
                       name="interactive-step-options" 
                       value="${displayId}" 
                       class="sr-only option-radio">
                
                <div class="option-letter">
                    ${optionLetter}
                </div>
                
                <div class="option-content flex-1 text-lg">
                    <div class="text-gray-800 font-medium option-text smart-content" 
                         id="option-text-${displayId}"
                         data-content="${escapeHtml(content)}">
                        <span class="text-gray-400">Yükleniyor...</span>
                    </div>
                </div>
            </label>
        `;
    }).join('');
}
function validateInteractiveDOM() {
    const requiredElements = [
        'interactive-options-container',
        'interactive-submit-btn',
        'interactive-result-container'
    ];

    for (const elementId of requiredElements) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`❌ DOM doğrulaması başarısız: ${elementId} bulunamadı`);
            return false;
        }
    }

    // Seçenek sayısını kontrol et
    const optionsContainer = document.getElementById('interactive-options-container');
    const optionLabels = optionsContainer.querySelectorAll('.option-label');

    if (optionLabels.length === 0) {
        console.error('❌ DOM doğrulaması başarısız: Hiç seçenek bulunamadı');
        return false;
    }

    console.log(`✅ DOM doğrulaması başarılı: ${optionLabels.length} seçenek bulundu`);
    return true;
}

function validateOptionsRender() {
    const optionsContainer = document.getElementById('interactive-options-container');
    if (!optionsContainer) {
        console.error('❌ Options container bulunamadı');
        return false;
    }

    const optionLabels = optionsContainer.querySelectorAll('.option-label');
    console.log(`🔍 Render doğrulaması: ${optionLabels.length} seçenek render edildi`);

    // Her seçeneği kontrol et
    optionLabels.forEach((label, index) => {
        const optionId = label.dataset.optionId;
        const radio = label.querySelector('input[type="radio"]');
        const text = label.querySelector('.option-text');

        console.log(`🔍 Seçenek ${index}: ID=${optionId}, Radio=${!!radio}, Text=${!!text}`);
    });

    return optionLabels.length > 0;
}
function setupInteractiveEventListeners(stepData) {
    console.log('🔄 Event listener\'lar kuruluyor...');

    try {
        // Submit butonu
        const submitBtn = document.getElementById('interactive-submit-btn');
        if (submitBtn) {
            // Eski listener'ları temizle
            submitBtn.replaceWith(submitBtn.cloneNode(true));
            const newSubmitBtn = document.getElementById('interactive-submit-btn');

            newSubmitBtn.addEventListener('click', handleInteractiveSubmissionSafe);
            console.log('✅ Submit button listener kuruldu');
        }

        // Radio button'lar - DELEGATION İLE
        const optionsContainer = document.getElementById('interactive-options-container');
        if (optionsContainer) {
            // Eski listener'ları temizle
            optionsContainer.replaceWith(optionsContainer.cloneNode(true));
            const newOptionsContainer = document.getElementById('interactive-options-container');

            newOptionsContainer.addEventListener('change', function (event) {
                if (event.target.type === 'radio') {
                    handleOptionSelection(event);
                }
            });
            console.log('✅ Radio button listeners kuruldu (delegation)');
        }

        // Diğer butonlar
        setupOtherInteractiveButtons();

        console.log('✅ Tüm event listener\'lar başarıyla kuruldu');

    } catch (error) {
        console.error('❌ Event listener kurulum hatası:', error);
    }
}

function handleOptionSelection(event) {
    const selectedValue = event.target.value;
    const submitBtn = document.getElementById('interactive-submit-btn');

    console.log(`📝 Seçenek seçildi: ${selectedValue}`);

    // Submit butonunu aktif et
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Seçimi Onayla';
    }

    // Görsel feedback
    const optionLabels = document.querySelectorAll('.option-label');
    optionLabels.forEach(label => {
        label.classList.remove('border-blue-500', 'bg-blue-50');
    });

    const selectedLabel = event.target.closest('.option-label');
    if (selectedLabel) {
        selectedLabel.classList.add('border-blue-500', 'bg-blue-50');
    }
}

function setupOtherInteractiveButtons() {
    // Hint button
    const hintBtn = document.getElementById('interactive-hint-btn');
    if (hintBtn) {
        hintBtn.replaceWith(hintBtn.cloneNode(true));
        const newHintBtn = document.getElementById('interactive-hint-btn');
        newHintBtn.addEventListener('click', () => {
            const hint = interactiveSolutionManager.getHint();
            if (hint) {
                showInteractiveHint(hint);
            }
        });
    }

    

    // Back to main menu
    const backBtn = document.getElementById('back-to-main-menu-btn');
    if (backBtn) {
        backBtn.replaceWith(backBtn.cloneNode(true));
        const newBackBtn = document.getElementById('back-to-main-menu-btn');
        newBackBtn.addEventListener('click', () => {
            // HATA BURADAYDI: reset() yerine resetToSummary() kullanılmalı.
            // interactiveSolutionManager.reset(); <-- BU SATIRI SİLİN
            resetToSummary(); // <-- BU SATIRI EKLEYİN
        });
    }
}

function handleInteractiveReset() {
    console.log('🔄 İnteraktif sistem sıfırlanıyor...');

    interactiveSolutionManager.reset();

    if (window.stateManager) {
        window.stateManager.setView('setup');
    }

    // Success mesajı
    setTimeout(() => {
        if (window.showSuccess) {
            window.showSuccess("Yeni soru yükleyerek tekrar deneyebilirsiniz.", false);
        }
    }, 500);
}

// Hata gösterimi
function displayInteractiveError(message) {
    const solutionOutput = document.getElementById('solution-output');
    if (!solutionOutput) return;

    solutionOutput.innerHTML = `
        <div class="p-4 bg-red-50 text-red-700 rounded-lg">
            <h4 class="font-bold mb-2">İnteraktif Çözüm Hatası</h4>
            <p>${escapeHtml(message)}</p>
            <button id="back-to-main-menu-btn" class="btn btn-secondary mt-4">Ana Menüye Dön</button>
        </div>
    `;

    // Back button için listener
    const backBtn = document.getElementById('back-to-main-menu-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (window.stateManager) {
                window.stateManager.setView('summary');
            }
        });
    }
}

// js/pages/index.js

// Güvenli hint gösterimi
async function showInteractiveHint(hint) { // <-- Fonksiyonu async yapıyoruz
    const resultContainer = document.getElementById('interactive-result-container');
    if (!resultContainer) return;

    resultContainer.innerHTML = `
        <div class="hint-message p-4 rounded-lg bg-yellow-100 border border-yellow-300">
            <div class="flex items-center gap-3">
                <div class="text-2xl">💡</div>
                <div class="flex-1">
                    <h4 class="font-semibold text-yellow-800 mb-1">İpucu</h4>
                    
                    <p class="text-yellow-700 text-sm smart-content" data-content="${escapeHtml(hint.hint)}">
                        ${escapeHtml(hint.hint)}
                    </p>

                </div>
            </div>
        </div>
    `;

    resultContainer.classList.remove('hidden');

    // --- YENİ EKLENEN KOD ---
    // Konteyner içindeki matematiği render etmesi için render yöneticisini çağırıyoruz.
    await globalRenderManager.renderContainer(resultContainer);
    // --- YENİ KOD SONU ---


    // 5 saniye sonra gizle
    setTimeout(() => {
        resultContainer.classList.add('hidden');
        resultContainer.innerHTML = '';
    }, 5000);
}

// HTML escape helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// www/js/pages/index.js -> Bu fonksiyonu eskisiyle değiştirin

async function handleInteractiveSubmissionSafe() {
    // 1. Gerekli DOM elementlerini bul.
    const selectedRadio = document.querySelector('input[name="interactive-step-options"]:checked');
    
    // Seçim yapılmamışsa uyarı ver.
    if (!selectedRadio) {
        showError("Lütfen bir seçenek seçin.", false);
        return;
    }
    
    // 2. Arayüzü hemen pasifleştir.
    disableInteractiveUI();
    
    try {
        const selectedOptionId = parseInt(selectedRadio.value);
        const result = interactiveSolutionManager.evaluateSelection(selectedOptionId);
        
        if (!result || result.error) {
            showError(result ? result.error : "Değerlendirme sırasında bilinmeyen bir hata oluştu", false);
            // Hata durumunda UI'yı tekrar aktif et.
            enableInteractiveUI(); // <-- DÜZELTME 1: HATA DURUMU İÇİN EKLENDİ
            return;
        }
        
        // 3. Sonuç (Doğru/Yanlış) mesajını göster.
        await displayInteractiveResultSafe(result);
        
        // 4. Kullanıcının sonucu görmesi için 3 saniye bekle.
        setTimeout(async () => {
            if (interactiveSolutionManager.isCompleted) {
                await displayInteractiveCompletion(interactiveSolutionManager.getCompletionStats());
            } else if (interactiveSolutionManager.isFailed) {
                await displayInteractiveFailure();
            } else {
                const nextStepData = interactiveSolutionManager.generateStepOptions(interactiveSolutionManager.currentStep);
                await renderInteractiveStepSafe(nextStepData);
                // Yeni adım render edildikten sonra UI tekrar aktif hale gelecek,
                // enableInteractiveUI() burada dolaylı olarak çalışmış oluyor.
            }
        }, 3000);
        
    } catch (error) {
        console.error('❌ Submission handler hatası:', error);
        showError("İşlem sırasında beklenmeyen bir hata oluştu", false);
        // --- KRİTİK DÜZELTME 2: BEKLENMEDİK HATA DURUMU İÇİN ---
        // Eğer yukarıdaki blokta beklenmedik bir hata olursa,
        // UI'nın kilitli kalmaması için butonu burada da aktif et.
        enableInteractiveUI();
    }
    // NOT: `finally` bloğunu burada kullanmıyoruz çünkü 3 saniyelik bekleme süresi
    // senkronizasyonu bozabilir. Bunun yerine her hata yolunda `enableInteractiveUI` çağrısı
    // yapmak daha güvenlidir.
}

async function handleInteractiveForceReset(message) {
    console.log('🔄 ZORUNLU RESET BAŞLATILIYOR...', message);
    
    try {
        // 1. Kullanıcıya bilgi mesajı göster (engellemeyen)
        showResetNotification(message);
        
        // 2. Kısa bekleme (kullanıcının görmesi için)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. İnteraktif sistemi tamamen sıfırla
        interactiveSolutionManager.reset();
        console.log('✅ InteractiveSolutionManager reset');
        
        // 4. DOM'u temizle
        clearInteractiveDOM();
        console.log('✅ DOM cleared');
        
        // 5. State'i güvenli şekilde setup'a çevir
        if (window.stateManager) {
            // Sadece view değiştir, problem verilerini koru
            window.stateManager.setView('setup');
            console.log('✅ State set to setup');
        }
        
        // 6. Input alanlarını temizle
        setTimeout(() => {
            clearInputAreas();
            console.log('✅ Input areas cleared');
        }, 200);
        
        // 7. Container'ları gizle
        setTimeout(() => {
            hideInteractiveContainers();
            console.log('✅ Containers hidden');
        }, 300);
        
        // 8. Son kullanıcı bildirimi
        setTimeout(() => {
            if (window.showSuccess) {
                window.showSuccess(
                    "Yeni soru yükleyerek tekrar deneyebilirsiniz.", 
                    false
                );
            }
            console.log('✅ Final user notification shown');
        }, 1000);
        
        console.log('✅ ZORUNLU RESET BAŞARIYLA TAMAMLANDI');
        
    } catch (error) {
        console.error('❌ Force reset error:', error);
        
        // Fallback: Sayfa yenileme (son çare)
        if (confirm('Sistem sıfırlanırken bir hata oluştu. Sayfayı yenilemek ister misiniz?')) {
            window.location.reload();
        }
    }
}
function clearInteractiveDOM() {
    // Solution output'u temizle
    const solutionOutput = document.getElementById('solution-output');
    if (solutionOutput) {
        solutionOutput.innerHTML = '';
    }
    
    // Result container'ı temizle
    const resultContainer = document.getElementById('result-container');
    if (resultContainer) {
        resultContainer.classList.add('hidden');
    }
    
    // Status message'ı temizle
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.innerHTML = '';
    }
}

function hideInteractiveContainers() {
    const containerIds = [
        'result-container',
        'solution-output',
        'interactive-result-container'
    ];
    
    containerIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
            element.style.display = 'none'; // Force gizle
        }
    });
}
function showResetNotification(message) {
    const notification = document.createElement('div');
    notification.id = 'reset-notification';
    notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <div>
                <div class="font-semibold">Deneme Hakları Bitti</div>
                <div class="text-sm opacity-90">${message || 'Soru yükleme ekranına yönlendiriliyorsunuz...'}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 5 saniye sonra kaldır
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function handleInteractiveResetToSetup(message) {
    console.log('🔄 Setup\'a reset başlıyor...', message);
    
    // 1. İnteraktif sistemi sıfırla
    interactiveSolutionManager.reset();
    
    // 2. State'i sıfırla (problem'i koru, sadece view değiştir)
    if (window.stateManager) {
        // Problem verilerini koruyarak sadece view değiştir
        window.stateManager.setView('setup');
        console.log('✅ State manager - view set to setup');
    } else {
        console.error('❌ stateManager bulunamadı!');
    }
    
    // 3. Input alanlarını temizle
    setTimeout(() => {
        clearInputAreas();
        console.log('✅ Input areas cleared');
    }, 100);
    
    // 4. Kullanıcıya bilgi ver
    setTimeout(() => {
        if (window.showSuccess) {
            window.showSuccess(
                message || "Deneme haklarınız bitti. Yeni soru yükleyerek tekrar deneyebilirsiniz.", 
                false
            );
        }
        console.log('✅ User notification shown');
    }, 500);
    
    console.log('✅ Setup reset tamamlandı');
}


function disableInteractiveUI() {
    const submitBtn = document.getElementById('interactive-submit-btn');
    const optionLabels = document.querySelectorAll('.option-label');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Kontrol ediliyor...
        `;
    }

    optionLabels.forEach(label => {
        label.style.pointerEvents = 'none';
        label.style.opacity = '0.7';
    });
}



async function displayInteractiveResultSafe(result) {
    const resultContainer = document.getElementById('interactive-result-container');
    if (!resultContainer) {
        console.error('❌ Result container bulunamadı');
        return;
    }

    // Seçenekleri renklendir
    highlightInteractiveOptionsSafe(result);

    // Sonuç mesajı oluştur
    const resultHTML = generateResultHTML(result);
    resultContainer.innerHTML = resultHTML;
    resultContainer.classList.remove('hidden');

    // DÜZELTME: Render etmeden önce kısa bir gecikme ekleyerek DOM'un hazır olmasını bekle.
    await new Promise(resolve => requestAnimationFrame(resolve));
    await globalRenderManager.renderContainer(resultContainer);

    console.log('✅ Sonuç güvenli şekilde gösterildi ve render edildi');
}

// js/pages/index.js

function highlightInteractiveOptionsSafe(result) {
    const optionLabels = document.querySelectorAll('.option-label');

    optionLabels.forEach(label => {
        const optionId = parseInt(label.dataset.optionId);

        // Önceki animasyon ve vurgu sınıflarını temizle
        label.classList.remove('animate-correct', 'animate-incorrect', 'border-green-500', 'bg-green-50', 'border-red-500', 'bg-red-50', 'border-blue-500', 'bg-blue-50');

        if (optionId === result.selectedOption.displayId) {
            // Kullanıcının SEÇTİĞİ seçenek
            if (result.isCorrect) {
                // Doğru cevap: Yeşil vurgu ve "tada" animasyonu
                label.classList.add('border-green-500', 'bg-green-50', 'animate-correct');
            } else {
                // Yanlış cevap: Kırmızı vurgu ve "shake" animasyonu
                label.classList.add('border-red-500', 'bg-red-50', 'animate-incorrect');
            }
        } else if (result.correctOption && optionId === result.correctOption.displayId) {
            // Eğer seçim yanlışsa, DOĞRU olan seçeneği de sadece yeşil ile vurgula (animasyonsuz)
            if (!result.isCorrect) {
                label.classList.add('border-green-500', 'bg-green-50');
            }
        }
    });
}


function generateResultHTML(result) {
    if (result.isCorrect) {
        return `
            <div class="result-message success p-4 rounded-lg bg-green-100 border border-green-300">
                <div class="flex items-center gap-3">
                    <div class="text-3xl">✅</div>
                    <div class="flex-1">
                        <h4 class="font-semibold text-green-800 mb-1">Doğru!</h4>
                        
                        <p class="text-green-700 text-sm smart-content" data-content="${escapeHtml(result.explanation)}">${escapeHtml(result.explanation)}</p>
                        
                        ${result.isCompleted ? `
                            <div class="mt-3 p-3 bg-green-50 rounded border border-green-200">
                                <h5 class="font-semibold text-green-800 mb-2">🎉 Tebrikler! Tüm adımları tamamladınız!</h5>
                            </div>
                        ` : `
                            <p class="text-green-600 text-sm mt-2">
                                <strong>Sonraki adıma geçiliyor...</strong> (${result.currentStep}/${result.totalSteps})
                            </p>
                        `}
                    </div>
                </div>
            </div>
        `;
    } else {
        const isLastAttempt = result.shouldResetToSetup || result.remainingAttempts <= 0;
        const bgClass = isLastAttempt ? 'bg-red-100 border-red-300' : 'bg-orange-100 border-orange-300';
        const textClass = isLastAttempt ? 'text-red-800' : 'text-orange-800';

        return `
            <div class="result-message error p-4 rounded-lg ${bgClass} border">
                <div class="flex items-center gap-3">
                    <div class="text-3xl">${isLastAttempt ? '❌' : '⚠️'}</div>
                    <div class="flex-1">
                        <h4 class="font-semibold ${textClass} mb-1">
                            ${isLastAttempt ? 'Deneme Hakkınız Bitti!' : 'Yanlış Seçim'}
                        </h4>

                        <p class="${textClass} text-sm mb-2 smart-content" data-content="${escapeHtml(result.explanation)}">${escapeHtml(result.explanation)}</p>
                        
                        <div class="mt-2">
                            <p class="text-sm ${textClass}">
                                <strong>Kalan Hak:</strong> ${result.remainingAttempts}
                            </p>
                        </div>
                        
                        ${isLastAttempt ? `
                            <div class="mt-3 p-3 bg-red-50 rounded border border-red-200">
                                <p class="text-red-700 text-sm font-medium">
                                    Tüm deneme haklarınız bitti. Ana menüye yönlendiriliyorsunuz...
                                </p>
                            </div>
                        ` : `
                            <div class="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                                <p class="text-blue-700 text-sm">
                                    ${result.restartCurrentStep ?
                '🔄 Bu adımı tekrar çözeceksiniz.' :
                '🔄 Baştan başlayacaksınız.'
            }
                                </p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }
}





async function displayInteractiveCompletion(completionStats) {
    const container = elements['solution-output'];

    if (!container) return;

    // Performans mesajı
    let performanceMessage = '';
    let performanceColor = 'text-green-600';

    switch (completionStats.performance) {
        case 'excellent':
            performanceMessage = '🏆 Mükemmel performans! Çok az hatayla tamamladınız.';
            performanceColor = 'text-green-600';
            break;
        case 'good':
            performanceMessage = '👍 İyi performans! Başarıyla tamamladınız.';
            performanceColor = 'text-blue-600';
            break;
        case 'average':
            performanceMessage = '📚 Ortalama performans. Pratik yaparak gelişebilirsiniz.';
            performanceColor = 'text-yellow-600';
            break;
        case 'needs_improvement':
            performanceMessage = '💪 Daha fazla pratik yaparak gelişebilirsiniz.';
            performanceColor = 'text-orange-600';
            break;
    }

    container.innerHTML = `
        <div class="interactive-completion text-center p-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <div class="completion-icon text-6xl mb-4">🎉</div>
            <h3 class="text-2xl font-bold text-green-800 mb-2">İnteraktif Çözüm Tamamlandı!</h3>
            <p class="text-gray-700 mb-6">Tüm adımları başarıyla çözdünüz!</p>
            
            <!-- PERFORMANS BİLGİLERİ -->
            <div class="performance-stats mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="stat-card p-4 bg-white rounded-lg border border-gray-200">
                    <div class="stat-number text-2xl font-bold text-blue-600">${completionStats.totalSteps}</div>
                    <div class="stat-label text-sm text-gray-600">Toplam Adım</div>
                </div>
                <div class="stat-card p-4 bg-white rounded-lg border border-gray-200">
                    <div class="stat-number text-2xl font-bold ${completionStats.totalAttempts <= completionStats.totalSteps + 2 ? 'text-green-600' : 'text-orange-600'}">${completionStats.totalAttempts}</div>
                    <div class="stat-label text-sm text-gray-600">Toplam Deneme</div>
                </div>
                <div class="stat-card p-4 bg-white rounded-lg border border-gray-200">
                    <div class="stat-number text-2xl font-bold ${completionStats.successRate >= 80 ? 'text-green-600' : 'text-yellow-600'}">%${Math.round(completionStats.successRate)}</div>
                    <div class="stat-label text-sm text-gray-600">Başarı Oranı</div>
                </div>
                <div class="stat-card p-4 bg-white rounded-lg border border-gray-200">
                    <div class="stat-number text-2xl font-bold text-purple-600">${completionStats.totalTimeFormatted}</div>
                    <div class="stat-label text-sm text-gray-600">Toplam Süre</div>
                </div>
            </div>
            
            <!-- PERFORMANS DEĞERLENDİRMESİ -->
            <div class="performance-evaluation mb-6 p-4 bg-white rounded-lg border border-gray-200">
                <h4 class="font-semibold text-gray-800 mb-2">Performans Değerlendirmesi</h4>
                <p class="font-medium ${performanceColor}">${performanceMessage}</p>
                
                ${completionStats.performance !== 'excellent' ? `
                    <div class="improvement-tips mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <h5 class="font-medium text-blue-800 mb-2">📈 Gelişim Önerileri:</h5>
                        <ul class="text-sm text-blue-700 space-y-1">
                            ${completionStats.successRate < 80 ? '<li>• Seçenekleri daha dikkatli okuyun</li>' : ''}
                            ${completionStats.totalAttempts > completionStats.totalSteps + 3 ? '<li>• İlk denemede doğru cevap vermeye odaklanın</li>' : ''}
                            <li>• Matematik adımlarını mantıklı sırayla düşünün</li>
                            <li>• Pratik yaparak hızınızı artırın</li>
                        </ul>
                    </div>
                ` : `
                    <div class="excellence-message mt-3 p-3 bg-green-50 rounded border border-green-200">
                        <p class="text-green-700 text-sm">
                            🌟 Mükemmel çalışma! Matematik problemlerini çözmede çok iyisiniz.
                        </p>
                    </div>
                `}
            </div>
            
            <!-- AKSİYON BUTONLARI -->
            <div class="action-buttons space-y-3">
                <button id="interactive-new-problem-btn" class="btn btn-primary w-full">
                    🎯 Yeni Problem Çöz
                </button>
                <button id="interactive-review-solution-btn" class="btn btn-secondary w-full">
                    📋 Tam Çözümü Gözden Geçir
                </button>
                <button id="interactive-try-step-by-step-btn" class="btn btn-tertiary w-full">
                    📝 Adım Adım Çözümü Dene
                </button>
                <button id="back-to-main-menu-btn" class="btn btn-quaternary w-full">
                    🏠 Ana Menüye Dön
                </button>
            </div>
        </div>
    `;

    // Event listener'ları ekle
    setupInteractiveCompletionListeners();

    // Math render
    setTimeout(async () => {
        await renderMathInContainer(container, false);
    }, 50);
}

// js/pages/index.js

async function displayInteractiveFailure() {
    const container = elements['solution-output'];
    if (!container) return;

    const completionStats = interactiveSolutionManager.getCompletionStats();

    container.innerHTML = `
        <div class="interactive-completion text-center p-8 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg">
            <div class="completion-icon text-6xl mb-4">😔</div>
            <h3 class="text-2xl font-bold text-red-800 mb-2">Deneme Hakkın Bitti!</h3>
            <p class="text-gray-700 mb-6">Ama üzülme, en iyi öğrenme yolu denemektir. Şimdi farklı bir yol izleyebilirsin.</p>
            
            <div class="performance-stats mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="stat-card p-4 bg-white rounded-lg border border-gray-200">
                    <div class="stat-number text-2xl font-bold text-blue-600">${completionStats.totalSteps}</div>
                    <div class="stat-label text-sm text-gray-600">Toplam Adım</div>
                </div>
                <div class="stat-card p-4 bg-white rounded-lg border border-gray-200">
                    <div class="stat-number text-2xl font-bold text-red-600">${completionStats.totalAttempts}</div>
                    <div class="stat-label text-sm text-gray-600">Toplam Deneme</div>
                </div>
            </div>
            
            <div class="performance-evaluation mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 class="font-semibold text-yellow-800 mb-2">Ne Yapabilirsin?</h4>
                <p class="text-yellow-700">Doğru çözümü inceleyerek nerede hata yaptığını görebilir veya yeni bir problemle tekrar deneyebilirsin.</p>
            </div>
            
            <div class="action-buttons space-y-3">
                <button id="failure-review-solution-btn" class="btn btn-primary w-full">
                    📋 Tam Çözümü Gözden Geçir
                </button>
                <button id="failure-new-problem-btn" class="btn btn-secondary w-full">
                    🎯 Yeni Problem Çöz
                </button>
                <button id="failure-back-to-menu-btn" class="btn btn-tertiary w-full">
                    🏠 Ana Menüye Dön
                </button>
            </div>
        </div>
    `;

    // Event listener'ları ekle
    document.getElementById('failure-review-solution-btn').addEventListener('click', () => {
        stateManager.setView('fullSolution');
    });
    document.getElementById('failure-new-problem-btn').addEventListener('click', () => {
        resetForNewProblem();
        stateManager.setView('setup');
    });
    document.getElementById('failure-back-to-menu-btn').addEventListener('click', () => {
        stateManager.setView('summary');
    });
}
// js/pages/index.js

function setupInteractiveCompletionListeners() {
    const newProblemBtn = document.getElementById('interactive-new-problem-btn');
    const reviewSolutionBtn = document.getElementById('interactive-review-solution-btn');
    const stepByStepBtn = document.getElementById('interactive-try-step-by-step-btn');
    const backBtn = document.getElementById('back-to-main-menu-btn');

    if (newProblemBtn) {
        newProblemBtn.addEventListener('click', () => {
            resetForNewProblem(); // Bu doğru, yeni problem her şeyi sıfırlamalı.
            stateManager.setView('setup');
        });
    }

    if (reviewSolutionBtn) {
        reviewSolutionBtn.addEventListener('click', () => {
            // HATA BURADAYDI: reset() çağrısı kaldırıldı.
            // Artık sadece görünümü değiştiriyoruz.
            stateManager.setView('fullSolution');
        });
    }

    if (stepByStepBtn) {
        stepByStepBtn.addEventListener('click', () => {
            // HATA BURADAYDI: reset() çağrısı kaldırıldı.
            stateManager.setView('solving');
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            resetToSummary(); // Bu zaten doğruydu.
        });
    }
}


// =================================================================================
// --- AKILLI MENTÖR ARAYÜZ YÖNETİMİ (YENİ EKLENECEK BÖLÜM) ---
// =================================================================================
// www/js/pages/index.js -> Mobil uyumluluğu için responsive flex class'ları eklendi.
async function renderSmartGuideWorkspace() {
    if (smartGuide && !smartGuide.isSessionActive && smartGuide.finalState) {
        renderLockedMentorView();
        return;
    }

    const container = elements['solving-workspace'];
    if (!container) return;

    container.innerHTML = `
        <div id="chat-window" class="bg-white rounded-2xl shadow-2xl shadow-blue-100 flex flex-col h-[90vh] max-h-[950px] w-full max-w-4xl mx-auto">
            <div class="p-4 border-b flex-shrink-0">
                <div class="flex justify-between items-center">
                     <h2 id="mentor-header-title" class="font-bold text-gray-900 text-center">Problem Çözümü</h2>
                     <button id="mentor-back-btn" class="btn btn-secondary !py-1 !px-2 text-xs">Özete Dön</button>
                </div>
                <div class="progress-bar bg-gray-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div id="mentor-progress-fill" class="bg-blue-500 h-full transition-all duration-500" style="width: 0%;"></div>
                </div>
                <div id="mentor-attempt-indicator" class="flex items-center justify-between mt-3 text-sm">
                    <span class="font-medium text-gray-700">Deneme Hakkı:</span>
                    <div id="attempt-dots" class="flex gap-1.5"></div>
                </div>
            </div>

            <div id="chat-feed" class="flex-grow p-6 space-y-6 overflow-y-auto"></div>

            <div id="mentor-input-container" class="p-4 bg-gray-50 border-t flex-shrink-0">
                <div id="mentor-feedback-container" class="mb-2"></div>

                <div id="workspace-symbols-panel" class="math-symbols-panel mb-2 overflow-x-auto whitespace-nowrap p-2 bg-gray-200/70 rounded-lg scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200" data-target="mentor-student-input">
                    <div class="inline-flex items-center gap-1">
                        <button class="symbol-btn" data-symbol="+" title="Toplama">+</button>
                        <button class="symbol-btn" data-symbol="-" title="Çıkarma">-</button>
                        <button class="symbol-btn" data-symbol="×" title="Çarpma">×</button>
                        <button class="symbol-btn" data-symbol="÷" title="Bölme">÷</button>
                        <button class="symbol-btn" data-symbol="=" title="Eşittir">=</button>
                        <button class="symbol-btn" data-symbol="/" title="Bölü (Kesir)">/</button>
                        <button class="symbol-btn" data-symbol="^" title="Üs Alma">x^</button>
                        <button class="symbol-btn" data-symbol="√" title="Karekök">√()</button>
                        <button class="symbol-btn" data-symbol="∛" title="Küpkök">∛()</button>
                        <button class="symbol-btn" data-symbol="(" title="Sol Parantez">(</button>
                        <button class="symbol-btn" data-symbol=")" title="Sağ Parantez">)</button>
                        <button class="symbol-btn" data-symbol="[" title="Köşeli Parantez">[ ]</button>
                        <button class="symbol-btn" data-symbol="{" title="Süslü Parantez">{ }</button>
                        <button class="symbol-btn" data-symbol="|" title="Mutlak Değer">| |</button>
                        <button class="symbol-btn" data-symbol="²" title="Kare">x²</button>
                        <button class="symbol-btn" data-symbol="³" title="Küp">x³</button>
                        <button class="symbol-btn" data-symbol="<" title="Küçüktür"><</button>
                        <button class="symbol-btn" data-symbol=">" title="Büyüktür">></button>
                        <button class="symbol-btn" data-symbol="≤" title="Küçük veya Eşit">≤</button>
                        <button class="symbol-btn" data-symbol="≥" title="Büyük veya Eşit">≥</button>
                        <button class="symbol-btn" data-symbol="≠" title="Eşit Değildir">≠</button>
                        <button class="symbol-btn" data-symbol="≈" title="Yaklaşık Eşit">≈</button>
                        <button class="symbol-btn" data-symbol="π" title="Pi Sayısı">π</button>
                        <button class="symbol-btn" data-symbol="°" title="Derece">°</button>
                        <button class="symbol-btn" data-symbol="∞" title="Sonsuz">∞</button>
                        <button class="symbol-btn" data-symbol="θ" title="Teta">θ</button>
                        <button class="symbol-btn" data-symbol="α" title="Alfa">α</button>
                        <button class="symbol-btn" data-symbol="β" title="Beta">β</button>
                        <button class="symbol-btn" data-symbol="Δ" title="Delta">Δ</button>
                        <button class="symbol-btn" data-symbol="∑" title="Toplam Sembolü">∑</button>
                        <button class="symbol-btn" data-symbol="∫" title="İntegral">∫</button>
                    </div>
                </div>

                <div class="flex flex-col md:flex-row items-stretch md:items-end gap-2">
                     <div id="input-mode-wrapper" class="flex-grow">
                        <div id="mentor-mc-wrapper" class="hidden space-y-2"></div>
                        <div id="mentor-textarea-wrapper">
                             <textarea id="mentor-student-input" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none overflow-y-hidden" rows="1" placeholder="Cevabını buraya yaz..."></textarea>
                        </div>
                     </div>
                    <button id="mentor-submit-btn" class="flex items-center justify-center hover:text-blue-700 disabled:opacity-70 disabled:cursor-not-allowed">
    <svg xmlns="http://www.w3.org/2000/svg" 
         viewBox="0 0 24 24" 
         fill="none" 
         stroke="currentColor" 
         stroke-width="2" 
         stroke-linecap="round" 
         stroke-linejoin="round" 
         class="w-10 h-10">
        <path d="M22 2L11 13"></path>
        <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
    </svg>
</button>

                </div>
            </div>
        </div>
    `;

    initializeSymbolPanels();
    restoreChatHistory();
    setupMentorEventListeners();
    await startMentorConversation();
}

// 🎯 YAPIŞTIRILACAK GÜNCEL KOD (js/pages/index.js)

function renderLockedMentorView() {
    const container = elements['solving-workspace'];
    if (!container) return;

    const finalState = smartGuide.finalState;
    const isSuccess = finalState?.reason === 'completed';

    const bgColor = isSuccess ? 'bg-green-100' : 'bg-red-100';
    const textColor = isSuccess ? 'text-green-800' : 'text-red-800';
    const icon = isSuccess ? '🏆' : '🚫';
    const title = isSuccess ? 'Oturum Başarıyla Tamamlandı!' : 'Deneme Hakkı Bitti!';

    let actionButtonsHTML = '';
    // NOT: Butonların ID'leri kasten değiştirildi.
    // Orijinal ID'ler ana arayüzde kullanıldığı için çakışma olmaması adına
    // bu geçici ekrandaki butonlara farklı ID'ler veriyoruz.
    if (isSuccess) {
        // BAŞARI DURUMU BUTONLARI
        actionButtonsHTML = `
            <button id="locked-view-interactive-btn" class="btn btn-secondary w-full">🧩 İnteraktif Çözümü Dene</button>
            <button id="locked-view-full-solution-btn" class="btn btn-tertiary w-full">📋 Tam Çözümü Gözden Geçir</button>
        `;
    } else {
        // BAŞARISIZLIK DURUMU BUTONLARI
        actionButtonsHTML = `
            <button id="locked-view-full-solution-btn" class="btn btn-secondary w-full">📋 Doğru Çözüm Neydi?</button>
        `;
    }

    container.innerHTML = `
        <div id="chat-window" class="bg-white rounded-2xl shadow-xl flex flex-col h-auto">
            <div id="chat-feed" class="flex-grow p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                </div>
            <div class="p-4 bg-gray-50 border-t text-center">
                <div class="locked-state-message p-5 rounded-lg ${bgColor} ${textColor}">
                    <div class="text-4xl mb-3">${icon}</div>
                    <h4 class="font-bold text-xl mb-1">${title}</h4>
                    <p class="mb-5 text-sm">${finalState?.message || 'Oturum sonlandı.'}</p>
                    
                    <div class="space-y-3 mb-4">
                        ${actionButtonsHTML}
                    </div>
                    
                    <button id="locked-view-new-question-btn" class="btn btn-primary w-full">🎯 Yeni Problem Çöz</button>
                </div>
            </div>
        </div>
    `;

    restoreChatHistory(); // Sohbet geçmişini tekrar yükle

    // =================================================================
    // DÜZELTME BURADA: Olay dinleyicilerini YENİ oluşturulan butonlara doğrudan atıyoruz.
    // =================================================================
    const newQuestionBtn = document.getElementById('locked-view-new-question-btn');
    const interactiveBtn = document.getElementById('locked-view-interactive-btn');
    const fullSolutionBtn = document.getElementById('locked-view-full-solution-btn');

    if (newQuestionBtn) {
        newQuestionBtn.addEventListener('click', () => {
            resetForNewProblem();
            stateManager.setView('setup');
        });
    }
    if (interactiveBtn) {
        interactiveBtn.addEventListener('click', () => {
            stateManager.setView('interactive');
        });
    }
    if (fullSolutionBtn) {
        fullSolutionBtn.addEventListener('click', () => {
            stateManager.setView('fullSolution');
        });
    }
}

/**
 * Tamamlanmış bir oturumun sohbet geçmişini ekrana yeniden çizer.
 */
function restoreChatHistory() {
    const chatFeed = document.getElementById('chat-feed');
    if (!chatFeed || !smartGuide.chatHistory) return; // <-- DEĞİŞTİ: smartGuide.chatHistory kontrolü

    chatFeed.innerHTML = '';
    smartGuide.chatHistory.forEach(msg => { // <-- DEĞİŞTİ: smartGuide.chatHistory kullanılıyor
        addMentorMessage(msg.content, msg.sender, msg.type, false); // false = animasyonsuz
    });
}
/**
 * Sohbet arayüzündeki deneme hakkı göstergesini (noktaları) günceller.
 */
// 🎯 DEĞİŞTİRİLECEK BÖLÜM (updateMentorAttemptIndicator fonksiyonu)

function updateMentorAttemptIndicator() {
    const dotsContainer = document.getElementById('attempt-dots');
    if (!dotsContainer) return;

    // Yeni fonksiyonumuzu çağırıyoruz
    const attemptInfo = smartGuide.getSessionAttemptInfo();
    const maxAttempts = attemptInfo.maxAttempts;
    const currentAttempts = attemptInfo.attempts;

    let dotsHTML = '';
    for (let i = 0; i < maxAttempts; i++) {
        const dotClass = i < currentAttempts ? 'bg-red-400' : 'bg-gray-300';
        dotsHTML += `<div class="w-3 h-3 rounded-full ${dotClass} transition-colors duration-300"></div>`;
    }
    dotsContainer.innerHTML = dotsHTML;
}

// 🎯 YAPIŞTIRILACAK YENİ KOD (js/pages/index.js)

async function startMentorConversation() {
    const stepInfo = smartGuide.getCurrentStepInfo();
    if (!stepInfo) {
        addMentorMessage('Merhaba! Görünüşe göre bir sorun var, çözüm adımlarını yükleyemedim.', 'ai', 'error');
        return;
    }

    updateMentorProgress();
    updateMentorAttemptIndicator();

    if (smartGuide.chatHistory.length === 0) {
        
        // --- YENİ KİŞİSELLEŞTİRME MANTIĞI ---

        // 1. Gerekli verileri State Manager'dan alalım.
        const userData = stateManager.getStateValue('user');
        const problemData = stateManager.getStateValue('problem').solution;

        const userName = userData.displayName || 'dostum'; // İsim yoksa varsayılan bir hitap
        const problemTopic = problemData.problemOzeti.konu || 'matematik';

        // 2. Karşılama mesajı varyasyonları oluşturalım.
        const welcomeMessages = [
            `Harika bir seçim, ${userName}! Ben kişisel asistanın MathAi. Bugün seninle bir **${problemTopic}** sorusu çözeceğiz. Takıldığın yerde sana yardım etmek için buradayım. Hazırsan başlayalım!`,
            `Merhaba ${userName}! Bir **${problemTopic}** problemiyle daha yeteneklerini geliştirmeye hazır mısın? Unutma, ben her adımda sana yol göstermek için buradayım.`,
            `İşte başlıyoruz, ${userName}! Bu **${problemTopic}** sorusunu birlikte adım adım çözeceğiz. İlk adımı denemeye ne dersin?`
        ];

        // 3. Rastgele bir mesaj seçelim.
        const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        
        // 4. Karşılama mesajını ve ardından ilk görevi ekleyelim.
        addMentorMessage(randomMessage, 'ai');
        
        // Kullanıcının mesajı okuması için kısa bir gecikme ekleyelim.
        await new Promise(r => setTimeout(r, 1500)); 

        const firstStepTitle = problemData.adimlar[0].adimBasligi || "İlk Adım";
        const firstTaskMessage = `Haydi başlayalım! İlk görevimiz: **"${firstStepTitle}"**. Sence bu adımda ne yapmalıyız? Cevabını bekliyorum.`;
        
        addMentorMessage(firstTaskMessage, 'ai');

    } else {
        const chatFeed = document.getElementById('chat-feed');
        if (chatFeed) {
            chatFeed.scrollTop = chatFeed.scrollHeight;
        }
    }
}
/**
 * Bir textarea'nın yüksekliğini içeriğine göre otomatik olarak ayarlar.
 * @param {Event} event Input olayı.
 */
function autoResizeTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto'; // Yüksekliği sıfırla
    // Scroll yüksekliğine göre yeni yüksekliği ayarla
    textarea.style.height = (textarea.scrollHeight) + 'px';
}
/**
 * Mentor arayüzündeki butonlar ve girişler için olay dinleyicilerini kurar.
 */
function setupMentorEventListeners() {
    const submitBtn = document.getElementById('mentor-submit-btn');
    const backBtn = document.getElementById('mentor-back-btn');
    const input = document.getElementById('mentor-student-input');

    if (submitBtn) {
        submitBtn.addEventListener('click', handleMentorSubmission);
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => stateManager.setView('summary'));
    }

    if (input) {
        // YENİ: Yazıldıkça textarea'yı yeniden boyutlandırmak için listener eklendi.
        input.addEventListener('input', autoResizeTextarea);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleMentorSubmission();
            }
        });
    }

    // Çoktan seçmeli için event delegation
    const mcWrapper = document.getElementById('mentor-mc-wrapper');
    if(mcWrapper){
        mcWrapper.addEventListener('change', () => {
             document.getElementById('mentor-submit-btn').disabled = false;
        });
    }
}

async function handleMentorSubmission() {
    const submitBtn = document.getElementById('mentor-submit-btn');
    const textInput = document.getElementById('mentor-student-input');
    const mcWrapper = document.getElementById('mentor-mc-wrapper');

    // DÜZELTME: Butonu fonksiyonun en başında hemen pasif yap.
    submitBtn.disabled = true;

    let studentInput = '';
    let isMcSelection = !mcWrapper.classList.contains('hidden');

    if (isMcSelection) {
        const selectedRadio = mcWrapper.querySelector('input[name="solution-option"]:checked');
        if (!selectedRadio) {
            submitBtn.disabled = false; // Seçim yoksa butonu tekrar aktif et.
            return;
        }
        studentInput = selectedRadio.value;
    } else {
        studentInput = textInput.value.trim();
        if (!studentInput) {
            submitBtn.disabled = false; // Giriş yoksa butonu tekrar aktif et.
            return;
        }
    }

    if (!isMcSelection) {
        const moderationResult = await moderateUserInput(studentInput);
        if (!moderationResult || !moderationResult.isSafe) {
            addMentorMessage(studentInput, 'user');
            const warningMessage = "Lütfen sadece problemle ilgili matematiksel adımlar veya sorular yazalım. Sana daha iyi yardımcı olabilmem için bu önemli. 🙂";
            addMentorMessage(warningMessage, 'ai', 'error');
            textInput.value = '';
            submitBtn.disabled = false; // Uygunsuz içerik sonrası butonu tekrar aktif et.
            return;
        }
    }
    const userProfile = stateManager.getStateValue('user'); // Kullanıcı profilini al
    const mistakeProfile = userProfile.mistakeProfile || {}; // Hata profilini çıkar
    addMentorMessage(studentInput, 'user');
    textInput.value = '';
    showTypingIndicator(true);

    try {
        const result = await smartGuide.evaluateStudentStep(studentInput, mistakeProfile);
        showTypingIndicator(false);
        if (!result) { throw new Error("Değerlendirme sonucu alınamadı."); }
        
        // ... (Fonksiyonun geri kalanı aynı, değişiklik yok) ...
        if (!result.isCorrect && result.mistake_type) {
            console.log(`Kayıt ediliyor: ${result.mistake_type}`);
            
            // 1. Hata türünü asenkron olarak veritabanına kaydet.
            // await kullanıyoruz ki işlem bitmeden devam etmeyelim.
            await FirestoreManager.incrementMistakeCount(result.mistake_type);

            // 2. Kullanıcının en güncel verisini (yeni hata profili dahil) veritabanından çek.
            const updatedUserData = await FirestoreManager.getUserData(auth.currentUser);

            // 3. Yerel state'i bu en güncel veriyle güncelle.
            // Bu sayede bir sonraki prompt'ta yapay zekaya güncel profil gönderilir.
            if (updatedUserData) {
                stateManager.setUser(updatedUserData);
            }
        }
        if (result.isStepSkipped) {
            const warningMessage = "Harika bir ilerleme! Ancak amacımız her adımı sindirerek öğrenmek. Lütfen bulunduğumuz adıma odaklanalım. 😉";
            addMentorMessage(warningMessage, 'ai', 'info');
            return;
        }

        if (result.isCorrect) {
            const completedStepIndex = smartGuide.currentStep;
            const isProblemFinished = (smartGuide.currentStep + 1) >= smartGuide.guidanceData.totalSteps;

            if (result.isFinalAnswer || isProblemFinished) {
                const finalMessage = `Tebrikler, problemi başarıyla tamamladın! Bu soruyu toplamda ${smartGuide.totalSessionAttempts} denemede çözdün. 🏆`;
                addMentorMessage(finalMessage, 'ai', 'final');
                smartGuide.markSessionAsEnded('completed', finalMessage);
                await new Promise(r => setTimeout(r, 1500));
                renderLockedMentorView();
                return;
            } else {
                addMentorMessage(result.coach_response, 'ai', 'success');
                await new Promise(r => setTimeout(r, 2000));
                smartGuide.proceedToNextStep();
                updateMentorProgress();
                
                const newStepData = smartGuide.guidanceData.steps[smartGuide.currentStep];
                const prevStepData = smartGuide.guidanceData.steps[completedStepIndex];
                const nextStepTitle = newStepData.adimBasligi || `Sıradaki Adım`;
                let taskIntro = `Harika! Sıradaki görevimiz: **"${nextStepTitle}"**.`;
                const prevStepResult = prevStepData.correctAnswer;
                const focusArea = newStepData.odak_alan_lateks;

                if (prevStepResult) {
                    let equationToShow = `$${prevStepResult}$`;
                    if (focusArea) {
                        const focusLatex = `$${focusArea}$`;
                        equationToShow = equationToShow.replace(focusLatex, `[highlight]${focusLatex}[/highlight]`);
                    }
                    taskIntro += `\n\nElimizdeki ifade şu: ${equationToShow}\n\nSence şimdi ne yapmalıyız?`;
                }
                
                addMentorMessage(taskIntro, 'ai');
                switchToTextInput();
            }
        } else {
            smartGuide.addMistake(result.mistake_type);
            smartGuide.incrementAttempts();
            updateMentorAttemptIndicator();
            const sessionAttemptInfo = smartGuide.getSessionAttemptInfo();

            if (sessionAttemptInfo.isFailed) {
                const maxAttempts = smartGuide.getSessionAttemptInfo().maxAttempts;
                const failureMessage = `Maalesef ${maxAttempts} deneme hakkının tamamını kullandın ve çözüme ulaşamadık. Ama üzülme, bu harika bir pratikti! Şimdi istersen doğru çözümü inceleyebilirsin.`;
                addMentorMessage(failureMessage, 'ai', 'final');
                smartGuide.markSessionAsEnded('failed', failureMessage);
                await new Promise(r => setTimeout(r, 1500));
                renderLockedMentorView();
                return;
            }
            
            addMentorMessage(result.coach_response, 'ai', 'info');
            
            if (isMcSelection) {
                 await new Promise(r => setTimeout(r, 1500));
                 const correctStepData = smartGuide.guidanceData.steps[smartGuide.currentStep];
                 const correctAnswer = correctStepData.correctAnswer;
                 addMentorMessage(`Doğru cevap buydu: **${correctAnswer}**`, 'ai', 'info');
                 await new Promise(r => setTimeout(r, 2000));
                 smartGuide.proceedToNextStep();
                 updateMentorProgress();
                 const nextStepTitle = smartGuide.guidanceData.steps[smartGuide.currentStep].adimBasligi || `Sıradaki Adım`;
                 const nextTaskMessage = `Hadi odaklanalım: **"${nextStepTitle}"**.`;
                 addMentorMessage(nextTaskMessage, 'ai');
                 switchToTextInput();
            } else {
                 const stepAttemptCount = smartGuide.getCurrentStepAttemptCount();
                 if (stepAttemptCount >= 2) {
                    await new Promise(r => setTimeout(r, 1500));
                    addMentorMessage("Hadi işini kolaylaştıralım. Sence doğru adım aşağıdakilerden hangisi olabilir?", 'ai', 'info');
                    const currentStepData = smartGuide.guidanceData.steps[smartGuide.currentStep];
                    switchToMcInput(currentStepData);
                 } else if (result.hint) {
                    await new Promise(r => setTimeout(r, 1500));
                    addMentorMessage(`Belki şu ipucu yardımcı olur: ${result.hint}`, 'ai', 'info');
                 }
            }
        }
    } catch (error) {
        showTypingIndicator(false);
        console.error("Mentor Submission Hatası:", error);
        addMentorMessage("Teknik bir sorun oluştu.", 'ai', 'error');
    } finally {
        // DÜZELTME: Sadece oturum bitmediyse butonu tekrar aktif et.
        if (!smartGuide.finalState) {
            submitBtn.disabled = false;
        }
    }
}
const MAX_CHAT_HISTORY = 100; // Sohbet geçmişi için maksimum mesaj sayısı

function addMentorMessage(content, sender = 'ai', type = 'info', animate = true) {
    if (animate) {
        smartGuide.chatHistory.push({ content, sender, type });

        // --- BELLEK SIZINTISI ÖNLEMİ ---
        // Eğer sohbet geçmişi limiti aştıysa, en eski mesajı sil.
        if (smartGuide.chatHistory.length > MAX_CHAT_HISTORY) {
            smartGuide.chatHistory.shift(); // Dizinin başındaki (en eski) elemanı kaldırır.
        }
    }

    const chatFeed = document.getElementById('chat-feed');
    if (!chatFeed) return;

    let processedContent = content.replace(/\[highlight\]([\s\S]*?)\[\/highlight\]/g,
        '<span class="math-focus">$1</span>');

    let bubbleHTML = '';
    const animationClass = animate ? 'animate-fade-in' : '';

    if (sender === 'ai') {
        let bgColor, titleColor, avatarText, title;
        switch (type) {
            case 'success':
                bgColor = 'bg-green-100'; titleColor = 'text-green-800'; avatarText = '✅'; title = 'Harika!';
                break;
            case 'error':
                bgColor = 'bg-red-100'; titleColor = 'text-red-800'; avatarText = '🤔'; title = 'Tekrar Deneyelim';
                break;
            case 'final':
                 bgColor = 'bg-indigo-100'; titleColor = 'text-indigo-800'; avatarText = '🏆'; title = 'Sonuç';
                 break;
            default: // info
                bgColor = 'bg-gray-100'; titleColor = 'text-purple-700'; avatarText = 'AI'; title = 'Sıradaki Adım';
        }
        bubbleHTML = `
            <div class="chat-bubble ${animationClass}">
                <div class="flex items-start gap-3 justify-start">
                    <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-purple-200 text-purple-700 font-bold">${avatarText}</div>
                    <div class="${bgColor} p-4 rounded-lg rounded-bl-none shadow-sm max-w-md">
                        <p class="font-semibold ${titleColor} mb-1">${title}</p>
                        <div class="text-gray-700 smart-content text-sm">${processedContent}</div>
                    </div>
                </div>
            </div>`;
    } else { // sender === 'user'
        bubbleHTML = `
            <div class="chat-bubble ${animationClass}">
                <div class="flex items-start gap-3 justify-end">
                    <div class="bg-blue-500 text-white p-4 rounded-lg rounded-br-none shadow-sm max-w-md">
                        <p class="smart-content text-sm">${processedContent}</p>
                    </div>
                    <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-200 text-blue-700 font-bold">ME</div>
                </div>
            </div>`;
    }

    chatFeed.insertAdjacentHTML('beforeend', bubbleHTML);
    const newBubble = chatFeed.lastElementChild;
    renderMathInContainer(newBubble);
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

/**
 * "Yapay zeka yazıyor..." göstergesini açıp kapatır.
 * @param {boolean} show Gösterilsin mi?
 */
function showTypingIndicator(show) {
    const chatFeed = document.getElementById('chat-feed');
    let typingBubble = document.getElementById('typing-bubble');

    if (show && !typingBubble) {
        const typingHTML = `
            <div id="typing-bubble" class="chat-bubble">
                <div class="flex items-start gap-3 justify-start">
                    <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-purple-200 text-purple-700 font-bold">AI</div>
                    <div class="bg-gray-100 p-4 rounded-lg rounded-bl-none shadow-sm">
                        <div class="typing-indicator flex items-center space-x-1.5">
                            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: -0.16s;"></span>
                            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: -0.32s;"></span>
                        </div>
                    </div>
                </div>
            </div>`;
        chatFeed.insertAdjacentHTML('beforeend', typingHTML);
        chatFeed.scrollTop = chatFeed.scrollHeight;
    } else if (!show && typingBubble) {
        typingBubble.remove();
    }
}

// www/js/pages/index.js

function switchToMcInput(stepData) {
    const mcWrapper = document.getElementById('mentor-mc-wrapper');
    const inputWrapper = document.getElementById('mentor-textarea-wrapper');
    const submitBtn = document.getElementById('mentor-submit-btn');

    const correctOption = {
        latex: stepData.correctAnswer,
        isCorrect: true,
        id: 'correct'
    };

    let wrongLatex;
    if (stepData.yanlisSecenekler && Array.isArray(stepData.yanlisSecenekler) && stepData.yanlisSecenekler.length > 0) {
        const firstWrongOption = stepData.yanlisSecenekler[0];
        wrongLatex = firstWrongOption.metin_lateks || firstWrongOption.metin;
    } else {
        wrongLatex = generateWrongAnswer(correctOption.latex, 0);
    }

    const wrongOption = { latex: wrongLatex, isCorrect: false, id: 'wrong-generated' };
    let options = [correctOption, wrongOption].sort(() => Math.random() - 0.5);

    mcWrapper.innerHTML = options.map((opt, index) => {
        const letter = String.fromCharCode(65 + index);
        const displayLatex = opt.latex || "\\text{Hata: Seçenek içeriği boş.}";
        return `
            <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input type="radio" name="solution-option" class="sr-only" value="${escapeHtml(displayLatex)}">
                <div class="flex items-center gap-3 w-full">
                    <span class="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">${letter}</span>
                    <span class="font-medium smart-content flex-1" data-content="${escapeHtml(displayLatex)}">${escapeHtml(displayLatex)}</span>
                </div>
            </label>
        `;
    }).join('');

    renderMathInContainer(mcWrapper);
    inputWrapper.classList.add('hidden'); // Sadece metin kutusunu gizle
    mcWrapper.classList.remove('hidden'); // Seçenekleri göster
    submitBtn.disabled = true; // Gönder butonunu pasif yap
}

/**
 * Mentor arayüzünü metin girişi moduna geri döndürür.
 */
function switchToTextInput() {
    const mcWrapper = document.getElementById('mentor-mc-wrapper');
    const inputWrapper = document.getElementById('mentor-textarea-wrapper');
    const submitBtn = document.getElementById('mentor-submit-btn');

    mcWrapper.classList.add('hidden'); // Seçenekleri gizle
    inputWrapper.classList.remove('hidden'); // Metin kutusunu göster
    mcWrapper.innerHTML = '';
    submitBtn.disabled = false; // Gönder butonunu tekrar aktif yap
}




function updateMentorProgress() {
    const progressFill = document.getElementById('mentor-progress-fill');
    const headerTitle = document.getElementById('mentor-header-title');
    const stepInfo = smartGuide.getCurrentStepInfo();
    if(progressFill && stepInfo) {
        // HESAPLAMA DÜZELTMESİ: (stepNumber - 1) yerine stepNumber kullanıyoruz
        const progress = (stepInfo.stepNumber / stepInfo.totalSteps) * 100;
        progressFill.style.width = `${progress}%`;
        headerTitle.textContent = `Problem Çözümü (Adım ${stepInfo.stepNumber}/${stepInfo.totalSteps})`;
    }
}




// Global fonksiyonlar
window.showError = showError;
window.showSuccess = showSuccess;
window.showLoading = showLoading;
window.stateManager = stateManager;
window.renderMath = renderMath;
window.renderInteractiveSolution = renderInteractiveSolution;
window.handleInteractiveSubmissionSafe = handleInteractiveSubmissionSafe;
window.setupInteractiveEventListeners = setupInteractiveEventListeners;
window.forceShowContainers = forceShowContainers;
window.handleInteractiveResetToSetup = handleInteractiveResetToSetup;
window.clearInputAreas = clearInputAreas;
window.globalRenderManager = globalRenderManager;

// js/pages/index.js dosyasında, "// --- EXPORTS ---" satırının hemen üstüne ekleyin.

/**
 * Belirtilen ID'ye sahip bir elemanın DOM'da var olmasını ve görünür olmasını bekler.
 * @param {string} elementId Beklenecek elemanın ID'si.
 * @param {number} timeout Maksimum bekleme süresi (milisaniye).
 * @returns {Promise<HTMLElement>} Eleman bulunduğunda resolve olan bir Promise.
 */
function waitForElement(elementId, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const element = document.getElementById(elementId);
            // Eleman hem var hem de görünür mü kontrol et (display: none değil)
            if (element && element.offsetParent !== null) {
                clearInterval(interval);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error(`waitForElement: '${elementId}' elemanı ${timeout}ms içinde bulunamadı veya görünür olmadı.`));
            }
        }, 50); // Her 50ms'de bir kontrol et
    });
}


// --- EXPORTS ---
export { canvasManager, errorHandler, stateManager, smartGuide};

