// JS/configuracion-visual.js
import { db, USUARIO_ID } from "./firebase-init.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

/**
 * Guarda la configuración de qué categoría se muestra en cada slot.
 * @param {Object} mapaSlots - Ejemplo: { s1: "id_cat_1", s2: "id_cat_2", ... }
 */
export async function guardarConfiguracionSlots(mapaSlots) {
    try {
        const docRef = doc(db, "usuarios", USUARIO_ID, "configuracion", "visual");
        await setDoc(docRef, mapaSlots, { merge: true });
        console.log("Configuración guardada correctamente");
    } catch (error) {
        console.error("Error al guardar la configuración:", error);
    }
}