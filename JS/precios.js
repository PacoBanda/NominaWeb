// JS/precios-conceptos.js
import { db, USUARIO_ID } from "./firebase-init.js";
import {
  collection,
  onSnapshot,
  setDoc,
  updateDoc, // Añadido para actualizaciones atómicas seguras
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const usuarioId = USUARIO_ID; 
const ANIO_ACTUAL = "2026"; 

// Almacenes de estado globales para evitar llamadas redundantes a la red
let listaConceptos = [];
let snapPreciosFijos = null;
let snapPreciosVariables = null;

document.addEventListener("DOMContentLoaded", () => {
  // Toggle visibilidad fijos
  document.getElementById("btn-toggle-fijo")?.addEventListener("click", () => {
    document.getElementById("bloque-fijo").classList.toggle("hidden");
  });

  // --- 1. ESCUCHADOR CENTRAL DE CONCEPTOS ---
  onSnapshot(collection(db, "usuarios", usuarioId, "ConceptosNomina"), (snap) => {
    listaConceptos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (snapPreciosFijos) renderPreciosFijos();
    if (snapPreciosVariables) renderPreciosVariables();
  });

  // --- 2. LISTENER PRECIOS FIJOS ---
  onSnapshot(collection(db, "usuarios", usuarioId, "PreciosFijos"), (snapshot) => {
    snapPreciosFijos = snapshot;
    if (listaConceptos.length > 0) renderPreciosFijos();
  });

  // --- 3. LISTENER PRECIOS VARIABLES ---
  onSnapshot(collection(db, "usuarios", usuarioId, "PreciosVariables"), (snapshot) => {
    snapPreciosVariables = snapshot;
    if (listaConceptos.length > 0) renderPreciosVariables();
  });

  // --- FUNCIONES DE RENDERIZADO CONTROLADO ---
  function renderPreciosFijos() {
    const conceptosFijos = listaConceptos.filter((c) => c.tipo_precio === "Fijo");
    const tbody = document.getElementById("tbodyPrecioFijo");
    const thead = document.querySelector("#Tabla_PrecioFijo thead tr");
    if (!tbody || !thead) return;

    let headHTML = "<th>Concepto</th>";
    snapPreciosFijos.forEach((docSnap) => {
      headHTML += `<th>
                <input type="date" class="input-fecha-columna" data-old-id="${docSnap.id}" value="${docSnap.id}">
                <button class="btn-eliminar-columna" data-fecha="${docSnap.id}">❌</button>
            </th>`;
    });
    thead.innerHTML = headHTML;

    tbody.innerHTML = "";
    conceptosFijos.forEach((c) => {
      let row = `<tr><td>${c.concepto}</td>`;
      snapPreciosFijos.forEach((docSnap) => {
        const valor = docSnap.data().valores?.[c.id] || 0;
        row += `<td><input type="number" step="any" class="input-valor-fijo" data-id="${docSnap.id}" data-concepto="${c.id}" value="${valor}"></td>`;
      });
      row += `</tr>`;
      tbody.innerHTML += row;
    });
  }

  function renderPreciosVariables() {
    const conceptosVars = listaConceptos.filter((c) => c.tipo_precio === "Variable");
    const tbody = document.getElementById("tbodyPrecioVariable");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    const dataMatriz = {};
    snapPreciosVariables.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.idConcepto) {
          dataMatriz[data.idConcepto] = data.meses || {};
      }
    });

    conceptosVars.forEach((c) => {
      const meses = dataMatriz[c.id] || {};
      let row = `<tr><td>${c.concepto}</td>`;
      for (let i = 1; i <= 12; i++) {
        row += `<td><input type="number" step="any" class="input-matriz-var" 
                       data-id-concepto="${c.id}" 
                       data-mes="m${i}" 
                       value="${meses["m" + i] || 0}"></td>`;
      }
      row += `</tr>`;
      tbody.innerHTML += row;
    });
  }

  // --- 4. GESTIÓN DE EVENTOS AUTO-GUARDADO (CHANGE) ---
  document.addEventListener("change", async (e) => {
    const target = e.target;
    const valorNumerico = parseFloat(target.value) || 0;

    // Cambiar fecha de la columna
    if (target.classList.contains("input-fecha-columna")) {
      const oldId = target.dataset.oldId;
      const newId = target.value;
      if (oldId === newId || !newId) return;
      
      const docOld = snapPreciosFijos.docs.find((d) => d.id === oldId);
      if (docOld) {
        await setDoc(doc(db, "usuarios", usuarioId, "PreciosFijos", newId), { ...docOld.data(), fechaVigor: newId });
        await deleteDoc(doc(db, "usuarios", usuarioId, "PreciosFijos", oldId));
      }
    }
    
    // Guardar precio fijo
    if (target.classList.contains("input-valor-fijo")) {
      const docRef = doc(db, "usuarios", usuarioId, "PreciosFijos", target.dataset.id);
      const campoValores = `valores.${target.dataset.concepto}`;
      
      // updateDoc interpreta correctamente la notación por puntos sin borrar el resto del mapa
      await updateDoc(docRef, {
        [campoValores]: valorNumerico
      });
    }
    
    // Guardar precio variable
    if (target.classList.contains("input-matriz-var")) {
      const idConcepto = target.dataset.idConcepto;
      const docId = `${idConcepto}_${ANIO_ACTUAL}`;
      const docRef = doc(db, "usuarios", usuarioId, "PreciosVariables", docId);
      const campoMes = `meses.${target.dataset.mes}`;
      
      try {
        // Intentamos actualizar de forma atómica el mes exacto
        await updateDoc(docRef, {
          [campoMes]: valorNumerico
        });
      } catch (error) {
        // Si el documento anual del concepto no existe aún (error 5), lo creamos desde cero de forma segura
        if (error.code === 'not-found' || error.message.includes('No document to update')) {
          await setDoc(docRef, {
            idConcepto: idConcepto,
            meses: { [target.dataset.mes]: valorNumerico }
          });
        } else {
          console.error("Error guardando precio variable: ", error);
        }
      }
    }
  });

  // --- 5. INTERACCIONES CON BOTONES ---
  document.getElementById("btnAñadirFijo")?.addEventListener("click", () => {
    const fechaDefault = new Date().toISOString().split("T")[0];
    setDoc(doc(db, "usuarios", usuarioId, "PreciosFijos", fechaDefault), { fechaVigor: fechaDefault, valores: {} });
  });

  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-eliminar-columna")) {
      if (confirm("¿Eliminar esta columna de precios fijos?")) {
        await deleteDoc(doc(db, "usuarios", usuarioId, "PreciosFijos", e.target.dataset.fecha));
      }
    }
  });
});