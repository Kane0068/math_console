// functions/index.js - NİHAİ AKILLI VEKİL (INTELLIGENT PROXY) VERSİYONU

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

// --- Ayarlar ---
const GEMINI_API_KEY = "AIzaSyDbjH9TXIFLxWH2HuYJlqIFO7Alhk1iQQs"; // API Anahtarınız burada güvende
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const REGION = "europe-west1";
const DAILY_FREE_QUERY_LIMIT = 3;

// =================================================================================
// TEK VE AKILLI SUNUCU FONKSİYONU: handleGeminiRequest
// =================================================================================
exports.handleGeminiRequest = onCall({ region: REGION, cors: true, timeoutSeconds: 120 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Bu işlemi yapmak için giriş yapmalısınız.");
    }

    const { prompt, imageBase64, sessionType } = request.data; // sessionType parametresini al
    if (!prompt) {
        throw new HttpsError("invalid-argument", "İstek 'prompt' içermelidir.");
    }
    if (!sessionType) {
        throw new HttpsError("invalid-argument", "İstek 'sessionType' ('start' veya 'continue') içermelidir.");
    }

    // --- Sadece 'start' oturumlarında kredi kontrolü ve düşme işlemi yap ---
    if (sessionType === 'start') {
        const uid = request.auth.uid;
        const userRef = db.collection("users").doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new HttpsError("not-found", "Kullanıcı veritabanında bulunamadı.");
        }

        const userData = userDoc.data();
        const sub = userData.subscription || { tier: 'free', monthlyQueryCount: 0, monthlyQueryLimit: 0 };
        const todayStr = new Date().toISOString().split('T')[0];
        let canQuery = false;
        let updatePayload = {};

        if (userData.lastQueryDate !== todayStr) {
            await userRef.update({ dailyQueryCount: 0, lastQueryDate: todayStr });
            userData.dailyQueryCount = 0;
        }

        if (userData.tokenQueries && userData.tokenQueries > 0) {
            canQuery = true;
            updatePayload.tokenQueries = admin.firestore.FieldValue.increment(-1);
        } else if (sub.tier !== 'free' && sub.monthlyQueryCount < sub.monthlyQueryLimit) {
            canQuery = true;
            updatePayload['subscription.monthlyQueryCount'] = admin.firestore.FieldValue.increment(1);
        } else if (userData.dailyQueryCount < DAILY_FREE_QUERY_LIMIT) {
            canQuery = true;
            updatePayload.dailyQueryCount = admin.firestore.FieldValue.increment(1);
        }

        if (!canQuery) {
            throw new HttpsError("resource-exhausted", "Tüm sorgu haklarınız bitti.");
        }
        await userRef.update(updatePayload);
        console.log(`Kullanıcı ${uid} için 1 kredi düşüldü (sessionType: start).`);
    } else {
        console.log(`Kredi düşülmedi (sessionType: continue).`);
    }

    // --- Gemini API İsteği ---
    try {
        const payloadParts = [{ text: prompt }];
        if (imageBase64) {
            payloadParts.push({ inlineData: { mimeType: "image/png", data: imageBase64 } });
        }
        
        const payload = { 
            contents: [{ role: "user", parts: payloadParts }],
            generationConfig: { responseMimeType: "application/json" },
        };

        const result = await model.generateContent(payload);
        const responseText = result.response.text();
        
        // Ham metni istemciye geri gönder, istemci zekası gerisini halledecek.
        return { responseText: responseText };

    } catch (error) {
        console.error("Gemini API hatası:", error);
        throw new HttpsError("internal", "Yapay zeka servisine erişilirken bir hata oluştu.");
    }
});