// www/js/pages/login.js

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, AuthManager } from '../modules/auth.js';

AuthManager.initPublicPage();

const form = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginButton = form.querySelector('button[type="submit"]');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMessage.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Giriş Yapılıyor...';

    const email = form.email.value;
    const password = form.password.value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            window.location.href = 'index.html';
        })
        .catch((error) => {
            errorMessage.textContent = "E-posta veya şifre hatalı.";
            loginButton.disabled = false;
            loginButton.textContent = 'Giriş Yap';
        });
});

const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        AuthManager.signInWithGoogle();
    });
}