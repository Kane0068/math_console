// ===================================================================
// === KAMERA SAYFASI JAVASCRIPT KODU                              ===
// ===================================================================

class CameraManager {
    constructor() {
        this.video = null;
        this.stream = null;
        this.facingMode = 'environment'; // Arka kamera
        this.isInitialized = false;
        
        this.init();
    }
    
    async init() {
        try {
            this.video = document.getElementById('camera-preview');
            this.setupEventListeners();
            await this.startCamera();
        } catch (error) {
            console.error('Kamera başlatılamadı:', error);
            this.showError('Kamera başlatılamadı. Lütfen tekrar deneyin.');
        }
    }
    
    setupEventListeners() {
        // Geri butonu
        document.getElementById('backBtn').addEventListener('click', () => {
            this.goBack();
        });
        
        // Fotoğraf çek butonu
        document.getElementById('capture-btn').addEventListener('click', () => {
            this.capturePhoto();
        });
        
        // Kamera değiştir butonu
        document.getElementById('switch-camera-btn').addEventListener('click', () => {
            this.switchCamera();
        });
        
        // Sayfa kapanırken kamerayı durdur
        window.addEventListener('beforeunload', () => {
            this.stopCamera();
        });
        
        // Sayfa gizlenirken kamerayı durdur
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopCamera();
            } else {
                this.startCamera();
            }
        });
    }
    
    async startCamera() {
        try {
            if (this.stream) {
                this.stopCamera();
            }
            
            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            // Video yüklendiğinde
            this.video.onloadedmetadata = () => {
                this.video.play();
                this.isInitialized = true;
                console.log('Kamera başlatıldı');
            };
            
        } catch (error) {
            console.error('Kamera başlatma hatası:', error);
            this.showError('Kamera erişimi sağlanamadı. Lütfen kamera izinlerini kontrol edin.');
        }
    }
    
    async switchCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.startCamera();
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        this.isInitialized = false;
    }
    
    async capturePhoto() {
        if (!this.isInitialized) {
            this.showError('Kamera henüz hazır değil. Lütfen bekleyin.');
            return;
        }
        
        try {
            this.showLoading(true);
            
            // Canvas oluştur ve video'dan fotoğraf al
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Video boyutlarını al
            const videoWidth = this.video.videoWidth;
            const videoHeight = this.video.videoHeight;
            
            // Canvas boyutlarını ayarla
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            
            // Video'dan frame'i canvas'a çiz
            ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
            
            // Çerçeve koordinatlarını hesapla (CSS'teki yüzdelik değerler)
            const frameLeft = Math.round(videoWidth * 0.10); // 10%
            const frameTop = Math.round(videoHeight * 0.15); // 15%
            const frameWidth = Math.round(videoWidth * 0.80); // 80%
            const frameHeight = Math.round(videoHeight * 0.70); // 70%
            
            // Çerçeve içindeki alanı kırp
            const croppedCanvas = document.createElement('canvas');
            const croppedCtx = croppedCanvas.getContext('2d');
            
            croppedCanvas.width = frameWidth;
            croppedCanvas.height = frameHeight;
            
            // Sadece çerçeve içindeki alanı al
            croppedCtx.drawImage(
                canvas,
                frameLeft, frameTop, frameWidth, frameHeight, // Kaynak koordinatlar
                0, 0, frameWidth, frameHeight // Hedef koordinatlar
            );
            
            // Ana sayfaya dön ve fotoğrafı gönder
            this.sendPhotoToMainPage(croppedCanvas.toDataURL('image/jpeg', 0.9));
            
        } catch (error) {
            console.error('Fotoğraf çekme hatası:', error);
            this.showError('Fotoğraf çekilemedi. Lütfen tekrar deneyin.');
            this.showLoading(false);
        }
    }
    

    
    sendPhotoToMainPage(photoDataUrl) {
        try {
            // LocalStorage'a fotoğrafı kaydet
            localStorage.setItem('capturedPhoto', photoDataUrl);
            localStorage.setItem('photoTimestamp', Date.now().toString());
            
            // Ana sayfaya dön
            this.goBack();
            
        } catch (error) {
            console.error('Fotoğraf gönderme hatası:', error);
            this.showError('Fotoğraf kaydedilemedi. Lütfen tekrar deneyin.');
            this.showLoading(false);
        }
    }
    
    goBack() {
        // Ana sayfaya dön
        window.location.href = 'index.html';
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
    
    showError(message) {
        // Basit hata gösterimi
        alert(message);
    }
}

// Sayfa yüklendiğinde kamerayı başlat
document.addEventListener('DOMContentLoaded', () => {
    new CameraManager();
});

// Capacitor için gerekli
if (typeof Capacitor !== 'undefined') {
    // Capacitor plugin'leri burada kullanılabilir
    console.log('Capacitor ortamında çalışıyor');
}
