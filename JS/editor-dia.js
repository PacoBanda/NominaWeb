// JS/editor-dia.js

import {
  doc,
  setDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { db, obtenerUsuarioActual } from "./firebase-init.js";
import { calcularTotales } from "./totales.js";

function isColorLight(colorHex) {
  if (!colorHex) return true;
  const hex = colorHex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 1000) / 1000 > 155;
}

// Modal de confirmación dinámico e infalible
function pedirConfirmacionDirecta(mensaje, titulo = "CONFIRMAR") {
  return new Promise((resolve) => {
    // Crear fondo oscuro
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999; backdrop-filter: blur(2px);
    `;

    // Crear caja del modal
    const box = document.createElement("div");
    box.style.cssText = `
      background: #ffffff;
      color: #000000;
      padding: 24px;
      border-radius: 12px;
      max-width: 360px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      font-family: sans-serif;
      border: 2px solid #333;
    `;

    box.innerHTML = `
      <h3 style="margin-top:0; font-size:1.2rem; color:#d32f2f;">${titulo}</h3>
      <p style="margin: 15px 0 20px; font-size:1rem; line-height:1.4;">${mensaje}</p>
      <div style="display:flex; gap:10px; justify-content:center;">
        <button id="btn-modal-cancel" style="padding:10px 18px; border-radius:6px; border:1px solid #ccc; background:#eee; cursor:pointer; font-weight:bold;">Cancelar</button>
        <button id="btn-modal-confirm" style="padding:10px 18px; border-radius:6px; border:none; background:#d32f2f; color:#fff; cursor:pointer; font-weight:bold;">Eliminar</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector("#btn-modal-cancel").onclick = () => {
      document.body.removeChild(overlay);
      resolve(false);
    };

    box.querySelector("#btn-modal-confirm").onclick = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };
  });
}

export function abrirEditorDia(
  numeroDia,
  fechaActual,
  datosMesActual, // Recibe todo el estado mensual para recalcular totales
  categoriesConfig,
  callbackGuardar,
) {
  const datosDia = datosMesActual[numeroDia] || {};
  let payloadEdicionDia = JSON.parse(JSON.stringify(datosDia || {}));
  const modal = document.getElementById("modal-editor-dia");
  const containerInputs = document.getElementById("categories-inputs-container");

  const ano = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");

  document.getElementById("editor-date-title").innerText =
    `EDITAR DÍA: ${String(numeroDia).padStart(2, "0")}/${mes}/${ano}`;
  containerInputs.innerHTML = "";

  Object.keys(categoriesConfig).forEach((catId) => {
    const esCategoriaValida = (catId.startsWith("C_") || catId === "S_complementos") && catId !== "C_sistema";
    if (!esCategoriaValida) return;

    const categoria = categoriesConfig[catId];
    const esMultiple = catId.startsWith("C_") && !["C_turnos", "C_tipodia"].includes(catId);
    
    const grupoDiv = document.createElement("div");
    grupoDiv.className = "editor-category-block";
    grupoDiv.innerHTML = `<div class="editor-category-title">${categoria.nombre || catId}:</div>`;

    if (catId === "S_complementos") {
      const subGrid = document.createElement("div");
      (categoria.opciones || []).forEach((opc) => {
        const valorGuardado = payloadEdicionDia.S_complementos?.[opc.id] ?? "";
        const item = document.createElement("div");
        item.style.marginBottom = "10px";
        item.innerHTML = `<span>${opc.valor}:</span><input type="number" value="${valorGuardado}" style="width:50px; border:2px solid #000; margin-left:5px;">`;
        item.querySelector("input").oninput = (e) => {
          if (!payloadEdicionDia["S_complementos"])
            payloadEdicionDia["S_complementos"] = {};
          payloadEdicionDia["S_complementos"][opc.id] =
            parseFloat(e.target.value) || 0;
        };
        subGrid.appendChild(item);
      });
      grupoDiv.appendChild(subGrid);
    } else {
      const contenedorChips = document.createElement("div");
      contenedorChips.className = "chips-container-block";

      const btnNinguno = document.createElement("button");
      btnNinguno.className = "chip-selection-btn";
      btnNinguno.innerText = "Ninguno";
      const noHay = esMultiple
        ? !payloadEdicionDia[catId] || payloadEdicionDia[catId].length === 0
        : !payloadEdicionDia[catId];
      if (noHay) btnNinguno.classList.add("activo");

      btnNinguno.onclick = () => {
        delete payloadEdicionDia[catId];
        contenedorChips.querySelectorAll(".chip-selection-btn").forEach((b) => {
          b.classList.remove("activo");
          b.style.backgroundColor = "";
          b.style.color = "";
        });
        btnNinguno.classList.add("activo");
      };
      contenedorChips.appendChild(btnNinguno);

      (categoria.opciones || []).forEach((opc) => {
        const btn = document.createElement("button");
        btn.className = "chip-selection-btn";
        btn.innerText = opc.valor;

        const activo = esMultiple
          ? Array.isArray(payloadEdicionDia[catId]) &&
            payloadEdicionDia[catId].includes(opc.id)
          : payloadEdicionDia[catId] === opc.id;
        
        if (activo) {
          btn.classList.add("activo");
          if (opc.color) {
            btn.style.setProperty("background-color", opc.color, "important");
            btn.style.setProperty("color", isColorLight(opc.color) ? "#000" : "#fff", "important");
          }
        }

        btn.onclick = () => {
          btnNinguno.classList.remove("activo");
          if (esMultiple) {
            if (!Array.isArray(payloadEdicionDia[catId]))
              payloadEdicionDia[catId] = [];
            const idx = payloadEdicionDia[catId].indexOf(opc.id);
            if (idx > -1) {
              payloadEdicionDia[catId].splice(idx, 1);
              btn.classList.remove("activo");
              btn.style.backgroundColor = "";
              btn.style.color = "";
            } else {
              payloadEdicionDia[catId].push(opc.id);
              btn.classList.add("activo");
              if (opc.color) {
                btn.style.setProperty("background-color", opc.color, "important");
                btn.style.setProperty("color", isColorLight(opc.color) ? "#000" : "#fff", "important");
              }
            }
          } else {
            payloadEdicionDia[catId] = opc.id;
            contenedorChips
              .querySelectorAll(".chip-selection-btn")
              .forEach((b) => {
                b.classList.remove("activo");
                b.style.backgroundColor = "";
                b.style.color = "";
              });
            btn.classList.add("activo");
            if (opc.color) {
              btn.style.setProperty("background-color", opc.color, "important");
              btn.style.setProperty("color", isColorLight(opc.color) ? "#000" : "#fff", "important");
            }
          }
        };
        contenedorChips.appendChild(btn);
      });
      grupoDiv.appendChild(contenedorChips);
    }
    containerInputs.appendChild(grupoDiv);
  });

  document.getElementById("input-comentario-dia").value =
    payloadEdicionDia.comentario || "";
  modal.classList.remove("hidden");

  // --- GUARDAR DÍA ---
  document.getElementById("btn-guardar-dia").onclick = async () => {
    try {
      const usuarioId = await obtenerUsuarioActual();
      if (!usuarioId) return;

      payloadEdicionDia.comentario = document.getElementById("input-comentario-dia").value;
      
      const copiaMes = JSON.parse(JSON.stringify(datosMesActual || {}));
      copiaMes[numeroDia] = payloadEdicionDia;
      
      const totalesActualizados = typeof calcularTotales === "function" 
        ? calcularTotales(copiaMes, categoriesConfig) 
        : {};
      
      const docRef = doc(db, "usuarios", usuarioId, "diario", `${ano}_${mes}`);
      await setDoc(docRef, { 
        [numeroDia]: payloadEdicionDia, 
        valoresTotales: totalesActualizados 
      }, { merge: true });
      
      modal.classList.add("hidden");
      if (typeof callbackGuardar === "function") callbackGuardar();
    } catch (e) {
      console.error("Error al guardar día:", e);
    }
  };

  // --- ELIMINAR DÍA ---
  document.getElementById("btn-eliminar-dia").onclick = async () => {
    try {
      const usuarioId = await obtenerUsuarioActual();
      if (!usuarioId) return;

      // Pedir confirmación con el modal inyectado
      const confirmado = await pedirConfirmacionDirecta(
        `¿Deseas eliminar todos los datos del día ${numeroDia}?`,
        "🗑️ ELIMINAR DÍA"
      );

      if (!confirmado) return;

      // Si confirma, borramos de Firestore
      const copiaMes = JSON.parse(JSON.stringify(datosMesActual || {}));
      delete copiaMes[numeroDia];
      delete copiaMes["valoresTotales"];
      
      const totalesActualizados = typeof calcularTotales === "function" 
        ? calcularTotales(copiaMes, categoriesConfig) 
        : {};
      
      const docRef = doc(db, "usuarios", usuarioId, "diario", `${ano}_${mes}`);
      await setDoc(docRef, { 
        [numeroDia]: deleteField(),
        valoresTotales: totalesActualizados
      }, { merge: true });
      
      modal.classList.add("hidden");
      if (typeof callbackGuardar === "function") callbackGuardar();
    } catch (e) {
      console.error("Error al eliminar día:", e);
    }
  };

  document.getElementById("btn-cerrar-editor").onclick = () =>
    modal.classList.add("hidden");
}