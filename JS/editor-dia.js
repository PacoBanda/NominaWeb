// JS/editor-dia.js

import {
  doc,
  setDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { db, USUARIO_ID } from "./firebase-init.js";
import { calcularTotales } from "./totales.js";

function isColorLight(colorHex) {
  if (!colorHex) return true;
  const hex = colorHex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 1000) / 1000 > 155;
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

  // --- LÓGICA DE GUARDADO INTEGRADA CON TOTALES ---
  document.getElementById("btn-guardar-dia").onclick = async () => {
    payloadEdicionDia.comentario = document.getElementById("input-comentario-dia").value;
    
    // 1. Simulamos el mes añadiendo el día editado
    const copiaMes = JSON.parse(JSON.stringify(datosMesActual));
    copiaMes[numeroDia] = payloadEdicionDia;
    
    // 2. Calculamos el mapa de totales actualizado
    const totalesActualizados = calcularTotales(copiaMes, categoriesConfig);
    
    // 3. Guardamos con setDoc y { merge: true } para pisar "valoresTotales" de raíz
    const docRef = doc(db, "usuarios", USUARIO_ID, "diario", `${ano}_${mes}`);
    await setDoc(docRef, { 
      [numeroDia]: payloadEdicionDia, 
      valoresTotales: totalesActualizados 
    }, { merge: true });
    
    modal.classList.add("hidden");
    callbackGuardar();
  };

  // --- LÓGICA DE ELIMINACIÓN INTEGRADA CON TOTALES ---
  document.getElementById("btn-eliminar-dia").onclick = async () => {
    if (confirm("¿Borrar día?")) {
      // 1. Simulamos eliminando el día de los datos actuales
      const copiaMes = JSON.parse(JSON.stringify(datosMesActual));
      delete copiaMes[numeroDia];
      delete copiaMes["valoresTotales"];
      
      // 2. Calculamos los totales limpios sin ese día
      const totalesActualizados = calcularTotales(copiaMes, categoriesConfig);
      
      // 3. Borramos el día en Firestore y pisamos el nodo completo de totales
      const docRef = doc(db, "usuarios", USUARIO_ID, "diario", `${ano}_${mes}`);
      await setDoc(docRef, { 
        [numeroDia]: deleteField(),
        valoresTotales: totalesActualizados
      }, { merge: true });
      
      modal.classList.add("hidden");
      callbackGuardar();
    }
  };

  document.getElementById("btn-cerrar-editor").onclick = () =>
    modal.classList.add("hidden");
}