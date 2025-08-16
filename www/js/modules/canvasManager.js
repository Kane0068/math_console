// Dosya Adı: www/js/modules/canvasManager.js

/**
 * Gelişmiş, performansa yönelik ve hatalara karşı dayanıklı canvas yöneticisi.
 * requestAnimationFrame, ResizeObserver ve boyut kontrolleri ile kararlı çalışır.
 */
export class OptimizedCanvasManager {
    constructor() {
        this.canvasPool = new Map();
        this.observers = new Map();
        this.animationFrameId = null;
        this.pendingUpdates = new Set();
    }

    /**
     * Belirtilen ID'ye sahip bir canvas'ı başlatır ve yönetime ekler.
     * @param {string} canvasId - Yönetilecek canvas elementinin ID'si.
     * @param {object} options - Ek yapılandırma seçenekleri.
     * @returns {object|null} - Başlatılan canvas verisi veya bulunamazsa null.
     */
    initCanvas(canvasId, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`initCanvas: '${canvasId}' ID'li canvas elementi bulunamadı.`);
            return null;
        }

        const ctx = canvas.getContext('2d', {
            alpha: true,
            desynchronized: false,
            willReadFrequently: false,
        });

        const canvasData = {
            canvas, ctx,
            history: [],
            currentPath: [],
            isDrawing: false,
            isLocked: false,
            tool: 'pen',
            dpr: window.devicePixelRatio || 1,
            lastX: 0,
            lastY: 0,
            ...options
        };

        this.canvasPool.set(canvasId, canvasData);
        this.setupOptimizedEvents(canvasId);
        this.setupResizeObserver(canvasId);

        // Canvas görünür olduğunda ilk boyutlandırmayı güvenli bir şekilde yap.
        requestAnimationFrame(() => {
            if (canvas.offsetParent !== null) {
                this.resizeCanvas(canvasId);
            }
        });

        return canvasData;
    }

    /**
     * Çizim için optimize edilmiş olay dinleyicilerini (event listeners) kurar.
     * @param {string} canvasId - Olayların kurulacağı canvas'ın ID'si.
     */
    setupOptimizedEvents(canvasId) {
        const canvasData = this.canvasPool.get(canvasId);
        if (!canvasData) return;
        const { canvas } = canvasData;

        canvas.style.touchAction = 'none'; // Dokunmatik cihazlarda sayfa kaydırmasını engeller.

        const getEventPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
            
            // DPR'yi hesaba katarak doğru koordinatları hesapla
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            return { 
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        };

        const startDrawing = (e) => {
            if (canvasData.isLocked) return;
            e.preventDefault();
            e.stopPropagation();
            
            canvasData.isDrawing = true;
            const pos = getEventPos(e);
            canvasData.currentPath = [pos];
            canvasData.lastX = pos.x;
            canvasData.lastY = pos.y;
            
            // Çizim ayarlarını hemen uygula
            this.applyDrawingSettings(canvasId);
            
            canvasData.ctx.beginPath();
            canvasData.ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {

            if (canvasData.isLocked || !canvasData.isDrawing) return;
            e.preventDefault();
            e.stopPropagation();
            
            const pos = getEventPos(e);
            
            // Hemen çiz
            canvasData.ctx.lineTo(pos.x, pos.y);
            canvasData.ctx.stroke();
            
            canvasData.lastX = pos.x;
            canvasData.lastY = pos.y;
        };

        const stopDrawing = (e) => {
            if (!canvasData.isDrawing) return;
            e.preventDefault();
            e.stopPropagation();
            
            canvasData.isDrawing = false;
            canvasData.ctx.closePath();
            this.saveCanvasState(canvasId);
            canvasData.currentPath = [];
        };

        // Event listener'ları ekle
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('touchend', stopDrawing, { passive: false });
        canvas.addEventListener('mouseleave', stopDrawing);
        
        // Context menu'yu engelle
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Belirtilen canvas'ta çizim yapmayı kilitler.
     * @param {string} canvasId Kilitlenecek canvas'ın ID'si.
     */
    lock(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (data) {
            data.isLocked = true;
        }
    }

    /**
     * Belirtilen canvas'ın çizim kilidini açar.
     * @param {string} canvasId Kilidi açılacak canvas'ın ID'si.
     */
    unlock(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (data) {
            data.isLocked = false;
        }
    }

    /**
     * Çizim ayarlarını uygula
     * @param {string} canvasId - Canvas ID'si
     */
    applyDrawingSettings(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (!data) return;
        
        const { ctx, tool, dpr } = data;
        
        if (tool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = 3 * dpr;
            ctx.strokeStyle = '#000000';
        } else if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 30 * dpr;
        }
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
    }

    /**
     * İki nokta arasında çizgi çiz
     * @param {string} canvasId - Canvas ID'si
     * @param {number} x1 - Başlangıç x koordinatı
     * @param {number} y1 - Başlangıç y koordinatı
     * @param {number} x2 - Bitiş x koordinatı
     * @param {number} y2 - Bitiş y koordinatı
     */
    drawLine(canvasId, x1, y1, x2, y2) {
        const data = this.canvasPool.get(canvasId);
        if (!data) return;
        
        const { ctx } = data;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    /**
     * Çizim işlemlerini requestAnimationFrame ile birleştirerek akıcılığı artırır.
     * NOT: Bu metod artık kullanılmıyor, doğrudan çizim yapılıyor
     */
    requestDraw() {
        if (this.animationFrameId) return;
        this.animationFrameId = requestAnimationFrame(() => {
            this.processPendingUpdates();
            this.animationFrameId = null;
        });
    }

    processPendingUpdates() {
        this.pendingUpdates.forEach(canvasId => {
            const data = this.canvasPool.get(canvasId);
            if (!data || !data.isDrawing || data.currentPath.length < 2) return;

            const { ctx, currentPath, tool } = data;
            
            this.applyDrawingSettings(canvasId);

            // Son iki noktayı çiz
            if (currentPath.length >= 2) {
                const lastPoint = currentPath[currentPath.length - 1];
                const prevPoint = currentPath[currentPath.length - 2];
                
                ctx.beginPath();
                ctx.moveTo(prevPoint.x, prevPoint.y);
                ctx.lineTo(lastPoint.x, lastPoint.y);
                ctx.stroke();
            }
        });
        
        this.pendingUpdates.clear();
    }

    /**
     * Canvas'ın mevcut durumunu geçmişe (history) kaydeder.
     * @param {string} canvasId - Durumu kaydedilecek canvas'ın ID'si.
     */
    saveCanvasState(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (!data) return;

        // HATA ÖNLEME: Canvas'ın boyutu 0 ise işlemi atla.
        if (data.canvas.width === 0 || data.canvas.height === 0) {
            return;
        }

        clearTimeout(data.saveTimeout);
        data.saveTimeout = setTimeout(() => {
            const { canvas, ctx, history } = data;
            try {
                history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                if (history.length > 20) history.shift();
            } catch (error) {
                console.warn('Canvas durumu kaydedilemedi:', error);
            }
        }, 100);
    }

    /**
     * Canvas'ı içeren parent elementin boyut değişikliklerini izlemek için ResizeObserver kurar.
     * @param {string} canvasId - İzlenecek canvas'ın ID'si.
     */
    setupResizeObserver(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (!data) return;

        const resizeObserver = new ResizeObserver(entries => {
            requestAnimationFrame(() => {
                for (const entry of entries) {
                    if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                        this.resizeCanvas(canvasId);
                    }
                }
            });
        });
        
        resizeObserver.observe(data.canvas.parentElement);
        this.observers.set(canvasId, resizeObserver);
    }

    /**
     * Canvas'ı parent elementinin boyutlarına göre yeniden boyutlandırır ve içeriğini korur.
     * @param {string} canvasId - Yeniden boyutlandırılacak canvas'ın ID'si.
     */
    resizeCanvas(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (!data || !data.canvas.parentElement) return;

        const { canvas, ctx, history } = data;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        // Boyut değişikliği yoksa çık
        if (rect.width === 0 || canvas.width === rect.width * data.dpr) return;

        // Mevcut içeriği kaydet
        const lastImage = history.length > 0 ? history[history.length - 1] : null;
        const tempCanvas = document.createElement('canvas');
        if (lastImage) {
            tempCanvas.width = lastImage.width;
            tempCanvas.height = lastImage.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(lastImage, 0, 0);
        }

        // Yeni boyutları ayarla
        const dpr = window.devicePixelRatio || 1;
        data.dpr = dpr;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        
        // Canvas'ı temizle ve beyaz arka plan ekle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (lastImage) {
            ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
        }
        
        // Çizim ayarlarını yeniden uygula
        this.applyDrawingSettings(canvasId);
    }


    /**
     * Canvas'ı temizler ve geçmişini sıfırlar.
     * @param {string} canvasId - Temizlenecek canvas'ın ID'si.
     * @param {boolean} saveState - Temizleme sonrası boş durumu geçmişe kaydetmek için.
     */
    clear(canvasId, saveState = true) {
        const data = this.canvasPool.get(canvasId);
        if (!data || data.canvas.width === 0) return;

        const { canvas, ctx } = data;
        
        // 1. Canvas'ı tamamen temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. Beyaz arka plan ekle
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. Çizim ayarlarını yeniden uygula
        this.applyDrawingSettings(canvasId);

        // --- EN ÖNEMLİ DÜZELTME BURADA ---
        // 4. Tuvalin hafızasını (çizim geçmişini) de sıfırla.
        // Bu, yeniden boyutlandırmanın eski çizimi geri getirmesini engeller.
        data.history = [];
        console.log(`✅ Canvas history for '${canvasId}' has been cleared.`);
        // --- DÜZELTME SONU ---

        if (saveState) {
            // İsteğe bağlı olarak, bu temiz durumu yeni başlangıç olarak kaydet.
            this.saveCanvasState(canvasId);
        }
    }

    /**
     * Son yapılan çizim işlemini geri alır.
     * @param {string} canvasId - İşlemin geri alınacağı canvas'ın ID'si.
     */
    undo(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (!data || data.history.length < 2) return;
        
        data.history.pop();
        const lastState = data.history[data.history.length - 1];
        
        if (lastState) {
            const { ctx } = data;
            ctx.clearRect(0, 0, data.canvas.width, data.canvas.height);
            ctx.putImageData(lastState, 0, 0);
            
            // Çizim ayarlarını yeniden uygula
            this.applyDrawingSettings(canvasId);
        }
    }

    /**
     * Aktif çizim aracını (kalem/silgi) ayarlar.
     * @param {string} canvasId - Araç ayarlanacak canvas'ın ID'si.
     * @param {string} toolName - 'pen' veya 'eraser'.
     */
    setTool(canvasId, toolName) {
        const data = this.canvasPool.get(canvasId);
        if (data) {
            data.tool = toolName;
            this.applyDrawingSettings(canvasId);
        }
    }

    /**
     * Canvas'ın içeriğini base64 formatında bir resim olarak döndürür.
     * @param {string} canvasId - Verisi alınacak canvas'ın ID'si.
     * @returns {string|null} - Base64 data URL'i veya canvas hazır değilse null.
     */
    toDataURL(canvasId, format = 'image/png') {
        const data = this.canvasPool.get(canvasId);
        if (!data || data.canvas.width === 0 || data.canvas.height === 0) {
            return null;
        }
        
        try {
            return data.canvas.toDataURL(format);
        } catch (error) {
            console.warn('Canvas toDataURL hatası:', error);
            return null;
        }
    }

    // www/js/modules/canvasManager.js içine, toDataURL fonksiyonunun altına ekleyin

    /**
     * Belirtilen canvas'a ait tüm yöneticileri (observer vb.) temizler.
     * @param {string} canvasId - Temizlenecek canvas'ın ID'si.
     */
    cleanup(canvasId) {
        const observer = this.observers.get(canvasId);
        if (observer) {
            // Gözlemciyi durdur ve haritadan sil.
            observer.disconnect();
            this.observers.delete(canvasId);
            console.log(`✅ ResizeObserver for '${canvasId}' disconnected.`);
        }
        
        const data = this.canvasPool.get(canvasId);
        if (data) {
            // Zamanlayıcıları temizle ve canvas'ı havuzdan kaldır.
            clearTimeout(data.saveTimeout);
            this.canvasPool.delete(canvasId);
            console.log(`✅ Canvas data for '${canvasId}' cleaned up.`);
        }
        
        this.pendingUpdates.delete(canvasId);
    }

    /**
     * Canvas'ın çizim durumunu kontrol et
     * @param {string} canvasId - Kontrol edilecek canvas'ın ID'si.
     * @returns {boolean} - Canvas çizim için hazır mı?
     */
    isCanvasReady(canvasId) {
        const data = this.canvasPool.get(canvasId);
        return data && data.canvas.width > 0 && data.canvas.height > 0;
    }

    /**
     * Debug bilgisi al
     * @param {string} canvasId - Debug bilgisi alınacak canvas'ın ID'si.
     */
    getDebugInfo(canvasId) {
        const data = this.canvasPool.get(canvasId);
        if (!data) return null;
        
        return {
            canvasId,
            dimensions: {
                width: data.canvas.width,
                height: data.canvas.height,
                styleWidth: data.canvas.style.width,
                styleHeight: data.canvas.style.height
            },
            dpr: data.dpr,
            tool: data.tool,
            isDrawing: data.isDrawing,
            historyLength: data.history.length
        };
    }
}

// export const canvasManager = new OptimizedCanvasManager();