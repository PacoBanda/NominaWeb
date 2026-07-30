import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";

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

// --- CONTROL DE RUTAS SEGURO ---
onAuthStateChanged(auth, (user) => {
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('.html') === false;

    if (user) {
        // Si el usuario está autenticado y está en el login, saltar al menú
        if (isIndex) {
            window.location.href = 'navegacion.html';
        }
    } else {
        // Si NO está autenticado y está intentando ver otra página, patitas a la calle
        if (!isIndex) {
            window.location.href = 'index.html';
        }
    }
});

// --- LÓGICA DE LA PÁGINA: LOGIN (index.html) ---
const loginForm = document.getElementById('auth-form');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = 'navegacion.html';
        } catch (err) { 
            alert("Error al iniciar sesión: " + err.message); 
        }
    };
}

// --- LÓGICA DE LA PÁGINA: MENÚ (navegacion.html) ---
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