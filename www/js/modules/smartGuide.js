// =================================================================================
//  Akıllı Rehber Sistemi - smartGuide.js
//  Matematik problemlerini adım adım çözmek için akıllı rehberlik sistemi
// =================================================================================

// makeApiCall fonksiyonu pages/index.js'de tanımlanmış, bu yüzden global olarak erişilecek
import { AdvancedErrorHandler } from './errorHandler.js';
import { StateManager } from './stateManager.js';
import { validateStudentStep } from '../services/apiService.js';

export class SmartGuideSystem {
    constructor() {
        this.errorHandler = new AdvancedErrorHandler();
        this.stateManager = new StateManager();
        this.currentStep = 0;
        this.studentAttempts = [];
        this.guidanceData = null;
        this.localValidationRules = this.initializeValidationRules();
        this.progressiveHints = [];
        this.isProcessing = false;

        // İpucu sistemi
        this.hintCount = 0;
        this.usedHints = new Set();
        this.isHintVisible = false;

        this.maxSessionAttempts = 8;     // Oturum başına toplam deneme hakkı
        this.totalSessionAttempts = 0;   // Oturum boyunca yapılan toplam deneme sayısı
        
        // YENİ EKLEME: Deneme sistemi
        this.attemptsPerStep = new Map(); // Her adım için deneme sayısı
        this.maxAttemptsPerStep = 3; // Adım başına maksimum deneme
        this.currentStepAttempts = 0; // Mevcut adımdaki deneme sayısı
        this.stepFailed = false; // Adım başarısız oldu mu?

        // YENİ EKLENEN DURUM DEĞİŞKENLERİ
        this.isSessionActive = false; // Oturum aktif mi?
        this.finalState = null; // Oturum nasıl bitti? { reason: 'completed' | 'failed', message: '...' }
        
        // Canvas için gerekli referanslar
        this.canvasManager = null;
        this.activeCanvasId = null;

        // YENİ: Adım zorunluluğu sistemi
        this.stepEnforcementRules = {
            minStepsRequired: 2, // En az 2 adım gerekli
            finalAnswerEarlyThreshold: 0.7, // %70'den erken final cevap verilirse uyarı
            consecutiveFinalAnswers: 0, // Arka arkaya final cevap sayısı
            maxConsecutiveFinalAnswers: 2, // Maksimum arka arkaya final cevap
            adaptiveDifficulty: true // Zorluk derecesine göre uyarlanır
        };

        this.learningPath = {
            totalProblemsAttempted: 0,
            earlyFinalAnswerCount: 0,
            averageStepsCompleted: 0,
            learningScore: 100 // 100'den başlar, suistimal ederse düşer
        };

         this.mistakeHistory = [];
    }
    addMistake(mistakeType) {
        if (mistakeType && typeof mistakeType === 'string') {
            this.mistakeHistory.push(mistakeType);
            console.log('Yeni hata kaydedildi:', this.mistakeHistory);
        }
    }
    // Adım zorunluluğunu kontrol et
    checkStepEnforcement(currentStepIndex, totalSteps, studentInput, isLikelyFinalAnswer) {
        const progressPercentage = (currentStepIndex + 1) / totalSteps;
        const enforcement = {
            allowFinalAnswer: true,
            warningMessage: null,
            penaltyApplied: false,
            requiredStepsRemaining: 0,
            educationalReason: null
        };

        // Çok erken final cevap kontrolü
        if (isLikelyFinalAnswer && progressPercentage < this.stepEnforcementRules.finalAnswerEarlyThreshold) {

            // Arka arkaya final cevap sayısını artır
            this.stepEnforcementRules.consecutiveFinalAnswers++;

            // Eğitim puanını düşür
            this.learningPath.learningScore = Math.max(0, this.learningPath.learningScore - 10);

            if (this.stepEnforcementRules.consecutiveFinalAnswers >= this.stepEnforcementRules.maxConsecutiveFinalAnswers) {
                // Fazla suistimal - adım atlamayı engelle
                enforcement.allowFinalAnswer = false;
                enforcement.warningMessage = `🚫 Adım atlanamaz! Bu problemde adım adım çözüm yapmalısınız. (${Math.ceil((1 - progressPercentage) * totalSteps)} adım kaldı)`;
                enforcement.requiredStepsRemaining = Math.ceil((1 - progressPercentage) * totalSteps);
                enforcement.educationalReason = "Matematik öğrenmek için her adımı anlamanız önemlidir.";
                enforcement.penaltyApplied = true;
            } else {
                // Uyarı ver ama izin ver
                enforcement.warningMessage = `⚠️ Çok hızlı gidiyorsunuz! Öğrenmek için adımları tamamlamanız önerilir. (${this.stepEnforcementRules.maxConsecutiveFinalAnswers - this.stepEnforcementRules.consecutiveFinalAnswers} hak kaldı)`;
                enforcement.educationalReason = "Her adımı çözerek matematik düşünce sürecinizi geliştirebilirsiniz.";
            }

        } else {
            // Normal ilerleyiş - sayacı sıfırla
            this.stepEnforcementRules.consecutiveFinalAnswers = 0;
        }

        return enforcement;
    }

    // Problem tipine göre zorunluluk seviyesini belirle
    calculateEnforcementLevel(problemData) {
        const { adimlar, problemOzeti } = problemData;

        let enforcementLevel = 'normal'; // normal, strict, flexible

        // Problem karmaşıklığını analiz et
        const complexity = this.analyzeProblemComplexity(problemData);

        if (complexity.isSimple && adimlar.length <= 2) {
            enforcementLevel = 'flexible'; // Basit problemlerde esnek
        } else if (complexity.isComplex || adimlar.length >= 4) {
            enforcementLevel = 'strict'; // Karmaşık problemlerde sıkı
        }

        // Öğrenci öğrenme puanına göre ayarla
        if (this.learningPath.learningScore < 70) {
            enforcementLevel = 'strict'; // Düşük puan = sıkı denetim
        }

        return enforcementLevel;
    }

    // Problem karmaşıklığını analiz et
    analyzeProblemComplexity(problemData) {
        const { adimlar, problemOzeti } = problemData;

        let complexityScore = 0;

        // Adım sayısı faktörü
        complexityScore += adimlar.length * 10;

        // Matematik operatörü analizi
        adimlar.forEach(step => {
            const latex = step.cozum_lateks || '';

            // Karmaşık operatörler
            if (latex.includes('\\frac')) complexityScore += 15;
            if (latex.includes('\\sqrt')) complexityScore += 10;
            if (latex.includes('^')) complexityScore += 5;
            if (latex.includes('\\int') || latex.includes('\\sum')) complexityScore += 25;
            if (latex.includes('sin') || latex.includes('cos') || latex.includes('tan')) complexityScore += 15;

            // Denklem sistemi
            if (latex.includes('=') && latex.split('=').length > 2) complexityScore += 20;
        });

        return {
            score: complexityScore,
            isSimple: complexityScore < 30,
            isComplex: complexityScore > 80,
            requiresStrictEnforcement: complexityScore > 60
        };
    }

    // Öğrenci davranışını takip et
    trackLearningBehavior(stepIndex, totalSteps, wasCorrect, wasFinalAnswer) {
        this.learningPath.totalProblemsAttempted++;

        if (wasFinalAnswer && (stepIndex + 1) / totalSteps < 0.7) {
            this.learningPath.earlyFinalAnswerCount++;
        }

        // Ortalama tamamlanan adım sayısını güncelle
        const completedSteps = stepIndex + 1;
        this.learningPath.averageStepsCompleted =
            (this.learningPath.averageStepsCompleted + completedSteps) / 2;

        // Öğrenme puanını güncelle
        if (wasCorrect && !wasFinalAnswer) {
            // Normal adım çözümü ödüllendir
            this.learningPath.learningScore = Math.min(100, this.learningPath.learningScore + 2);
        }
    }

    // Öğrenci performans raporu
    getLearningReport() {
        const earlyAnswerRate = this.learningPath.totalProblemsAttempted > 0 ?
            (this.learningPath.earlyFinalAnswerCount / this.learningPath.totalProblemsAttempted) * 100 : 0;

        let performance = 'excellent';
        if (earlyAnswerRate > 60) performance = 'needs_improvement';
        else if (earlyAnswerRate > 30) performance = 'good';

        return {
            learningScore: this.learningPath.learningScore,
            earlyAnswerRate: Math.round(earlyAnswerRate),
            averageStepsCompleted: Math.round(this.learningPath.averageStepsCompleted * 10) / 10,
            performance: performance,
            recommendation: this.getRecommendation(performance)
        };
    }

    // Öğrenme önerisi
    getRecommendation(performance) {
        const recommendations = {
            excellent: "Harika çalışıyorsunuz! Adım adım çözüm yaklaşımınız matematik anlayışınızı güçlendiriyor.",
            good: "İyi ilerliyorsunuz. Bazı adımları atlamaya çalışıyorsunuz, her adımı çözmeye odaklanın.",
            needs_improvement: "Matematik öğrenmek için adım adım çözüm çok önemli. Final cevapları erken vermeye çalışmak yerine süreci takip edin."
        };

        return recommendations[performance] || recommendations.needs_improvement;
    }



    async initializeGuidance(solutionData) {
        if (!solutionData) {
            throw new Error('Çözüm verisi bulunamadı');
        }

        try {
            this.reset(); 
            
            // YENİ: Oturum başlangıcında durumu aktif et
            this.isSessionActive = true;
            this.finalState = null;

            const totalSteps = solutionData.adimlar ? solutionData.adimlar.length : 0;
            
            if (totalSteps < 3) {
                this.maxAttemptsPerStep = 4;
            } else {
                this.maxAttemptsPerStep = 8;
            }

            this.guidanceData = this.processGuidanceData(solutionData);
            console.log(`Rehberlik sistemi başlatıldı - Toplam adım: ${this.guidanceData.totalSteps}`);
            return this.guidanceData;
        } catch (error) {
            this.errorHandler.handleError(error, {
                operation: 'initializeGuidance',
                fallbackMessage: 'Rehberlik sistemi başlatılamadı'
            });
            throw error;
        }
    }



    // Belirli bir adıma git
    goToStep(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.guidanceData.totalSteps) {
            this.currentStep = stepIndex;
            this.progressiveHints = [];
            return true;
        }
        return false;
    }

    // İpucu göster/gizle - Güncellenmiş versiyon
    toggleHint() {
        this.isHintVisible = !this.isHintVisible;
        this.isCanvasHintActive = this.isHintVisible;

        if (this.isHintVisible && !this.usedHints.has(this.currentStep)) {
            this.hintCount++;
            this.usedHints.add(this.currentStep);
        }

        return {
            isVisible: this.isHintVisible,
            isCanvasActive: this.isCanvasHintActive,
            hintCount: this.hintCount,
            stepHint: this.getCurrentStepHint()
        };
    }

    // Canvas hint durumunu sıfırla
    clearCanvasHint() {
        this.isCanvasHintActive = false;
        this.isHintVisible = false;
    }

    // Adım değiştiğinde hint'i sıfırla
    resetHintForCurrentStep() {
        this.isHintVisible = false;
        this.isCanvasHintActive = false;
    }

    // Mevcut adımın ipucunu al - Sadece sözel
    getCurrentStepHint() {
        if (!this.guidanceData || this.currentStep >= this.guidanceData.totalSteps) {
            return null;
        }

        const stepData = this.guidanceData.steps[this.currentStep];
        return {
            stepNumber: this.currentStep + 1,
            description: stepData.description, // Bu LaTeX içerebilir (çözüm için)
            hint: stepData.ipucu || 'Bu adımda dikkatli düşünün.', // Bu sadece sözel olmalı
            ipucu: stepData.ipucu || 'Bu adımda dikkatli düşünün.', // Ek erişim için
            correctAnswer: stepData.correctAnswer // Bu LaTeX içerebilir (API validasyon için)
        };
    }

    // Genel oturum deneme bilgilerini al
    getSessionAttemptInfo() {
        const remaining = this.maxSessionAttempts - this.totalSessionAttempts;
        return {
            attempts: this.totalSessionAttempts,
            remaining: remaining,
            maxAttempts: this.maxSessionAttempts,
            canAttempt: remaining > 0,
            isFailed: remaining <= 0
        };
    }

    // Sadece mevcut adımdaki deneme sayısını alır (MC logiği için)
    getCurrentStepAttemptCount() {
        return this.attemptsPerStep.get(this.currentStep) || 0;
    }

    // Deneme sayısını artır
    incrementAttempts() {
        // 1. Genel oturum deneme hakkını artır
        if (this.totalSessionAttempts < this.maxSessionAttempts) {
            this.totalSessionAttempts++;
        }

        // 2. Mevcut adımdaki deneme sayısını artır (MC logiği için)
        const stepKey = this.currentStep;
        const currentStepAttempts = this.attemptsPerStep.get(stepKey) || 0;
        this.attemptsPerStep.set(stepKey, currentStepAttempts + 1);
    }

    // Adım başarılı olduğunda çağrılır
    markStepAsSuccess() {
        const stepKey = this.currentStep;
        // Bu adımı başarılı olarak işaretle, deneme sayısını koru
        this.stepFailed = false;
        return {
            stepNumber: this.currentStep + 1,
            attempts: this.attemptsPerStep.get(stepKey) || 1,
            success: true
        };
    }

        /**
     * Mevcut rehberlik oturumunu sonlandırır ve bitiş nedenini kaydeder.
     * @param {'completed' | 'failed'} reason Oturumun bitme nedeni.
     * @param {string} message Kullanıcıya gösterilecek son durum mesajı.
     */
    markSessionAsEnded(reason, message) {
        this.isSessionActive = false;
        this.finalState = { reason, message };
        console.log(`Oturum sonlandırıldı. Neden: ${reason}`);
    }

    // Tüm sistemi sıfırla (3 deneme bittikten sonra)
    resetAllAttempts() {
        this.attemptsPerStep.clear();
        this.currentStepAttempts = 0;
        this.stepFailed = false;
        this.currentStep = 0;
        this.progressiveHints = [];

        // İpucu sistemini de sıfırla
        this.hintCount = 0;
        this.usedHints = new Set();
        this.isHintVisible = false;

        console.log('Tüm deneme sistemi sıfırlandı');
    }

    // Bir sonraki adıma geç (deneme sayısını sıfırla)
    proceedToNextStep() {
        if (this.currentStep < this.guidanceData.totalSteps - 1) {
            this.currentStep++;
            this.progressiveHints = [];
            this.resetHintForCurrentStep();

            // YENİ ADIM İÇİN DENEMELERİ SIFIRLA
            this.currentStepAttempts = 0;
            this.stepFailed = false;

            return true;
        }
        return false; // Son adıma ulaşıldı
    }

    // Belirli bir adıma git
    goToStep(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.guidanceData.totalSteps) {
            this.currentStep = stepIndex;
            this.progressiveHints = [];
            this.resetHintForCurrentStep();
            this.currentStepAttempts = 0; // Bu adıma yeni gelindiği için denemeyi sıfırla
            this.stepFailed = false;
            console.log(`SmartGuide: Adım ${stepIndex + 1}'e atlandı.`);
            return true;
        }
        return false;
    }




    getAttemptStats() {
        let totalAttempts = 0;
        // Map üzerindeki tüm deneme sayılarını topla
        this.attemptsPerStep.forEach((attempts) => {
            totalAttempts += attempts;
        });

        // Eğer hiç deneme yapılmadıysa ve şu an bir deneme yapılıyorsa, onu 1 olarak say.
        if (totalAttempts === 0 && this.currentStepAttempts > 0) {
            totalAttempts = this.currentStepAttempts;
        }

        return {
            totalAttempts: totalAttempts,
            totalSteps: this.guidanceData?.totalSteps || 0,
        };
    }

    // İpucu sayısını al
    getHintStats() {
        return {
            totalHints: this.hintCount,
            usedSteps: Array.from(this.usedHints),
            currentStepUsedHint: this.usedHints.has(this.currentStep)
        };
    }

    // İpucuyu sıfırla (yeni adıma geçerken)
    resetHintForCurrentStep() {
        this.isHintVisible = false;
    }

    // Çözüm verisini rehberlik formatına dönüştür
    processGuidanceData(solutionData) {
        const { adimlar, tamCozumLateks, problemOzeti } = solutionData;

        if (!adimlar || !Array.isArray(adimlar)) {
            throw new Error('Adım bilgileri eksik');
        }

        return {
            totalSteps: adimlar.length,
            problemSummary: problemOzeti,
            steps: adimlar.map((step, index) => ({
                stepNumber: index + 1,
                description: step.adimAciklamasi || `${index + 1}. Adım`,
                correctAnswer: step.cozum_lateks || '',
                hints: this.generateProgressiveHints(step),
                yanlisSecenekler: step.yanlisSecenekler || [],
                validationKeywords: this.extractValidationKeywords(step.cozum_lateks || ''),
                ipucu: step.ipucu || 'Bu adımda dikkatli olun.',
                difficulty: this.calculateStepDifficulty(step)
            }))
        };
    }

    // Progresif ipuçları oluştur
    generateProgressiveHints(stepData) {
        const hints = [];

        // Temel ipucu
        if (stepData.ipucu) {
            hints.push({
                level: 1,
                text: stepData.ipucu,
                type: 'general'
            });
        }

        // Matematiksel ipucu
        if (stepData.cozum_lateks) {
            hints.push({
                level: 2,
                text: 'Bu adımda kullanılacak matematiksel işlem hakkında düşünün.',
                type: 'mathematical'
            });
        }

        // Detaylı ipucu
        hints.push({
            level: 3,
            text: 'Önceki adımdan gelen sonucu kullanmayı unutmayın.',
            type: 'detailed'
        });

        return hints;
    }

    // smartGuide.js'de güncellenmiş reset fonksiyonu

    reset() {

        this.chatHistory = [];
        this.currentStep = 0;
        this.studentAttempts = [];
        this.guidanceData = null;
        this.progressiveHints = [];
        this.isProcessing = false;
        this.chatHistory = [];
        // İpucu verilerini sıfırla
        this.hintCount = 0;
        this.usedHints = new Set();
        this.isHintVisible = false;

        this.totalSessionAttempts = 0; // Toplam deneme sayısını sıfırla

        // Deneme verilerini sıfırla
        this.attemptsPerStep.clear();
        this.currentStepAttempts = 0;
        this.stepFailed = false;

        // YENİ: Zorunluluk verilerini sıfırla (ama öğrenme verilerini koru)
        this.resetEnforcement();

        // EKSİK OLAN EN KRİTİK KISIM BURASIYDI:
        // Oturum durumunu da tamamen sıfırla ki yeni problem taze başlasın.
        this.isSessionActive = false;
        this.finalState = null;
        this.mistakeHistory = [];
        console.log('SmartGuide sistemi tamamen sıfırlandı - yeni problem için hazır');
    }
    // Sadece enforcement verilerini sıfırla (öğrenme verilerini koruyarak)
    resetEnforcement() {
        this.stepEnforcementRules.consecutiveFinalAnswers = 0;
        // learningPath verileri korunur - uzun vadeli öğrenme takibi için
    }

    // Validasyon anahtar kelimeleri çıkar
    extractValidationKeywords(latexString) {
        const keywords = [];

        // Temel matematik operatörleri
        const operators = ['+', '-', '*', '/', '=', '^', '\\sqrt', '\\frac'];
        operators.forEach(op => {
            if (latexString.includes(op)) {
                keywords.push(op);
            }
        });

        // Sayıları çıkar
        const numbers = latexString.match(/\d+/g);
        if (numbers) {
            keywords.push(...numbers);
        }

        return keywords;
    }

    // Adım zorluğunu hesapla
    calculateStepDifficulty(stepData) {
        let difficulty = 1;

        const latex = stepData.cozum_lateks || '';

        // Karmaşık operatörler varsa zorluk artar
        if (latex.includes('\\frac')) difficulty += 2;
        if (latex.includes('\\sqrt')) difficulty += 2;
        if (latex.includes('^')) difficulty += 1;
        if (latex.includes('\\sum') || latex.includes('\\int')) difficulty += 3;

        return Math.min(difficulty, 5); // Max 5 zorluk
    }

    // Lokal validasyon kurallarını başlat
    initializeValidationRules() {
        return {
            // Temel matematik kuralları
            basicMath: {
                addition: /\+/,
                subtraction: /-/,
                multiplication: /\*/,
                division: /\//,
                equals: /=/,
                parentheses: /\(|\)/
            },

            // Yaygın hatalar
            commonErrors: [
                {
                    pattern: /(\d+)\s*[+\-*/]\s*(\d+)\s*=\s*(\d+)/,
                    validator: (match) => {
                        const [, a, op, b, result] = match;
                        const numA = parseInt(a), numB = parseInt(b), numResult = parseInt(result);

                        switch (op.trim()) {
                            case '+': return numA + numB === numResult;
                            case '-': return numA - numB === numResult;
                            case '*': return numA * numB === numResult;
                            case '/': return numA / numB === numResult;
                            default: return false;
                        }
                    }
                }
            ],

            // Matematik sembolleri
            mathSymbols: /[+\-*/=()^√∫∑]/
        };
    }



    async evaluateStudentStep(studentInput, mistakeProfile, inputType = 'text') { // <-- DÜZELTME 1: mistakeProfile parametresi eklendi
        if (this.isProcessing) {
            console.warn("Mevcut bir değerlendirme zaten devam ediyor.");
            return;
        }

        const sessionAttemptInfo = this.getSessionAttemptInfo();
        if (!sessionAttemptInfo.canAttempt) {
            return {
                isCorrect: false,
                coach_response: "Tüm deneme hakların bitti. İstersen özete dönüp çözümü inceleyebilirsin.",
                proceed_to_next_step: false,
                is_game_over: true 
            };
        }

        this.isProcessing = true;

        try {
            const currentStepData = this.guidanceData.steps[this.currentStep];

            // DÜZELTME 2: Gelen mistakeProfile parametresi validateStudentStep'e doğru şekilde iletiliyor
            const validationResult = await validateStudentStep(studentInput, {
                allSteps: this.guidanceData.steps,
                currentStepIndex: this.currentStep,
                correctAnswer: currentStepData.correctAnswer
            }, this.mistakeHistory, mistakeProfile); 


            if (!validationResult || !validationResult.feedbackMessage) {
                throw new Error("API'den beklenen formatta bir değerlendirme yanıtı alınamadı.");
            }
            
            if (validationResult.isCorrect) {
                this.markStepAsSuccess();
            }

            this.trackLearningBehavior(
                this.currentStep,
                this.guidanceData.totalSteps,
                validationResult.isCorrect,
                validationResult.isFinalAnswer
            );
            
            return {
                isCorrect: validationResult.isCorrect,
                coach_response: validationResult.feedbackMessage,
                hint: validationResult.hintForNext,
                proceed_to_next_step: validationResult.proceed_to_next_step || false,
                isFinalAnswer: validationResult.isFinalAnswer || false,
                isStepSkipped: validationResult.isStepSkipped || false,
                mistake_type: validationResult.mistake_type || null
            };

        } catch (error) {
            this.errorHandler.handleError(error, { operation: 'evaluateStudentStep' });
            return {
                isCorrect: false,
                coach_response: "Cevabını değerlendirirken bir sorunla karşılaştım. Lütfen bir süre sonra tekrar dene.",
                proceed_to_next_step: false
            };
        } finally {
            this.isProcessing = false;
        }
    }




    // Mevcut adım bilgilerini al
    getCurrentStepInfo() {
        if (!this.guidanceData || this.currentStep >= this.guidanceData.totalSteps) {
            return null;
        }

        const stepData = this.guidanceData.steps[this.currentStep];
        return {
            stepNumber: stepData.stepNumber,
            description: stepData.description,
            totalSteps: this.guidanceData.totalSteps,
            progress: ((this.currentStep + 1) / this.guidanceData.totalSteps) * 100,
            difficulty: stepData.difficulty,
            hasHints: stepData.hints.length > 0
        };
    }

    // İlerleme durumunu al
    getProgress() {
        return {
            currentStep: this.currentStep + 1,
            totalSteps: this.guidanceData?.totalSteps || 0,
            completedSteps: this.currentStep,
            attempts: this.studentAttempts.length
        };
    }




    // Bir sonraki adıma geç
    proceedToNextStep() {
        if (this.currentStep < this.guidanceData.totalSteps - 1) {
            this.currentStep++;
            this.progressiveHints = [];
            this.resetHintForCurrentStep(); // İpucuyu sıfırla
            return true;
        }
        return false; // Son adıma ulaşıldı
    }

    // Önceki adıma geç
    goToPreviousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.progressiveHints = [];
            this.resetHintForCurrentStep(); // İpucuyu sıfırla
            return true;
        }
        return false; // İlk adımda
    }

    // Canvas referansını ayarla
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
    }

    // Aktif canvas ID'sini ayarla
    setActiveCanvasId(canvasId) {
        this.activeCanvasId = canvasId;
    }


}

// Singleton pattern için export
export const smartGuide = new SmartGuideSystem();