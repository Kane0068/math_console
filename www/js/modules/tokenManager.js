// www/js/modules/tokenManager.js - JETON YÖNETİM SİSTEMİ

import { purchaseManager, getSubscriptionPlan } from './purchaseManager.js';
import { FirestoreManager } from './firestore.js';

/**
 * Jeton yönetim sistemi
 * Kullanıcıların jeton kullanımını, satın alımını ve takibini yönetir
 */
class TokenManager {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        this.userData = null;
    }

    /**
     * TokenManager'ı başlatır
     * @param {string} userId - Kullanıcı ID'si
     * @param {object} userData - Kullanıcı verisi
     */
    async initialize(userId, userData) {
        if (!userId || !userData) {
            console.error('TokenManager: Kullanıcı verisi eksik');
            return false;
        }

        this.currentUser = userId;
        this.userData = userData;
        this.isInitialized = true;

        console.log('✅ TokenManager başlatıldı');
        return true;
    }

    /**
     * Kullanıcının mevcut jeton durumunu getirir
     * @returns {object} Jeton durumu
     */
    getTokenStatus() {
        if (!this.isInitialized) {
            return { error: 'TokenManager başlatılmadı' };
        }

        const subscription = this.userData.subscription || { tier: 'free' };
        const plan = getSubscriptionPlan(subscription.tier);
        const monthlyQueryCount = this.userData.monthlyQueryCount || 0;
        const tokenQueries = this.userData.tokenQueries || 0;

        return {
            plan: plan.name,
            tier: subscription.tier,
            monthlyTokens: plan.monthlyTokens,
            monthlyUsed: monthlyQueryCount,
            monthlyRemaining: Math.max(0, plan.monthlyTokens - monthlyQueryCount),
            tokenQueries: tokenQueries,
            totalRemaining: Math.max(0, plan.monthlyTokens - monthlyQueryCount) + tokenQueries,
            canUseService: (plan.monthlyTokens - monthlyQueryCount) > 0 || tokenQueries > 0
        };
    }

    /**
     * Jeton kullanımını kontrol eder ve gerekirse jeton düşer
     * @param {boolean} useToken - Jeton kullanılsın mı?
     * @returns {object} Kullanım sonucu
     */
    async checkAndUseToken(useToken = false) {
        if (!this.isInitialized) {
            return { error: 'TokenManager başlatılmadı' };
        }

        const status = this.getTokenStatus();
        
        // Önce aylık hakkı kontrol et
        if (status.monthlyRemaining > 0) {
            // Aylık hakkı kullan
            await this.useMonthlyToken();
            return {
                success: true,
                type: 'monthly',
                remaining: status.monthlyRemaining - 1,
                message: 'Aylık hakkınız kullanıldı'
            };
        }
        
        // Aylık hak yoksa ve jeton kullanımı isteniyorsa
        if (useToken && status.tokenQueries > 0) {
            // Jeton kullan
            await this.useToken();
            return {
                success: true,
                type: 'token',
                remaining: status.tokenQueries - 1,
                message: 'Jeton kullanıldı'
            };
        }
        
        // Hiç hak yok
        return {
            success: false,
            error: 'Sorgu hakkınız kalmadı',
            message: 'Premium plana geçin veya jeton satın alın'
        };
    }

    /**
     * Aylık jeton hakkını kullanır
     */
    async useMonthlyToken() {
        try {
            const newCount = (this.userData.monthlyQueryCount || 0) + 1;
            await FirestoreManager.updateUserField(this.currentUser, 'monthlyQueryCount', newCount);
            this.userData.monthlyQueryCount = newCount;
            console.log('✅ Aylık jeton kullanıldı');
        } catch (error) {
            console.error('❌ Aylık jeton kullanım hatası:', error);
        }
    }

    /**
     * Jeton paketini kullanır
     */
    async useToken() {
        try {
            const newCount = (this.userData.tokenQueries || 0) - 1;
            await FirestoreManager.updateUserField(this.currentUser, 'tokenQueries', newCount);
            this.userData.tokenQueries = newCount;
            console.log('✅ Jeton kullanıldı');
        } catch (error) {
            console.error('❌ Jeton kullanım hatası:', error);
        }
    }

    /**
     * Jeton paketi satın alır
     * @param {string} packageId - Paket ID'si
     * @returns {object} Satın alma sonucu
     */
    async purchaseTokenPackage(packageId) {
        if (!this.isInitialized) {
            return { error: 'TokenManager başlatılmadı' };
        }

        try {
            const result = await purchaseManager.purchasePackage({ identifier: packageId });
            
            if (result.success && result.type === 'token') {
                // Jetonları hesaba ekle
                await FirestoreManager.addTokenQueries(result.tokens);
                this.userData.tokenQueries = (this.userData.tokenQueries || 0) + result.tokens;
                
                return {
                    success: true,
                    tokens: result.tokens,
                    totalTokens: this.userData.tokenQueries,
                    message: `${result.tokens} jeton başarıyla eklendi!`
                };
            } else {
                return {
                    success: false,
                    error: result.message || 'Jeton paketi satın alınamadı'
                };
            }
        } catch (error) {
            console.error('❌ Jeton paketi satın alma hatası:', error);
            return {
                success: false,
                error: 'Satın alma sırasında bir hata oluştu'
            };
        }
    }

    /**
     * Premium plana geçiş yapar
     * @param {string} planId - Plan ID'si (pro, master)
     * @returns {object} Geçiş sonucu
     */
    async upgradeToPremium(planId) {
        if (!this.isInitialized) {
            return { error: 'TokenManager başlatılmadı' };
        }

        try {
            const packageId = `${planId}_monthly`; // Şimdilik aylık plan
            const result = await purchaseManager.purchasePackage({ identifier: packageId });
            
            if (result.success && result.type === 'subscription') {
                // Aboneliği güncelle
                await FirestoreManager.updateUserSubscription(result.tier, result.expiresDate);
                this.userData.subscription = {
                    tier: result.tier,
                    expiresDate: result.expiresDate
                };
                
                return {
                    success: true,
                    tier: result.tier,
                    message: `${getSubscriptionPlan(result.tier).name} planına başarıyla geçiş yapıldı!`
                };
            } else {
                return {
                    success: false,
                    error: result.message || 'Premium plana geçiş başarısız'
                };
            }
        } catch (error) {
            console.error('❌ Premium plana geçiş hatası:', error);
            return {
                success: false,
                error: 'Plan değişikliği sırasında bir hata oluştu'
            };
        }
    }

    /**
     * Kullanıcı verisini günceller
     * @param {object} newUserData - Yeni kullanıcı verisi
     */
    updateUserData(newUserData) {
        this.userData = newUserData;
    }

    /**
     * Jeton kullanım geçmişini getirir
     * @returns {object} Kullanım geçmişi
     */
    getUsageHistory() {
        if (!this.isInitialized) {
            return { error: 'TokenManager başlatılmadı' };
        }

        const status = this.getTokenStatus();
        const currentDate = new Date();
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        return {
            currentMonth: {
                start: monthStart,
                used: status.monthlyUsed,
                limit: status.monthlyTokens,
                remaining: status.monthlyRemaining
            },
            tokens: {
                available: status.tokenQueries,
                totalUsed: (this.userData.totalTokenQueriesUsed || 0)
            },
            plan: {
                name: status.plan,
                tier: status.tier,
                monthlyTokens: status.monthlyTokens
            }
        };
    }

    /**
     * Jeton kullanım önerilerini getirir
     * @returns {object} Öneriler
     */
    getRecommendations() {
        if (!this.isInitialized) {
            return { error: 'TokenManager başlatılmadı' };
        }

        const status = this.getTokenStatus();
        const recommendations = [];

        // Aylık hak az kaldıysa uyarı
        if (status.monthlyRemaining <= 3) {
            recommendations.push({
                type: 'warning',
                message: 'Aylık hakkınız az kaldı!',
                action: 'Premium plana geçin veya jeton satın alın',
                priority: 'high'
            });
        }

        // Jeton yoksa öneri
        if (status.tokenQueries === 0) {
            recommendations.push({
                type: 'info',
                message: 'Jeton paketi satın alarak sınırsız kullanım',
                action: 'Jeton paketlerini inceleyin',
                priority: 'medium'
            });
        }

        // Ücretsiz plandaysa premium önerisi
        if (status.tier === 'free') {
            recommendations.push({
                type: 'suggestion',
                message: 'Premium plana geçerek daha fazla özellik',
                action: 'Premium planları inceleyin',
                priority: 'low'
            });
        }

        return recommendations;
    }
}

// Singleton instance
export const tokenManager = new TokenManager();
