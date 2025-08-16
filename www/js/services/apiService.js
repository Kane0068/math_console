// www/js/services/apiService.js - YENİDEN DENEME MEKANİZMASI DÜZELTİLMİŞ NİHAİ VERSİYON

import {
    buildUnifiedSolutionPrompt,
    buildCorrectionPrompt,
    buildFlexibleStepValidationPrompt,
    buildVerificationPrompt,
    buildInputModerationPrompt
} from './promptBuilder.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// --- Ayarlar ---
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1500;
const functions = getFunctions(undefined, 'europe-west1');
// Sunucu fonksiyonunu bir kez tanımla
const handleGeminiRequest = httpsCallable(functions, 'handleGeminiRequest');

// --- FOTOĞRAF DOĞRULAMA FONKSİYONU ---
export function validateMathPhoto(imageBase64) {
    if (!imageBase64) {
        return { 
            isValid: false, 
            reason: 'Fotoğraf verisi bulunamadı',
            category: 'no_image_data',
            suggestions: ['Lütfen bir fotoğraf yükleyin']
        };
    }

    // Base64 format kontrolü
    if (!imageBase64.startsWith('data:image/') && !/^[A-Za-z0-9+/]*={0,2}$/.test(imageBase64)) {
        return { 
            isValid: false, 
            reason: 'Geçersiz fotoğraf formatı',
            category: 'invalid_format',
            suggestions: ['Lütfen geçerli bir resim dosyası yükleyin']
        };
    }

    // Fotoğraf boyutu kontrolü (çok büyük fotoğraflar spam olabilir)
    const base64Length = imageBase64.length;
    const estimatedSizeKB = Math.ceil(base64Length * 0.75 / 1024);
    
    if (estimatedSizeKB > 5000) { // 5MB limit
        return { 
            isValid: false, 
            reason: 'Fotoğraf boyutu çok büyük',
            category: 'too_large',
            suggestions: [
                'Fotoğraf boyutunu küçültün',
                'Maksimum 5MB fotoğraf yükleyin',
                'Fotoğrafı sıkıştırın'
            ]
        };
    }

    // Fotoğraf çok küçükse (muhtemelen boş veya anlamsız)
    if (estimatedSizeKB < 10) {
        return { 
            isValid: false, 
            reason: 'Fotoğraf çok küçük',
            category: 'too_small',
            suggestions: [
                'Daha net bir fotoğraf çekin',
                'Fotoğrafın tamamı görünsün',
                'Yeterli ışık olduğundan emin olun'
            ]
        };
    }

    // Fotoğraf içeriği kontrolü KALDIRILDI - API'ye devredildi
    // Sadece temel format ve boyut kontrolleri yapılıyor
    // Matematik içerik kontrolü API'de yapılacak

    // Başarılı fotoğraf doğrulama
    return { 
        isValid: true, 
        reason: 'Geçerli fotoğraf formatı',
        category: 'valid_photo',
        estimatedSizeKB: estimatedSizeKB,
        suggestions: ['Fotoğraf API\'ye gönderiliyor...']
    };
}

// --- GELİŞMİŞ MATEMATİK SORUSU KONTROL FONKSİYONU ---
export function validateMathProblem(input) {
    if (!input || typeof input !== 'string') {
        return { 
            isValid: false, 
            reason: 'Boş veya geçersiz girdi',
            category: 'invalid_input',
            suggestions: ['Lütfen bir matematik sorusu yazın veya çizin']
        };
    }

    const trimmedInput = input.trim();
    
    // Çok kısa girdi kontrolü
    if (trimmedInput.length < 3) {
        return { 
            isValid: false, 
            reason: 'Çok kısa girdi',
            category: 'too_short',
            suggestions: ['En az 3 karakter yazın', 'Örnek: 2+2=?', 'Örnek: x+5=10']
        };
    }

    // Çok uzun girdi kontrolü (spam önleme)
    if (trimmedInput.length > 1000) {
        return { 
            isValid: false, 
            reason: 'Çok uzun girdi',
            category: 'too_long',
            suggestions: ['Sorunuzu daha kısa tutun', 'Maksimum 1000 karakter']
        };
    }

    // Matematik olmayan içerik kontrolü (BASİTLEŞTİRİLDİ)
    const nonMathPatterns = [
        // Sadece selamlaşma ve sohbet (çok basit)
        /^(merhaba|selam|nasılsın|iyi günler|günaydın|iyi akşamlar|hoşça kal|görüşürüz)$/i,
        /^(teşekkür|sağol|eyvallah|rica ederim|ne demek|bir şey değil)$/i,
        /^(naber|ne haber|iyi misin)$/i,
        // Sadece yardım istekleri
        /^(yardım|yardım et|nasıl kullanılır|destek)$/i,
        // Sadece test mesajları
        /^(test|deneme|çalışıyor mu|çalışıyor|çalışmıyor|hata|bug)$/i
    ];

    for (const pattern of nonMathPatterns) {
        if (pattern.test(trimmedInput)) {
            return { 
                isValid: false, 
                reason: 'Matematik sorusu değil',
                category: 'not_math',
                suggestions: [
                    'Sayılar ve işlemler içeren sorular sorun',
                    'Geometri problemleri çözün',
                    'Denklemler yazın',
                    'Problemler anlatın',
                    'Örnek: 2x + 5 = 15',
                    'Örnek: 15 + 27 = ?',
                    'Örnek: Bir üçgenin alanını bul'
                ]
            };
        }
    }

    // Birden fazla matematik sorusu tespiti (BASİTLEŞTİRİLDİ)
    // Sadece çok açık çoktan seçmeli sorular reddediliyor
    const multipleQuestionIndicators = [
        /(a\)|b\)|c\)|d\)|e\)|f\)|g\)|h\)|i\)|j\))/gi, // Çoktan seçmeli soru işaretleri
        /(a\.|b\.|c\.|d\.|e\.|f\.|g\.|h\.|i\.|j\.)/gi, // Çoktan seçmeli soru işaretleri
        /(1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.|9\.|10\.).*(soru|problem|denklem)/gi // Numaralı sorular
    ];

    let multipleQuestionCount = 0;
    
    for (const pattern of multipleQuestionIndicators) {
        const matches = trimmedInput.match(pattern);
        if (matches && matches.length > 2) {
            multipleQuestionCount += matches.length - 2;
        }
    }

    // Sadece çok açık çoktan seçmeli sorular reddediliyor
    if (multipleQuestionCount > 2) {
        return { 
            isValid: false, 
            reason: 'Çok fazla çoktan seçmeli soru tespit edildi',
            category: 'multiple_questions',
            suggestions: [
                'Lütfen tek seferde bir soru sorun',
                'Soruları ayrı ayrı girin'
            ]
        };
    }

    // Matematik içerik kontrolü (genişletilmiş)
    const mathPatterns = [
        // Temel matematik operatörleri
        /[+\-*/=<>≤≥≠≈]/,
        // Parantezler ve gruplama
        /[()\[\]{}]/,
        // Yüzde ve permil işaretleri
        /[%‰]/,
        // Kök işaretleri
        /[√∛∜]/,
        // Matematik sabitleri
        /[πτφ]/,
        // Açı birimleri
        /[°′″]/,
        // Üs işaretleri
        /[\^]/,
        // Logaritma
        /log|ln/i,
        // Trigonometrik fonksiyonlar
        /sin|cos|tan|cot|sec|csc/i,
        // Sayılar
        /\d+/,
        // Türkçe matematik terimleri
        /(kare|küp|kök|çarpı|bölü|artı|eksi|eşit|küçük|büyük|topla|çıkar|çarp|böl)/i,
        // Matematik fiilleri
        /(denklem|eşitlik|formül|hesapla|bul|çöz|bulun|hesaplayın|çözün)/i,
        // Geometri terimleri
        /(alan|çevre|hacim|açı|kenar|yükseklik|taban|hipotenüs|yarıçap|çap|çevre|perimetre)/i,
        // Sayı türleri
        /(kesir|ondalık|tam sayı|rasyonel|irrasyonel|asal|bileşik|pozitif|negatif)/i,
        // İşlem türleri
        /(toplam|fark|çarpım|bölüm|kalan|mod|faktöriyel|permütasyon|kombinasyon)/i,
        // Değişkenler
        /(x|y|z|a|b|c|n|k|m|p|q|r|s|t|u|v|w)/i,
        // Problem içerikleri
        /(elma|armut|kalem|kitap|öğrenci|sınıf|okul|ev|araba|para|zaman|saat|dakika|saniye|metre|kilogram|litre)/i,
        // Matematiksel ifadeler
        /(kaç|ne kadar|kaç tane|kaç adet|kaç metre|kaç saat|kaç lira|kaç öğrenci)/i,
        // Karşılaştırma
        /(daha|daha az|daha çok|en az|en çok|eşit|farklı|aynı|benzer)/i
    ];

    let mathScore = 0;
    let detectedMathElements = [];
    
    for (const pattern of mathPatterns) {
        if (pattern.test(trimmedInput)) {
            mathScore++;
            // Hangi matematik öğelerinin tespit edildiğini kaydet
            const match = trimmedInput.match(pattern);
            if (match && !detectedMathElements.includes(match[0])) {
                detectedMathElements.push(match[0]);
            }
        }
    }

    // Matematik skor kontrolü KALDIRILDI - API'ye devredildi
    // Sadece temel format kontrolleri yapılıyor
    // Matematik içerik kontrolü API'de yapılacak

    // Basit matematik ifadeleri için soru formatı kontrolü kaldırıldı
    // API'nin karar vermesine izin veriliyor

    // Başarılı metin validasyonu
    return { 
        isValid: true, 
        reason: 'Geçerli metin formatı',
        category: 'valid_math',
        suggestions: ['Metin API\'ye gönderiliyor...']
    };
}

// --- Yardımcı Fonksiyonlar (Değişiklik Yok) ---
function extractJson(text) {
    if (!text || typeof text !== 'string') return null;
    const jsonRegex = /```(json)?\s*(\{[\s\S]*\})\s*```/;
    const match = text.match(jsonRegex);
    if (match && match[2]) return match[2];
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    return null;
}

function safeJsonParse(jsonString) {
    if (!jsonString) return null;
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('JSON Parse Hatası:', error.message);
        return null;
    }
}

// --- AKILLI VEKİLİ ÇAĞIRAN MERKEZİ FONKSİYON (GÜÇLENDİRİLDİ) ---
async function callGeminiSmart(sessionType, initialPrompt, imageBase64, onProgress) {
    let lastError = null;
    let lastFaultyResponse = '';
    let currentPrompt = initialPrompt;
    let delay = INITIAL_DELAY;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 1 && onProgress) {
            const message = lastError && lastError.toLowerCase().includes('json')
                ? 'Yanıt formatı düzeltiliyor...'
                : `Geçici bir sorun oluştu. Yeniden denenecek...`;
            onProgress(message);
        }

        try {
            const payload = {
                prompt: currentPrompt,
                imageBase64: imageBase64,
                // Yeniden deneme ise (attempt > 1), sessionType'ı her zaman 'continue' yap (ücretsiz)
                sessionType: (attempt > 1) ? 'continue' : sessionType
            };

            const result = await handleGeminiRequest(payload);
            const rawText = result.data.responseText;

            if (!rawText) throw new Error('API yanıtı boş geldi.');

            lastFaultyResponse = rawText;
            const jsonString = extractJson(rawText);
            if (!jsonString) throw new Error('Yanıt içinde JSON formatı bulunamadı.');

            const parsedJson = safeJsonParse(jsonString);
            if (!parsedJson) throw new Error('JSON parse edilemedi (Syntax hatası).');

            console.log(`✅ API isteği Deneme #${attempt} başarılı!`);
            return parsedJson; // BAŞARILI! Fonksiyondan ve döngüden çık.

        } catch (error) {
            // Firebase'den gelen HttpsError'ları burada yakala ve kullanıcıya göster.
            // Bunlar yeniden denenecek hatalar değildir (örn: "resource-exhausted").
            if (error.code && error.code !== 'cancelled' && error.code !== 'deadline-exceeded') {
                console.error(`Firebase Fonksiyon Hatası (${error.code}): ${error.message}`);
                
                // Firebase hata kodlarını kullanıcı dostu mesajlara çevir
                let userFriendlyMessage = error.message;
                switch (error.code) {
                    case 'resource-exhausted':
                        userFriendlyMessage = 'Şu anda sistemlerimiz yoğun. Lütfen birkaç dakika sonra tekrar deneyin.';
                        break;
                    case 'deadline-exceeded':
                        userFriendlyMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
                        break;
                    case 'invalid-argument':
                        userFriendlyMessage = 'Gönderilen veri formatı uygun değil. Lütfen soruyu kontrol edin.';
                        break;
                    case 'not-found':
                        userFriendlyMessage = 'İstenen kaynak bulunamadı. Lütfen tekrar deneyin.';
                        break;
                    case 'permission-denied':
                        userFriendlyMessage = 'Bu işlem için yetkiniz bulunmuyor.';
                        break;
                    case 'already-exists':
                        userFriendlyMessage = 'Bu işlem zaten yapılmış.';
                        break;
                    case 'failed-precondition':
                        userFriendlyMessage = 'İşlem ön koşulları sağlanamadı.';
                        break;
                    case 'aborted':
                        userFriendlyMessage = 'İşlem iptal edildi.';
                        break;
                    case 'out-of-range':
                        userFriendlyMessage = 'İstek sınırlar dışında.';
                        break;
                    case 'unimplemented':
                        userFriendlyMessage = 'Bu özellik henüz desteklenmiyor.';
                        break;
                    case 'internal':
                        userFriendlyMessage = 'Sunucu iç hatası. Lütfen daha sonra tekrar deneyin.';
                        break;
                    case 'unavailable':
                        userFriendlyMessage = 'Servis şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
                        break;
                    case 'data-loss':
                        userFriendlyMessage = 'Veri kaybı oluştu. Lütfen tekrar deneyin.';
                        break;
                    case 'unauthenticated':
                        userFriendlyMessage = 'Giriş yapmanız gerekiyor.';
                        break;
                }
                
                // Hata mesajını index.js'in yakalaması için yeniden fırlat.
                throw new Error(userFriendlyMessage); 
            }

            // Diğer hatalar (JSON, ağ hatası vb.) için yeniden deneme mantığına devam et.
            lastError = error.message || 'Bilinmeyen bir hata oluştu.';
            console.warn(`Deneme #${attempt} başarısız: ${lastError}`);

            if (attempt >= MAX_RETRIES) break; // Son deneme ise döngüyü kır.

            if (lastError.toLowerCase().includes('json')) {
                currentPrompt = buildCorrectionPrompt(initialPrompt, lastFaultyResponse, lastError);
                // JSON hatalarında bekleme, hemen yeniden dene.
                continue;
            }

            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }

    // Eğer döngü biterse ve hala bir sonuç yoksa, bu nihai başarısızlıktır.
    console.error("Tüm API denemeleri başarısız oldu. Son Hata:", lastError);
    // index.js'in yakalaması için son hatayı fırlat.
    throw new Error(`API ile iletişim kurulamadı: ${lastError}`);
}

// --- Dışa Aktarılan Fonksiyonlar (Değişiklik Yok) ---
// Bu fonksiyonlar artık yukarıdaki güçlendirilmiş callGeminiSmart'ı kullanacak.

export async function getUnifiedSolution(problemContext, imageBase64, onProgress) {
    if (onProgress) onProgress('Çözüm yolu oluşturuluyor...');
    const generationPrompt = buildUnifiedSolutionPrompt(problemContext);
    
    // 1. ADIM: Yapay zekadan ilk çözüm taslağını iste.
    // callGeminiSmart, bozuk JSON gibi temel format hatalarını zaten kendi içinde 3 kez deneyerek çözmeye çalışır.
    const initialSolution = await callGeminiSmart('start', generationPrompt, imageBase64, onProgress);

    // Eğer ilk denemelerden sonra bile geçerli bir çözüm alınamazsa, işlemi sonlandır.
    if (!initialSolution) {
        console.error("İlk çözüm oluşturma aşamasında API'den geçerli bir yanıt alınamadı.");
        return null;
    }

    // --- YENİ VE DAHA GÜÇLÜ GARANTİ MEKANİZMASI ---
    // 2. ADIM: Gelen ilk çözümü, zorluk seviyesine bakmaksızın, her zaman bir doğrulama ve iyileştirme sürecine sok.
    if (onProgress) onProgress('Çözüm kalite kontrolünden geçiriliyor...');
    
    // `buildVerificationPrompt`, yapay zekaya şu komutu verir:
    // "Bu JSON'ı al, kendi kalite kontrol listene göre (matematiksel doğruluk, formatlama, pedagojik kalite)
    // analiz et. Eksik veya hatalı bulduğun her şeyi düzelt ve bana mükemmel halini geri ver."
    const verificationPrompt = buildVerificationPrompt(JSON.stringify(initialSolution, null, 2));
    
    // 'continue' session tipi ile bu ikinci kontrolü ücretsiz (veya daha düşük maliyetli) hale getiriyoruz.
    const finalVerifiedSolution = await callGeminiSmart('continue', verificationPrompt, null, onProgress);

    // 3. ADIM: Eğer doğrulama sürecinden geçmiş, daha iyi bir çözüm varsa onu, yoksa ilk çözümü kullan.
    // Bu, doğrulama adımında bir hata oluşsa bile kullanıcının en azından bir çözüm görmesini sağlar.
    const finalSolution = finalVerifiedSolution || initialSolution;
    
    // 4. ADIM: API'den gelen yanıtta matematik sorusu kontrolü
    if (finalSolution && finalSolution._fallback === true) {
        // API bu sorunun matematik sorusu olmadığını belirtti
        finalSolution._error = 'Bu bir matematik sorusu değil veya birden fazla soru içeriyor.';
        finalSolution._errorCategory = 'api_validation_failed';
    }
    
    return finalSolution;
}

export async function validateStudentStep(studentInput, stepData, mistakeHistory, mistakeProfile) { // mistakeProfile eklendi
    const promptText = buildFlexibleStepValidationPrompt(studentInput, stepData, mistakeHistory, mistakeProfile); // mistakeProfile iletildi
    return await callGeminiSmart('continue', promptText, null, () => {});
}

export async function moderateUserInput(userInput) {
    const prompt = buildInputModerationPrompt(userInput);
    return await callGeminiSmart('continue', prompt, null, () => {});
}