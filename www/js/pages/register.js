// www/js/pages/register.js

import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, AuthManager } from '../modules/auth.js';
import { FirestoreManager } from '../modules/firestore.js';

AuthManager.initPublicPage();

const form = document.getElementById('register-form');
const registerButton = document.getElementById('register-button');
const formError = document.getElementById('formError');

// ... (Geri kalan form doğrulama mantığı aynı kalabilir, 
// çünkü içinde hatalı import linki yoktu. Sadece bu dosyanın 
// en üstündeki import satırları kritikti.)

const fields = {
    displayName: { el: document.getElementById('displayName'), errorEl: document.getElementById('displayNameError'), regex: /^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]{3,}$/, error: 'En az 3 harf girmelisiniz.' },
    phoneNumber: { el: document.getElementById('phoneNumber'), errorEl: document.getElementById('phoneError'), regex: /^\d{10,15}$/, error: 'Geçerli bir telefon numarası girin.' },
    email: { el: document.getElementById('email'), errorEl: document.getElementById('emailError'), regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, error: 'Geçerli bir e-posta adresi girin.' },
    password: { el: document.getElementById('password'), errorEl: document.getElementById('passwordError'), minLength: 6, error: 'Şifre en az 6 karakter olmalıdır.' },
    confirmPassword: { el: document.getElementById('confirmPassword'), errorEl: document.getElementById('confirmPasswordError'), error: 'Şifreler eşleşmiyor.' }
};

// ... (Geri kalan tüm fonksiyonlar ve olay dinleyiciler aynı kalacak)
const validateField = (field) => {
    const { el, errorEl, regex, minLength, error } = field;
    let isValid = true;
    el.classList.remove('form-input-error', 'form-input-success');
    if (el.value.length === 0) {
        errorEl.textContent = '';
        return false;
    }
    if (el.id === 'confirmPassword') {
        isValid = el.value === fields.password.el.value;
    } else if (regex) {
        isValid = regex.test(el.value);
    } else if (minLength) {
        isValid = el.value.length >= minLength;
    }
    if (isValid) {
        errorEl.textContent = '';
        el.classList.add('form-input-success');
    } else {
        errorEl.textContent = error;
        el.classList.add('form-input-error');
    }
    return isValid;
};
Object.values(fields).forEach(field => {
    field.el.addEventListener('blur', () => validateField(field));
});
fields.displayName.el.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '');
    validateField(fields.displayName);
});
fields.phoneNumber.el.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '');
    validateField(fields.phoneNumber);
});
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isFormValid = true;
    Object.values(fields).forEach(field => {
        if (!validateField(field)) { isFormValid = false; }
    });
    if (!isFormValid) {
        formError.textContent = 'Lütfen tüm alanları doğru bir şekilde doldurun.';
        return;
    }
    formError.textContent = '';
    registerButton.disabled = true;
    registerButton.textContent = 'Kaydediliyor...';
    const additionalData = {
        displayName: fields.displayName.el.value,
        phoneNumber: fields.phoneNumber.el.value
    };
    const email = fields.email.el.value;
    const password = fields.password.el.value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await FirestoreManager.createUserData(userCredential.user, additionalData);
        window.location.href = 'index.html';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            formError.textContent = 'Bu e-posta adresi zaten kullanılıyor.';
            fields.email.el.classList.add('form-input-error');
        } else {
            formError.textContent = 'Bir hata oluştu. Lütfen tekrar deneyin.';
        }
        console.error("Kayıt hatası:", error);
        registerButton.disabled = false;
        registerButton.textContent = 'Hesap Oluştur';
    }
});
const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        AuthManager.signInWithGoogle();
    });
}