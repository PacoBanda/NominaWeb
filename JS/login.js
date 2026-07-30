import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMW1GAJtKzWWHz9y6SLfXAZDfIYZcAV-g",
    authDomain: "appprueba-347a3.firebaseapp.com",
    projectId: "appprueba-347a3",
    storageBucket: "appprueba-347a3.firebasestorage.app",
    messagingSenderId: "282178230649",
    appId: "1:282178230649:web:58779aab9bb32be355f7a8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado para saber si estamos registrando o procesando
let isRegistering = false;
let isProcessingSubmit = false; // Flag para evitar que el listener interfiera

// --- CONTROL DE RUTAS SEGURO ---
onAuthStateChanged(auth, (user) => {
    // Si estamos guardando los datos en el submit, no redirigir automáticamente aún
    if (isProcessingSubmit) return;

    const isIndex = window.location.pathname.endsWith('index.html') || 
                    window.location.pathname === '/' || 
                    window.location.pathname.endsWith('.html') === false;

    if (user) {
        if (isIndex) {
            window.location.href = 'navegacion.html';
        }
    } else {
        if (!isIndex) {
            window.location.href = 'index.html';
        }
    }
});

// --- LÓGICA DE INTERFAZ: ALTERNAR MODO ---
const toggleBtn = document.getElementById('toggle-auth-btn');
const authTitle = document.getElementById('auth-title');
const mainBtn = document.getElementById('main-btn');
const nombreInput = document.getElementById('nombre');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        isRegistering = !isRegistering;
        if (isRegistering) {
            authTitle.textContent = "Crear Cuenta";
            mainBtn.textContent = "Registrarse";
            toggleBtn.textContent = "¿Ya tienes cuenta? Inicia sesión";
            
            if (nombreInput) {
                nombreInput.classList.remove('hidden');
                nombreInput.required = true;
            }
        } else {
            authTitle.textContent = "Bienvenido";
            mainBtn.textContent = "Entrar";
            toggleBtn.textContent = "¿No tienes cuenta? Regístrate aquí";
            
            if (nombreInput) {
                nombreInput.classList.add('hidden');
                nombreInput.required = false;
                nombreInput.value = '';
            }
        }
    });
}

// --- LÓGICA DE ENVÍO DE FORMULARIO ---
const loginForm = document.getElementById('auth-form');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        isProcessingSubmit = true; // Bloqueamos temporalmente la redirección de onAuthStateChanged

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const nombre = nombreInput ? nombreInput.value.trim() : '';
        
        try {
            if (isRegistering) {
                // 1. Crear la cuenta en Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Guardar OBLIGATORIAMENTE el documento base del usuario en Firestore
                await setDoc(doc(db, "usuarios", user.uid), {
                    nombre: nombre || "Usuario sin nombre",
                    email: user.email,
                    creadoEn: new Date()
                });

                alert("¡Usuario registrado exitosamente!");
            } else {
                // Iniciar sesión
                await signInWithEmailAndPassword(auth, email, password);
            }
            
            // 3. Redirigir manualmente una vez que Firestore HAYA TERMINADO
            window.location.href = 'navegacion.html';
        } catch (err) { 
            isProcessingSubmit = false; // Si hay error, permitimos que el estado vuelva a la normalidad
            alert("Error: " + err.message); 
        }
    };
}

// --- LÓGICA DE CIERRE DE SESIÓN ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (err) {
            alert("Error al cerrar sesión: " + err.message);
        }
    };
}