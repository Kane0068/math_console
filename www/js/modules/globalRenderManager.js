// www/js/modules/globalRenderManager.js
// FINAL VERSION - Prompt-Optimized + SVG Fix + Full Integration

export class GlobalRenderManager {
    constructor() {
        this.renderQueue = new Map();
        this.pendingRenders = new Set();
        this.renderAttempts = new Map();
        this.maxRetries = 3;
        
        // YENİ: API Metadata Cache Sistemi
        this.solutionMetadata = null;
        this.fieldTypeCache = new Map();
        this.contentAnalysisCache = new Map();
        
        this.mathJaxStatus = {
            ready: false,
            initializing: false,
            error: null
        };
        
        // Geliştirilmiş istatistikler
        this.stats = {
            successful: 0,
            failed: 0,
            retried: 0,
            pending: 0,
            metadataHits: 0,
            metadataMisses: 0,
            avgRenderTime: 0,
            totalRenderTime: 0,
            svgErrors: 0
        };
    }

    // YENİ: API'den gelen çözüm metadata'sını kaydet ve optimize et
    setSolutionMetadata(solutionData) {
        this.solutionMetadata = solutionData?.renderMetadata || null;
        
        if (this.solutionMetadata) {
            console.log('🎯 API Render Metadata alındı:', {
                complexity: this.solutionMetadata.mathComplexity,
                priorityCount: this.solutionMetadata.priorityElements?.length || 0,
                hasOptimizations: !!this.solutionMetadata.renderHints
            });
            
            // Content type'ları field bazında cache'e kaydet
            const contentTypes = this.solutionMetadata.contentTypes || {};
            for (const [fieldName, types] of Object.entries(contentTypes)) {
                this.fieldTypeCache.set(fieldName, {
                    types: Array.isArray(types) ? types : [types],
                    complexity: this.solutionMetadata.mathComplexity,
                    hints: this.solutionMetadata.renderHints,
                    priority: this.solutionMetadata.priorityElements?.includes(fieldName) || false
                });
            }
            
            // Render sistemini optimize et
            this.optimizeRenderSettings();
            
        } else {
            console.warn('⚠️ API yanıtında renderMetadata bulunamadı, fallback sistem aktif');
        }
    }

    // YENİ: Metadata'ya göre render ayarlarını optimize et
    optimizeRenderSettings() {
        if (!this.solutionMetadata) return;

        const hints = this.solutionMetadata.renderHints;
        const complexity = this.solutionMetadata.mathComplexity;

        // Batch size'ı optimize et
        if (complexity === 'high' || hints?.estimatedRenderTime === 'slow') {
            this.batchSize = 2; // Küçük batch'ler
        } else if (complexity === 'medium' || hints?.estimatedRenderTime === 'medium') {
            this.batchSize = 4;
        } else {
            this.batchSize = 8; // Büyük batch'ler
        }

        // MathJax konfigürasyonunu optimize et
        if (hints?.hasFractions || hints?.hasMatrices) {
            this.enableAdvancedMath = true;
        }

        console.log(`⚡️ Render optimizasyonu: batch=${this.batchSize}, advanced=${this.enableAdvancedMath}`);
    }

    // YENİ: Element için render tipini akıllıca belirle
    determineRenderStrategy(element, content) {
        const startTime = performance.now();
        
        // 1. CSS class'tan direkt tip kontrolü
        if (element.classList.contains('latex-content')) {
            return {
                strategy: 'pure_latex',
                confidence: 1.0,
                source: 'css_class',
                displayMode: true
            };
        }

        // 2. Field name'i tespit et
        const fieldName = this.inferFieldName(element);
        
        // 3. API metadata'dan tip al
        if (fieldName && this.fieldTypeCache.has(fieldName)) {
            const metadata = this.fieldTypeCache.get(fieldName);
            this.stats.metadataHits++;
            
            const primaryType = metadata.types[0];
            return {
                strategy: primaryType,
                confidence: 1.0,
                source: 'api_metadata',
                displayMode: primaryType === 'pure_latex',
                complexity: metadata.complexity,
                priority: metadata.priority,
                hints: metadata.hints
            };
        }

        // 4. Cache'den kontrol et
        const contentHash = this.hashCode(content);
        if (this.contentAnalysisCache.has(contentHash)) {
            const cached = this.contentAnalysisCache.get(contentHash);
            return cached;
        }

        // 5. Fallback: İçerik analizi (eski sistem)
        this.stats.metadataMisses++;
        const strategy = this.analyzeContentFallback(content);
        
        // Analiz sonucunu cache'e kaydet
        this.contentAnalysisCache.set(contentHash, strategy);
        
        const analysisTime = performance.now() - startTime;
        if (analysisTime > 10) {
            console.warn(`🐌 Yavaş content analizi: ${analysisTime.toFixed(2)}ms`);
        }

        return strategy;
    }

    // YENİ: Element'in field name'ini akıllıca tespit et
    inferFieldName(element) {
        // 1. Data attribute'dan
        const dataField = element.getAttribute('data-field');
        if (dataField) return dataField;

        // 2. Element ID'sinden mapping
        const idMappings = {
            'interactive-step-desc': 'adimAciklamasi',
            'step-description': 'adimAciklamasi',
            'solution-latex': 'cozum_lateks',
            'latex-content': 'cozum_lateks',
            'hint-content': 'ipucu',
            'error-explanation': 'hataAciklamasi',
            'result-check': 'sonucKontrolu',
            'option-text': 'metin_lateks'
        };

        for (const [pattern, fieldName] of Object.entries(idMappings)) {
            if (element.id?.includes(pattern) || element.className?.includes(pattern)) {
                return fieldName;
            }
        }

        // 3. Parent container'dan çıkarım
        const parent = element.closest('.solution-step, .interactive-workspace, .option-label');
        if (parent) {
            if (element.classList.contains('step-description')) return 'adimAciklamasi';
            if (element.classList.contains('latex-content')) return 'cozum_lateks';
            if (element.classList.contains('smart-content')) {
                // Smart content'in context'ine göre karar ver
                if (parent.classList.contains('interactive-workspace')) return 'adimAciklamasi';
                if (parent.classList.contains('option-label')) return 'metin_lateks';
            }
        }

        return null;
    }

    // Fallback content analizi (eski sistem, optimize edildi)
    analyzeContentFallback(content) {
        const normalizedContent = this.normalizeContent(content);
        
        // Hızlı pre-check'ler
        if (!normalizedContent || normalizedContent.length < 2) {
            return { strategy: 'text', confidence: 1.0, source: 'empty_content' };
        }

        // Sadece sayılardan oluşuyor mu?
        if (/^[\d\s\+\-\=\(\)]+$/.test(normalizedContent)) {
            return { strategy: 'pure_latex', confidence: 0.9, source: 'numbers_only' };
        }

        // LaTeX delimiters var mı?
        const hasDelimiters = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/.test(normalizedContent);
        
        // LaTeX komutları var mı?
        const hasLatexCommands = /(\\[a-zA-Z]+|\^|_|\{|\})/.test(normalizedContent);
        
        // Text karakterleri var mı?
        const hasText = /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(normalizedContent);

        // Karar ağacı (optimize edilmiş)
        if (!hasDelimiters && !hasLatexCommands && hasText) {
            return { strategy: 'text', confidence: 0.95, source: 'text_only' };
        }
        
        if (hasLatexCommands && !hasText) {
            return { strategy: 'pure_latex', confidence: 0.9, source: 'latex_only' };
        }
        
        if (hasDelimiters && hasText) {
            return { strategy: 'inline_math', confidence: 0.85, source: 'mixed_content' };
        }
        
        if (hasLatexCommands && hasText) {
            return { strategy: 'mixed_content', confidence: 0.7, source: 'complex_mixed' };
        }

        // Default
        return { strategy: 'text', confidence: 0.5, source: 'fallback_default' };
    }

    // globalRenderManager.js -> Savunma Mekanizması Eklenmiş Yeni renderElement fonksiyonu

    async renderElement(element, content, options = {}) {
        if (!element) return false;

        const renderStartTime = performance.now();

        if (content === null || typeof content === 'undefined') {
            element.innerHTML = '';
            return true;
        }

        const normalizedContent = this.normalizeContent(String(content));
        if (!normalizedContent) {
            element.innerHTML = '';
            return true;
        }

        if (!this.mathJaxStatus.ready) {
            await this.initializeMathJax();
        }

        try {
            // 1. Render stratejisini normal şekilde belirle
            let renderInfo = this.determineRenderStrategy(element, normalizedContent);
            
            // 2. --- YENİ SAVUNMA MEKANİZMASI ---
            // Eğer strateji 'text' ise ama içerik bariz bir şekilde LaTeX komutları içeriyorsa, stratejiyi anında değiştir.
            if (renderInfo.strategy === 'text') {
                const hasLatexCommands = /(\\[a-zA-Z]+|\^|_|\{|\})/.test(normalizedContent);
                if (hasLatexCommands) {
                    console.warn(`⚠️ DEFENSIVE CATCH: 'text' stratejisi, LaTeX komutları tespit edildiği için 'mixed_content' olarak değiştirildi. İçerik: "${normalizedContent.substring(0, 50)}..."`);
                    renderInfo.strategy = 'mixed_content'; // Stratejiyi daha güvenli olanla değiştir.
                    renderInfo.source = 'defensive_override';
                }
            }
            // --- SAVUNMA MEKANİZMASI SONU ---

            console.log(`🎯 Render: ${renderInfo.strategy} (${renderInfo.source}, conf: ${renderInfo.confidence})`);

            let result = false;
            switch (renderInfo.strategy) {
                case 'text':
                    result = this.renderText(element, normalizedContent);
                    break;
                case 'pure_latex':
                    result = await this.renderPureLatex(element, normalizedContent, renderInfo.displayMode);
                    break;
                case 'inline_math':
                    result = await this.renderInlineMath(element, normalizedContent);
                    break;
                case 'mixed_content':
                    result = await this.renderMixedContent(element, normalizedContent, options);
                    break;
                default:
                    console.warn(`⚠️ Bilinmeyen render stratejisi: ${renderInfo.strategy}`);
                    result = await this.renderMixedContent(element, normalizedContent, options);
            }

            const renderTime = performance.now() - renderStartTime;
            this.updateRenderStats(renderTime, true);

            if (result) {
                this.stats.successful++;
                element.classList.add(`rendered-${renderInfo.strategy}`);
                if (renderInfo.priority) {
                    element.classList.add('priority-rendered');
                }
            }

            return result;

        } catch (error) {
            const renderTime = performance.now() - renderStartTime;
            this.updateRenderStats(renderTime, false);
            
            console.error('Render hatası:', error);
            this.renderFallback(element, normalizedContent, error);
            this.stats.failed++;
            return false;
        }
    }

    // YENİ: Text-only render (optimize edilmiş)
    renderText(element, content) {
        element.textContent = content;
        element.classList.add('text-rendered');
        return true;
    }

    // YENİ: Inline math render ($ işaretli matematik)
    async renderInlineMath(element, content) {
        try {
            // İçerikteki $ işaretli matematik parçalarını MathJax formatına çevir
            const processedContent = content.replace(/\$([^$]+)\$/g, '\\($1\\)');
            
            element.innerHTML = processedContent;
            await MathJax.typesetPromise([element]);
            
            element.classList.add('inline-math-rendered');
            return true;

        } catch (error) {
            console.error('Inline math render hatası:', error);
            element.textContent = content;
            element.classList.add('render-error');
            return false;
        }
    }

    // ✅ SVG FIX: Geliştirilmiş pure LaTeX render
    // www/js/modules/globalRenderManager.js -> Bu fonksiyonu mevcut olanla değiştirin.

    // ✅ SVG FIX: Geliştirilmiş pure LaTeX render
    async renderPureLatex(element, content, displayMode = false) {
        // Geçici render div'ini oluştur
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.top = '-9999px';
        tempDiv.style.left = '0px';
        tempDiv.style.width = '1000px'; 
        tempDiv.style.visibility = 'visible'; // Ölçüm için görünür olmalı
        tempDiv.style.zIndex = '-1000';
        tempDiv.style.pointerEvents = 'none';

        try {
            // Temizleme işlemleri
            let cleanContent = content.trim();
            if (cleanContent.startsWith('$') && cleanContent.endsWith('$')) {
                cleanContent = cleanContent.substring(1, cleanContent.length - 1).trim();
            }
            
            const mathContent = displayMode ? `\\[${cleanContent}\\]` : `\\(${cleanContent}\\)`;
            tempDiv.innerHTML = mathContent;
            
            // Render etmeden önce DOM'a ekle
            document.body.appendChild(tempDiv);
            
            // Render işlemini dene
            await MathJax.typesetPromise([tempDiv]);
            
            // SVG doğrulama kontrolü
            const svgElements = tempDiv.querySelectorAll('svg');
            let hasValidSVG = true;
            
            svgElements.forEach(svg => {
                const viewBox = svg.getAttribute('viewBox');
                if (viewBox && (viewBox.includes('NaN') || viewBox.includes('undefined'))) {
                    console.warn('⚠️ Invalid SVG viewBox detected:', viewBox, 'Content:', cleanContent);
                    hasValidSVG = false;
                    this.stats.svgErrors++;
                }
            });
            
            if (hasValidSVG && tempDiv.innerHTML.trim()) {
                element.innerHTML = tempDiv.innerHTML;
                element.classList.add('math-rendered', 'mathjax-rendered');
                
                if (displayMode) {
                    element.style.display = 'block';
                    element.style.textAlign = 'center';
                    element.style.margin = '1rem auto';
                }
                return true;
            } else {
                throw new Error('Invalid SVG generated by MathJax or empty render');
            }
            
        } catch (error) {
            console.error('Pure LaTeX render hatası:', error);
            element.textContent = content; // Fallback olarak ham metni göster
            element.classList.add('render-error');
            element.title = `Render hatası: ${error.message}`;
            return false;
        } finally {
            // GARANTİLİ TEMİZLİK: Başarılı da olsa, hata da olsa tempDiv'i DOM'dan kaldır.
            if (document.body.contains(tempDiv)) {
                document.body.removeChild(tempDiv);
            }
        }
    }

    async renderMixedContent(element, content, options) {
        try {
            const parts = this.splitMixedContent(content);
            
            // --- PARADOKS AVCISI MEKANİZMASI ---
            // Eğer splitMixedContent fonksiyonu içeriği bölemediyse (sadece tek bir metin parçası döndürdüyse)
            // ama bu metin parçası içinde LaTeX komutları varsa, o zaman tüm içeriği tek bir matematik ifadesi olarak render et.
            if (parts.length === 1 && parts[0].type === 'text') {
                const textPart = parts[0].content;

                // KONTROL GÜÇLENDİRİLDİ: Sadece '\' değil, '^', '_', '{', '}' gibi
                // tüm temel LaTeX komutlarını arayan daha kapsamlı bir regex kullanıyoruz.
                const hasLatexCommands = /(\\[a-zA-Z]+|\^|_|\{|\})/.test(textPart);

                if (hasLatexCommands) {
                    console.warn(`⚠️ MIXED CONTENT PARADOX DETECTED: Sınırlayıcı ($) yok ama LaTeX komutu var. İçerik 'pure_latex' olarak render edilecek. İçerik: "${textPart}"`);
                    // Bütün elementi, içeriği saf LaTeX olarak kabul ederek render et ve işlemi bitir.
                    return await this.renderPureLatex(element, textPart, false);
                }
            }
            // --- PARADOKS AVCISI SONU ---

            element.innerHTML = '';
            element.classList.add('mixed-content-container');
            
            for (const part of parts) {
                const span = document.createElement('span');
                
                if (part.type === 'latex') {
                    span.className = 'latex-part';
                    // Pure LaTeX render kullan
                    await this.renderPureLatex(span, part.content, false);
                } else {
                    span.className = 'text-part';
                    span.textContent = part.content;
                }
                
                element.appendChild(span);
            }
            
            element.classList.add('mixed-content-rendered');
            return true;
            
        } catch (error) {
            console.error('Mixed content render hatası:', error);
            element.textContent = content;
            element.classList.add('render-error');
            return false;
        }
    }

    // Optimize edilmiş mixed content splitter
    splitMixedContent(content) {
        const parts = [];
        const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
        
        let lastIndex = 0;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            // Önceki text parçası
            if (match.index > lastIndex) {
                const text = content.slice(lastIndex, match.index);
                if (text.trim()) {
                    parts.push({ type: 'text', content: text });
                }
            }
            
            // LaTeX parçası (sınırlayıcıları temizle)
            let latex = match[1];
            latex = latex
                .replace(/^\$\$|^\$|^\\\[|^\\\(/, '')
                .replace(/\$\$?$|\\\]$|\\\)$/, '')
                .trim();
            
            if (latex) {
                parts.push({ type: 'latex', content: latex });
            }
        
            lastIndex = match.index + match[0].length;
        }
        
        // Son text parçası
        if (lastIndex < content.length) {
            const remaining = content.slice(lastIndex);
            if (remaining.trim()) {
                parts.push({ type: 'text', content: remaining });
            }
        }
        
        return parts;
    }

    // ✅ CONTAINER VISIBİLİTY FIX: Geliştirilmiş container render
    async renderContainer(container, options = {}) {
        if (!container) return;
        
        await this.initializeMathJax();
        
        // ✅ Container visibility kontrolü
        const wasHidden = container.offsetParent === null;
        if (wasHidden) {
            console.warn('⚠️ Container gizli, render için geçici gösterilecek');
            // Geçici olarak görünür yap (off-screen)
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '0px';
            container.style.visibility = 'visible';
            container.style.display = 'block';
        }
        
        const elements = this.collectRenderableElements(container);
        console.log(`📊 ${elements.length} element render edilecek`);
        
        if (elements.length === 0) {
            if (wasHidden) {
                // Geri gizle
                container.style.position = '';
                container.style.top = '';
                container.style.left = '';
                container.style.visibility = '';
                container.style.display = '';
            }
            return;
        }

        // Priority elementleri ayır
        const { priorityElements, normalElements } = this.separateByPriority(elements);

        console.log(`⚡️ Priority: ${priorityElements.length}, Normal: ${normalElements.length}`);

        // Önce priority elementleri render et
        if (priorityElements.length > 0) {
            for (const item of priorityElements) {
                await this.renderElement(item.element, item.content, { displayMode: item.isDisplay });
                
                // Priority element'ler arası küçük bekleme
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Normal elementleri batch'ler halinde render et
        const batchSize = this.batchSize || 5;
        for (let i = 0; i < normalElements.length; i += batchSize) {
            const batch = normalElements.slice(i, i + batchSize);
            
            await Promise.all(batch.map(({ element, content, isDisplay }) =>
                this.renderElement(element, content, { displayMode: isDisplay })
            ));
            
            // Progress callback
            if (options.onProgress) {
                const totalCompleted = priorityElements.length + Math.min(i + batchSize, normalElements.length);
                options.onProgress(totalCompleted, elements.length);
            }
            
            // Batch'ler arası bekleme
            if (i + batchSize < normalElements.length) {
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }
        
        // ✅ Container'ı orijinal durumuna döndür
        if (wasHidden) {
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.visibility = '';
            container.style.display = '';
        }
        
        console.log('✅ Container render tamamlandı:', this.getStats());
    }

    // YENİ: Priority'ye göre elementleri ayır
    separateByPriority(elements) {
        const priorityElements = [];
        const normalElements = [];
        
        for (const item of elements) {
            const fieldName = this.inferFieldName(item.element);
            const isPriority = this.solutionMetadata?.priorityElements?.includes(fieldName) || false;
            
            if (isPriority) {
                priorityElements.push(item);
            } else {
                normalElements.push(item);
            }
        }
        
        return { priorityElements, normalElements };
    }

    // Geliştirilmiş element collection
    collectRenderableElements(container) {
        const elements = [];
        
        // Smart content elementleri
        container.querySelectorAll('.smart-content').forEach(el => {
            const content = el.getAttribute('data-content') || el.textContent;
            if (content && content.trim()) {
                elements.push({
                    element: el,
                    content: content,
                    isDisplay: false
                });
            }
        });
        
        // LaTeX content elementleri
        container.querySelectorAll('.latex-content').forEach(el => {
            const content = el.getAttribute('data-latex') || el.textContent;
            if (content && content.trim()) {
                elements.push({
                    element: el,
                    content: content,
                    isDisplay: true
                });
            }
        });
        
        return elements;
    }

    // YENİ: Render istatistiklerini güncelle
    updateRenderStats(renderTime, success) {
        this.stats.totalRenderTime += renderTime;
        this.stats.avgRenderTime = this.stats.totalRenderTime / (this.stats.successful + this.stats.failed + 1);
        
        if (renderTime > 100) {
            console.warn(`🐌 Yavaş render: ${renderTime.toFixed(2)}ms`);
        }
    }

    // Geliştirilmiş fallback
    renderFallback(element, content, error) {
        console.error("Render Fallback:", { content: content.substring(0, 50), error: error.message });
        element.textContent = content;
        element.classList.add('render-error');
        element.title = `Render hatası: ${error.message}`;
    }

    // MathJax initialization (SVG optimizasyonu ile)
    async initializeMathJax() {
        if (this.mathJaxStatus.ready) return true;
        if (this.mathJaxStatus.initializing) {
            return this.waitForMathJax();
        }
        
        this.mathJaxStatus.initializing = true;
        
        try {
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true,
                    processEnvironments: true,
                    packages: {'[+]': ['ams', 'newcommand', 'unicode']}
                },
                svg: {
                    fontCache: 'global',
                    displayAlign: 'center',
                    displayIndent: '0',
                    // ✅ SVG optimizasyonları
                    scale: 1,
                    minScale: 0.5,
                    mtextInheritFont: false,
                    merrorInheritFont: true,
                    mathmlSpacing: false,
                    skipAttributes: {},
                    exFactor: 0.5,
                    displayOverflow: 'linebreak',
                    linebreaks: { automatic: false }
                },
                startup: {
                    ready: () => {
                        console.log('✅ MathJax v3 başarıyla yüklendi');
                        this.mathJaxStatus.ready = true;
                        this.mathJaxStatus.initializing = false;
                        MathJax.startup.defaultReady();
                        this.processQueuedRenders();
                    }
                },
                options: {
                    enableMenu: false,
                    renderActions: {
                        addMenu: []
                    }
                }
            };
            
            if (!document.getElementById('mathjax-script')) {
                const script = document.createElement('script');
                script.id = 'mathjax-script';
                script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
                script.async = true;
                document.head.appendChild(script);
            }
            
            return this.waitForMathJax();
            
        } catch (error) {
            this.mathJaxStatus.error = error;
            this.mathJaxStatus.initializing = false;
            console.error('❌ MathJax başlatma hatası:', error);
            return false;
        }
    }

    async waitForMathJax(timeout = 10000) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.mathJaxStatus.ready) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    console.error('❌ MathJax yükleme zaman aşımı');
                    resolve(false);
                }
            }, 100);
        });
    }

    // Utility fonksiyonlar (optimize edildi)
    normalizeContent(content) {
        if (!content || typeof content !== 'string') return '';
        
        let normalized = content.trim();
        
        // Çift sınırlayıcıları temizle
        normalized = normalized
            .replace(/\$\$\$/g, '$$')
            .replace(/\$\s+\$/g, '$$')
            .replace(/\\\[\s*\\\[/g, '\\[')
            .replace(/\\\]\s*\\\]/g, '\\]');
        
        // Markdown formatını temizle
        normalized = normalized.replace(/\*\*(.*?)\*\*/g, '$1');
        
        // Boş sınırlayıcıları kaldır
        normalized = normalized.replace(/\$\s*\$/g, '');
        normalized = normalized.replace(/\$\$\s*\$\$/g, '');
        
        return normalized;
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    async processQueuedRenders() {
        if (this.renderQueue.size === 0) return;
        
        console.log(`📋 ${this.renderQueue.size} bekleyen render işleniyor`);
        
        for (const [id, task] of this.renderQueue) {
            await this.renderElement(task.element, task.content, task.options);
            this.renderQueue.delete(id);
        }
    }

    // Geliştirilmiş istatistikler
    getStats() {
        const totalRenders = this.stats.successful + this.stats.failed;
        const metadataEfficiency = totalRenders > 0 ? 
            (this.stats.metadataHits / (this.stats.metadataHits + this.stats.metadataMisses) * 100) : 0;

        return {
            ...this.stats,
            mathJaxReady: this.mathJaxStatus.ready,
            queueSize: this.renderQueue.size,
            pendingCount: this.pendingRenders.size,
            metadataEfficiency: metadataEfficiency.toFixed(1) + '%',
            avgRenderTimeMs: this.stats.avgRenderTime.toFixed(2),
            hasMetadata: !!this.solutionMetadata,
            cacheSize: this.contentAnalysisCache.size,
            svgErrorRate: totalRenders > 0 ? (this.stats.svgErrors / totalRenders * 100).toFixed(1) + '%' : '0%'
        };
    }

    

    // Cache temizleme
    reset() {
        this.renderQueue.clear();
        this.pendingRenders.clear();
        this.renderAttempts.clear();
        this.solutionMetadata = null;
        this.fieldTypeCache.clear();
        this.contentAnalysisCache.clear();
        
        this.stats = {
            successful: 0,
            failed: 0,
            retried: 0,
            pending: 0,
            metadataHits: 0,
            metadataMisses: 0,
            avgRenderTime: 0,
            totalRenderTime: 0
        };
    }

    // YENİ: Debug ve monitoring fonksiyonları
    logPerformanceReport() {
        const stats = this.getStats();
        console.group('📊 Render Performance Report');
        console.log('Toplam Başarılı:', stats.successful);
        console.log('Metadata Verimlilik:', stats.metadataEfficiency);
        console.log('Ortalama Render Süresi:', stats.avgRenderTimeMs + 'ms');
        console.log('Cache Boyutu:', stats.cacheSize);
        console.log('MathJax Durumu:', stats.mathJaxReady ? '✅ Hazır' : '❌ Hazır değil');
        console.groupEnd();
    }
}

// Singleton instance
export const globalRenderManager = new GlobalRenderManager();

// Global erişim için window objesine ekle
if (typeof window !== 'undefined') {
    window.globalRenderManager = globalRenderManager;
    console.log('✅ Prompt-Optimized globalRenderManager hazır');
}

// DEBUG: Development modunda performance monitoring
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    // Her 30 saniyede performance raporu
    setInterval(() => {
        globalRenderManager.logPerformanceReport();
    }, 30000);
}