// JS/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
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
export const auth = getAuth(app);
export const db = getFirestore(app);

// Función para obtener dinámicamente el UID del usuario que ha iniciado sesión
export function obtenerUsuarioActual() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(user.uid);
            } else {
                // Si no hay sesión iniciada, redirigir al login
                window.location.href = "index.html";
                resolve(null);
            }
        });
    });
}