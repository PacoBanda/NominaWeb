// JS/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMW1GAJtKzWWHz9y6SLfXAZDfIYZcAV-g",
    authDomain: "appprueba-347a3.firebaseapp.com",
    projectId: "appprueba-347a3",
    storageBucket: "appprueba-347a3.firebasestorage.app",
    messagingSenderId: "282178230649",
    appId: "1:282178230649:web:58779aab9bb32be355f7a8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const USUARIO_ID = "test_user_local_1";