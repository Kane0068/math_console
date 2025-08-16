// www/js/modules/firebase.js - YENİ DOSYA

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// Bu değişkenin global `window.firebaseConfig` üzerinden geldiğini varsayıyoruz.
// Bir önceki adımda bu yapıyı kurmuştuk.
const app = initializeApp(firebaseConfig);

// Diğer modüllerin kullanması için temel Firebase servislerini export et.
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'europe-west1');