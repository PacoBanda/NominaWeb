import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

import { mostrarAlertaCustom } from "./modal.js";

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

let isRegistering = false;
let isProcessingSubmit = false;

// --- CONTROL DE RUTAS SEGURO Y VERIFICACIÓN DE EMAIL ---
onAuthStateChanged(auth, async (user) => {
    if (isProcessingSubmit) return;

    const isIndex = window.location.pathname.endsWith('index.html') || 
                    window.location.pathname === '/' || 
                    window.location.pathname.endsWith('.html') === false;

    if (user) {
        await user.reload();

        if (!user.emailVerified) {
            await signOut(auth);
            if (!isIndex) {
                window.location.href = 'index.html';
            }
            return;
        }

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
        isProcessingSubmit = true;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const nombre = nombreInput ? nombreInput.value.trim() : '';
        
        try {
            if (isRegistering) {
                // 1. Crear la cuenta en Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Guardar el documento del usuario en Firestore
                await setDoc(doc(db, "usuarios", user.uid), {
                    nombre: nombre || "Usuario sin nombre",
                    email: user.email,
                    creadoEn: new Date()
                });

                // 3. Enviar correo de verificación antes de cerrar sesión
                await sendEmailVerification(user);

                // 4. Cerrar sesión
                await signOut(auth);

                await mostrarAlertaCustom(
                    "¡Cuenta registrada! Se ha enviado un correo de verificación a tu email. Confírmalo para poder acceder.",
                    "✉️ VERIFICA TU CORREO"
                );

                if (toggleBtn) toggleBtn.click();

            } else {
                // Iniciar sesión
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await user.reload();

                if (!user.emailVerified) {
                    const btnReenviar = document.getElementById('resend-email-btn');
                    if (btnReenviar) btnReenviar.classList.remove('hidden');

                    await mostrarAlertaCustom(
                        "Tu correo electrónico aún no ha sido verificado. Por favor, revisa tu bandeja de entrada o spam.",
                        "🚫 ACCESO DENEGADO"
                    );

                    await signOut(auth);
                    isProcessingSubmit = false;
                    return;
                }

                window.location.href = 'navegacion.html';
            }
        } catch (err) { 
            await mostrarAlertaCustom(err.message, "❌ ERROR DE ACCESO");
        } finally {
            isProcessingSubmit = false;
        }
    };
}

// --- REENVIAR EMAIL DE VERIFICACIÓN ---
const resendBtn = document.getElementById('resend-email-btn');
if (resendBtn) {
    resendBtn.onclick = async () => {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            await mostrarAlertaCustom(
                "Introduce tu correo y contraseña en el formulario para reenviar el enlace de verificación.",
                "⚠️ DATOS INCOMPLETOS"
            );
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (user.emailVerified) {
                await mostrarAlertaCustom(
                    "Tu correo ya está verificado. Puedes iniciar sesión normalmente.",
                    "✅ CORREO VERIFICADO"
                );
            } else {
                await sendEmailVerification(user);
                await mostrarAlertaCustom(
                    "Se ha reenviado el enlace de verificación a tu correo.",
                    "✉️ CORREO REENVIADO"
                );
            }
            await signOut(auth);
        } catch (err) {
            await mostrarAlertaCustom(err.message, "❌ ERROR AL REENVIAR");
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
            await mostrarAlertaCustom(err.message, "❌ ERROR");
        }
    };
}