// www/js/modules/purchaseManager.js - YENİ FİYATLANDIRMA MODELİ İÇİN NİHAİ VERSİYON

// --- Ortam Kontrolü ---
const isNativePlatform = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
let Purchases;

if (isNativePlatform) {
    ({ Purchases } = Capacitor.Plugins);
}

// --- AYARLAR ---
// RevenueCat panelinden -> API Keys -> Public API Keys -> Google
const REVENUECAT_API_KEY = 'YOUR_REVENUECAT_GOOGLE_API_KEY';

// --- YENİ FİYATLANDIRMA MODELİ ---
const SUBSCRIPTION_PLANS = {
    FREE: {
        id: 'free',
        name: 'Deneme Sürüşü',
        monthlyTokens: 10,
        dailyAdLimit: 3,
        price: 0,
        features: ['10 Jeton/Ay', 'Günde 3 Reklam Sınırı', 'Temel Özellikler']
    },
    PRO: {
        id: 'pro',
        name: 'PRO ("Sınav Fatihi")',
        monthlyTokens: 100,
        dailyAdLimit: 0, // Reklamsız
        monthlyPrice: 199,
        yearlyPrice: 1999,
        features: ['100 Jeton/Ay', 'Reklamsız', 'Öncelikli Destek', 'Gelişmiş Analitik']
    },
    MASTER: {
        id: 'master',
        name: 'MASTER ("Olimpiyat Yıldızı")',
        monthlyTokens: 250,
        dailyAdLimit: 0, // Reklamsız
        monthlyPrice: 349,
        yearlyPrice: 3499,
        features: ['250 Jeton/Ay', 'Reklamsız', 'VIP Destek', 'Özel İçerikler', 'Hızlı Yanıt']
    }
};

const TOKEN_PACKAGES = {
    QUICK_BOOST: {
        id: 'token_10',
        name: 'Hızlı Takviye',
        tokens: 10,
        price: 29.99,
        description: 'Acil durumlar için hızlı çözüm'
    },
    WEEKEND_SAVIOR: {
        id: 'token_25',
        name: 'Hafta Sonu Kurtarıcı',
        tokens: 25,
        price: 69.99,
        description: 'Hafta sonu çalışmaları için ideal'
    },
    EXAM_WEEK: {
        id: 'token_50',
        name: 'Sınav Haftası Paketi',
        tokens: 50,
        price: 129.99,
        description: 'Sınav öncesi yoğun çalışma için'
    }
};

// --- Web Tarayıcısı için Mock (Taklit) Satın Alma Yöneticisi ---
const mockPurchaseManager = {
    isInitialized: false,
    currentUser: null,
    
    async initialize(userId) {
        console.log(`PURCHASE MOCK: Tarayıcıda çalışıyor, RevenueCat başlatıldı (simülasyon) - Kullanıcı: ${userId}`);
        this.currentUser = userId;
        this.isInitialized = true;
    },
    
    async getOfferings() {
        console.log('PURCHASE MOCK: Sahte teklifler getiriliyor...');
        
        // Abonelik paketleri
        const subscriptionPackages = [
            {
                identifier: 'pro_monthly',
                product: { 
                    identifier: 'pro_monthly', 
                    priceString: `${SUBSCRIPTION_PLANS.PRO.monthlyPrice} TL/Ay`,
                    price: SUBSCRIPTION_PLANS.PRO.monthlyPrice * 100 // Kuruş cinsinden
                },
                packageType: 'MONTHLY',
                planType: 'subscription'
            },
            {
                identifier: 'pro_yearly',
                product: { 
                    identifier: 'pro_yearly', 
                    priceString: `${SUBSCRIPTION_PLANS.PRO.yearlyPrice} TL/Yıl`,
                    price: SUBSCRIPTION_PLANS.PRO.yearlyPrice * 100
                },
                packageType: 'ANNUAL',
                planType: 'subscription',
                discount: '4 Ay Bedava!'
            },
            {
                identifier: 'master_monthly',
                product: { 
                    identifier: 'master_monthly', 
                    priceString: `${SUBSCRIPTION_PLANS.MASTER.monthlyPrice} TL/Ay`,
                    price: SUBSCRIPTION_PLANS.MASTER.monthlyPrice * 100
                },
                packageType: 'MONTHLY',
                planType: 'subscription'
            },
            {
                identifier: 'master_yearly',
                product: { 
                    identifier: 'master_yearly', 
                    priceString: `${SUBSCRIPTION_PLANS.MASTER.yearlyPrice} TL/Yıl`,
                    price: SUBSCRIPTION_PLANS.MASTER.yearlyPrice * 100
                },
                packageType: 'ANNUAL',
                planType: 'subscription',
                discount: '%17 İndirim'
            }
        ];
        
        // Jeton paketleri
        const tokenPackages = Object.values(TOKEN_PACKAGES).map(pkg => ({
            identifier: pkg.id,
            product: { 
                identifier: pkg.id, 
                priceString: `${pkg.price} TL`,
                price: pkg.price * 100
            },
            packageType: 'LIFETIME',
            planType: 'token',
            tokens: pkg.tokens,
            description: pkg.description
        }));
        
        return [...subscriptionPackages, ...tokenPackages];
    },
    
    async purchasePackage(packageToPurchase) {
        console.log(`PURCHASE MOCK: "${packageToPurchase.identifier}" paketi satın alınıyor (simülasyon)...`);
        
        // Simülasyon: Kullanıcının satın almayı onayladığını varsayalım
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('PURCHASE MOCK: Satın alma başarılı (simülasyon).');
        
        if (packageToPurchase.planType === 'token') {
            // Jeton paketi satın alındı
            return {
                success: true,
                type: 'token',
                tokens: packageToPurchase.tokens,
                message: `${packageToPurchase.tokens} jeton başarıyla eklendi!`
            };
        } else {
            // Abonelik satın alındı
            const planId = packageToPurchase.identifier.split('_')[0]; // pro_monthly -> pro
            const plan = SUBSCRIPTION_PLANS[planId.toUpperCase()];
            
            return {
                success: true,
                type: 'subscription',
                tier: planId,
                expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                monthlyTokens: plan.monthlyTokens,
                message: `${plan.name} aboneliği aktif edildi!`
            };
        }
    },
    
    async checkSubscription() {
        console.log('PURCHASE MOCK: Abonelik durumu kontrol ediliyor (simülasyon).');
        return { tier: 'free', monthlyTokens: 10, dailyAdLimit: 3 };
    },
    
    async getFirstTimeDiscount() {
        // İlk ay %50 indirim kontrolü
        return {
            isEligible: true,
            discount: 50,
            message: 'İlk ay %50 indirim!'
        };
    }
};

// --- Gerçek Native Satın Alma Yöneticisi ---
const nativePurchaseManager = {
    isInitialized: false,
    currentUser: null,
    
    async initialize(userId) {
        if (!userId || !Purchases) return;
        try {
            await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
            await Purchases.logIn(userId);
            this.currentUser = userId;
            console.log(`✅ RevenueCat (Native) başlatıldı.`);
            this.isInitialized = true;
        } catch (error) {
            console.error('❌ RevenueCat (Native) başlatma hatası:', error);
        }
    },
    
    async getOfferings() {
        if (!this.isInitialized) return null;
        try {
            const offerings = await Purchases.getOfferings();
            return offerings.current?.availablePackages || [];
        } catch (error) {
            console.error('❌ (Native) Teklifler alınamadı:', error);
            return null;
        }
    },
    
    async purchasePackage(packageToPurchase) {
        if (!this.isInitialized) {
            return { success: false, message: 'Satın alma sistemi başlatılmadı.' };
        }
        
        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });
            console.log(`(Native) Satın alma başarılı.`);
            
            // Satın alma sonrası abonelik durumunu kontrol et
            const subscriptionInfo = await this.checkSubscription(customerInfo);
            
            return {
                success: true,
                type: 'subscription',
                ...subscriptionInfo
            };
            
        } catch (error) {
            if (error.userCancelled) {
                console.log('(Native) Kullanıcı satın almayı iptal etti.');
                return { success: false, userCancelled: true };
            }
            console.error('❌ (Native) Satın alma hatası:', error);
            return { success: false, message: 'Satın alma sırasında bir hata oluştu.' };
        }
    },
    
    async checkSubscription(customerInfo = null) {
        if (!this.isInitialized) return { tier: 'free', monthlyTokens: 10, dailyAdLimit: 3 };
        
        try {
            const info = customerInfo || await Purchases.getCustomerInfo();
            
            // RevenueCat entitlement'larına göre kontrol
            if (info.entitlements.active['master_access']) {
                const entitlement = info.entitlements.active['master_access'];
                return {
                    tier: 'master',
                    expiresDate: entitlement.expirationDate,
                    monthlyTokens: SUBSCRIPTION_PLANS.MASTER.monthlyTokens,
                    dailyAdLimit: SUBSCRIPTION_PLANS.MASTER.dailyAdLimit
                };
            }
            
            if (info.entitlements.active['pro_access']) {
                const entitlement = info.entitlements.active['pro_access'];
                return {
                    tier: 'pro',
                    expiresDate: entitlement.expirationDate,
                    monthlyTokens: SUBSCRIPTION_PLANS.PRO.monthlyTokens,
                    dailyAdLimit: SUBSCRIPTION_PLANS.PRO.dailyAdLimit
                };
            }
            
            return { tier: 'free', monthlyTokens: 10, dailyAdLimit: 3 };
            
        } catch (error) {
            console.error("(Native) Üyelik durumu kontrol edilemedi:", error);
            return { tier: 'free', monthlyTokens: 10, dailyAdLimit: 3, error: true };
        }
    },
    
    async getFirstTimeDiscount() {
        try {
            // RevenueCat'ten ilk kez alım indirimi kontrolü
            const customerInfo = await Purchases.getCustomerInfo();
            const isFirstTime = !customerInfo.originalPurchaseDate;
            
            return {
                isEligible: isFirstTime,
                discount: isFirstTime ? 50 : 0,
                message: isFirstTime ? 'İlk ay %50 indirim!' : 'İndirim uygun değil'
            };
        } catch (error) {
            console.error('İndirim kontrolü hatası:', error);
            return { isEligible: false, discount: 0, message: 'Kontrol edilemedi' };
        }
    }
};

// --- Ortama göre doğru yöneticiyi dışa aktar ---
export const purchaseManager = isNativePlatform ? nativePurchaseManager : mockPurchaseManager;

// --- Yardımcı fonksiyonlar ---
export const getSubscriptionPlan = (tier) => SUBSCRIPTION_PLANS[tier.toUpperCase()] || SUBSCRIPTION_PLANS.FREE;
export const getTokenPackage = (id) => TOKEN_PACKAGES[id];
export const getAllPlans = () => Object.values(SUBSCRIPTION_PLANS);
export const getAllTokenPackages = () => Object.values(TOKEN_PACKAGES);