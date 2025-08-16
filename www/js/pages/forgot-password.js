// www/js/pages/forgot-password.js

import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from '../modules/auth.js';

const form = document.getElementById('reset-form');
const messageEl = document.getElementById('message');
const buttonEl = document.getElementById('reset-button');
const emailInput = document.getElementById('email');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    
    buttonEl.disabled = true;
    buttonEl.textContent = 'Gönderiliyor...';
    messageEl.textContent = '';
    messageEl.classList.remove('text-green-600', 'text-red-500');

    sendPasswordResetEmail(auth, email)
        .then(() => {
            messageEl.textContent = 'Sıfırlama linki e-posta adresinize gönderildi!';
            messageEl.classList.add('text-green-600');
            buttonEl.textContent = 'Tekrar Gönder';
            buttonEl.disabled = false;
        })
        .catch((error) => {
            if (error.code === 'auth/user-not-found') {
                messageEl.textContent = 'Bu e-posta adresi ile kayıtlı bir kullanıcı bulunamadı.';
            } else {
                messageEl.textContent = 'Bir hata oluştu. Lütfen e-posta adresinizi kontrol edin.';
            }
            messageEl.classList.add('text-red-500');
            buttonEl.textContent = 'Sıfırlama Linki Gönder';
            buttonEl.disabled = false;
        });
});
