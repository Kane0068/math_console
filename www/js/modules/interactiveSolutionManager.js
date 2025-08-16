import { generateWrongAnswer } from '../utils/mathUtils.js';

export class InteractiveSolutionManager {
    constructor() {
        this.solutionData = null;
        this.currentStep = 0;
        this.totalSteps = 0;
        this.isProcessing = false;
        this.totalAttempts = 0;
        this.maxAttempts = 3; // Başlangıç değeri, initialize'da güncellenebilir
        this.currentOptions = [];
        this.startTime = null;
        this.isFailed = false;
        this.isCompleted = false;
        console.log('✅ InteractiveSolutionManager başlatıldı (Yeni Mimari)');
    }

    /**
     * İnteraktif çözümü, önceden alınmış olan tam çözüm verisiyle başlatır.
     * Eğer zaten bir oturum devam ediyorsa, durumu korur.
     * @param {object} solutionData - getUnifiedSolution'dan gelen tam çözüm nesnesi.
     */
    initializeInteractiveSolution(solutionData) {
        // --- YENİ MANTIK: Eğer zaten bir çözüm verisi yüklüyse, sıfırlama. ---
        if (this.solutionData) {
            console.log('✅ Mevcut interaktif oturuma devam ediliyor.');
            return;
        }

        console.log('🔄 YENİ interaktif çözüm başlatılıyor...', solutionData);
        if (!solutionData || !solutionData.adimlar || solutionData.adimlar.length === 0) {
            throw new Error('Geçersiz veya boş çözüm verisi.');
        }

        this.reset(); // Sadece ilk başlatmada sıfırla
        this.solutionData = solutionData;
        this.totalSteps = solutionData.adimlar.length;
        this.maxAttempts = Math.max(3, Math.floor(this.totalSteps * 1.5));
        this.startTime = Date.now();
    }
    

    // ✅ YENİ, DAHA SAĞLAM generateStepOptions FONKSİYONU
    // js/modules/interactiveSolutionManager.js -> Bu fonksiyonu mevcut olanla tamamen değiştirin.

    // ✅ YENİ, DAHA SAĞLAM generateStepOptions FONKSİYONU
    generateStepOptions(stepIndex) {
        if (!this.solutionData || stepIndex >= this.totalSteps || stepIndex < 0) {
            throw new Error("Geçersiz adım indeksi.");
        }

        const currentStepData = this.solutionData.adimlar[stepIndex];
        const options = [];

        // 1. Doğru seçeneği ekle
        const correctOption = {
            latex: currentStepData.cozum_lateks,
            svg: currentStepData.cozum_svg, // Sunucudan gelen SVG'yi ekle
            isCorrect: true,
            explanation: currentStepData.adimAciklamasi || "Bu adım, çözüm için doğru yaklaşımdır."
        };
        options.push(correctOption);

        // 2. API'den gelen yanlış seçenekleri (eğer varsa) ekle
        if (currentStepData.yanlisSecenekler && currentStepData.yanlisSecenekler.length > 0) {
            currentStepData.yanlisSecenekler.slice(0, 2).forEach(opt => {
                options.push({
                    latex: opt.metin_lateks,
                    svg: opt.metin_svg, // Sunucudan gelen SVG'yi ekle
                    isCorrect: false,
                    explanation: opt.hataAciklamasi
                });
            });
        }

        // 3. GARANTİ MEKANİZMASI: Eğer toplamda 3 seçenek yoksa, kendimiz üretelim.
        // Bu, API eksik veri gönderse bile uygulamanın çökmesini engeller.
        while (options.length < 3) {
            const wrongLatex = generateWrongAnswer(correctOption.latex, options.length - 1);
            options.push({
                latex: wrongLatex,
                // Not: Bu seçenekler için SVG'miz yok, bu yüzden `svg` alanı tanımsız olacak.
                // Arayüz kodu bunu dikkate almalı.
                isCorrect: false,
                explanation: `Bu ifade, doğru cevabın küçük bir hata içeren halidir.`
            });
        }

        this.currentOptions = this.shuffleAndAssignIds(options.slice(0, 3));

        return {
            stepNumber: stepIndex + 1,
            totalSteps: this.totalSteps,
            stepDescription: currentStepData.adimAciklamasi || `Adım ${stepIndex + 1} için doğru işlemi seçin.`,
            options: this.currentOptions,
            remainingAttempts: this.maxAttempts - this.totalAttempts,
            maxAttempts: this.maxAttempts,
            attempts: this.totalAttempts
        };
    }
    /**
     * Seçenekleri karıştırır ve arayüzde kullanılmak üzere geçici ID'ler atar.
     * @param {Array<object>} options Karıştırılacak seçenekler dizisi.
     * @returns {Array<object>} Karıştırılmış ve ID atanmış seçenekler.
     */
    shuffleAndAssignIds(options) {
        const shuffled = [...options].sort(() => Math.random() - 0.5);
        return shuffled.map((option, index) => ({ ...option, displayId: index }));
    }

    // js/modules/interactiveSolutionManager.js

    evaluateSelection(selectedDisplayId) {
        if (this.isCompleted || this.totalAttempts >= this.maxAttempts) {
            return { error: "Değerlendirme yapılamaz, çözüm tamamlandı veya deneme hakkı bitti." };
        }

        const selectedOption = this.currentOptions.find(opt => opt.displayId === selectedDisplayId);
        if (!selectedOption) {
            return { error: "Geçersiz seçenek." };
        }

        const correctOption = this.currentOptions.find(opt => opt.isCorrect);
        let result = {
            isCorrect: selectedOption.isCorrect,
            explanation: selectedOption.explanation,
            selectedOption,
            correctOption,
            // Kalan hakkı burada hesaplama, çünkü henüz deneme sayısını artırmadık.
        };

        if (result.isCorrect) {
            this.currentStep++;
            result.currentStep = this.currentStep;
            result.totalSteps = this.totalSteps;

            if (this.currentStep >= this.totalSteps) {
                this.isCompleted = true;
                result.isCompleted = true;
                result.completionStats = this.getCompletionStats();
            } else {
                result.nextStepData = this.generateStepOptions(this.currentStep);
            }
        } else {
            // --- YANLIŞ CEVAP MANTIĞI ---
            this.totalAttempts++;
            result.remainingAttempts = this.maxAttempts - this.totalAttempts; // Kalan hakkı burada hesapla

            if (result.remainingAttempts <= 0) {
                // Deneme hakkı bitti
                this.isFailed = true;
                result.forceReset = true;
                result.message = "Tüm deneme haklarınız bitti.";
            } else {
                // =============================================================
                // 🎯 DÜZELTME 2: Kurallara göre adımı tekrarla veya baştan başla
                // =============================================================
                if (this.currentStep === 0) {
                    // KURAL: İlk adımda yanlış yaparsa, adımı tekrarlar.
                    // this.currentStep değişmez.
                    result.restartCurrentStep = true;
                    result.message = `Yanlış cevap! Bu adımı tekrar deneyelim. Kalan deneme hakkınız: ${result.remainingAttempts}`;
                } else {
                    // KURAL: Diğer adımlarda yanlış yaparsa, en başa döner.
                    this.currentStep = 0;
                    result.restartFromBeginning = true;
                    result.message = `Yanlış cevap! Baştan başlıyorsunuz. Kalan deneme hakkınız: ${result.remainingAttempts}`;
                }
            }
        }
        
        // Kalan deneme hakkını her durumda result nesnesine ekleyelim
        result.remainingAttempts = this.maxAttempts - this.totalAttempts;
        return result;
    }

    getCompletionStats() {
        const endTime = Date.now();
        const totalTime = this.startTime ? endTime - this.startTime : 0;
        const successRate = this.totalSteps > 0 ? ((this.totalSteps) / (this.totalSteps + this.totalAttempts)) * 100 : 0;
        
        let performance = 'needs_improvement';
        if(successRate > 85) performance = 'excellent';
        else if(successRate > 60) performance = 'good';

        const formatTime = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            return `${minutes}dk ${seconds % 60}sn`;
        };

        return {
            totalTimeFormatted: formatTime(totalTime),
            totalAttempts: this.totalAttempts,
            totalSteps: this.totalSteps,
            successRate: Math.round(successRate),
            performance: performance
        };
    }
    
    getHint() {
        if (!this.solutionData || this.currentStep >= this.totalSteps) return null;
        const stepData = this.solutionData.adimlar[this.currentStep];
        return { 
            hint: stepData.ipucu || "Bu adımda kullanılacak temel formülü veya kuralı düşünün.",
            stepDescription: stepData.adimAciklamasi 
        };
    }

    reset() {
        this.solutionData = null;
        this.currentStep = 0;
        this.totalSteps = 0;
        this.totalAttempts = 0;
        this.currentOptions = [];
        this.startTime = null;
        this.isFailed = false;
        this.isCompleted = false;
        this.isProcessing = false;
        console.log('✅ İnteraktif çözüm sistemi sıfırlandı.');
    }
}

// Singleton export
export const interactiveSolutionManager = new InteractiveSolutionManager();