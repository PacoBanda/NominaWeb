import { db, obtenerUsuarioActual } from "./firebase-init.js";
import { mostrarConfirmacionCustom } from "./modal.js";
import {
  doc,
  setDoc,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { calcularTotales } from "./totales.js";

// --- FUNCIÓN AUXILIAR: Evaluar si un color de fondo es claro u oscuro ---
function esColorClaro(colorHex) {
  if (!colorHex || typeof colorHex !== "string") return true;
  let hex = colorHex.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Fórmula de luminancia relativa (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128;
}

export function abrirEditorDia(
  numeroDia,
  fechaActual,
  datosMesActual,
  categoriesConfig,
  callbackGuardar
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
    
    // 1. LA CONFIGURACIÓN MANDA SIEMPRE
    const esMultiple = 
      categoria.seleccionMultiple === true || 
      categoria.seleccionMultiple === "true";
    
    // Si la configuración es FALSE pero los datos guardados eran un Array, nos quedamos con el primer elemento
    if (!esMultiple && Array.isArray(payloadEdicionDia[catId])) {
      payloadEdicionDia[catId] = payloadEdicionDia[catId][0] || null;
    }

    const grupoDiv = document.createElement("div");
    grupoDiv.className = "editor-category-block";
    grupoDiv.innerHTML = `<div class="editor-category-title">${categoria.nombre || catId}:</div>`;

    if (catId === "S_complementos") {
      const subGrid = document.createElement("div");
      subGrid.className = "inputs-cantidad-subgrid";

      (categoria.opciones || []).forEach((opc) => {
        const valorGuardado = payloadEdicionDia.S_complementos?.[opc.id] ?? "";
        const item = document.createElement("div");
        item.className = "cantidad-input-item";
        item.innerHTML = `<span>${opc.valor}:</span><input type="number" class="input-cantidad-value" value="${valorGuardado}">`;
        
        item.querySelector("input").oninput = (e) => {
          if (!payloadEdicionDia["S_complementos"]) {
            payloadEdicionDia["S_complementos"] = {};
          }
          const val = parseFloat(e.target.value);
          if (isNaN(val) || val <= 0) {
            delete payloadEdicionDia["S_complementos"][opc.id];
          } else {
            payloadEdicionDia["S_complementos"][opc.id] = val;
          }
        };
        subGrid.appendChild(item);
      });
      grupoDiv.appendChild(subGrid);

    } else {
      const contenedorChips = document.createElement("div");
      contenedorChips.className = "chips-container-block";

      // Botón "Ninguno"
      const btnNinguno = document.createElement("button");
      btnNinguno.type = "button";
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

      // Botones de Opciones (Chips)
      (categoria.opciones || []).forEach((opc) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip-selection-btn";
        btn.innerText = opc.valor;

        const activo = esMultiple
          ? Array.isArray(payloadEdicionDia[catId]) && payloadEdicionDia[catId].includes(opc.id)
          : payloadEdicionDia[catId] === opc.id;
        
        if (activo) {
          btn.classList.add("activo");
          if (opc.color) {
            btn.style.setProperty("background-color", opc.color, "important");
            btn.style.setProperty("color", esColorClaro(opc.color) ? "#000" : "#fff", "important");
          }
        }

        btn.onclick = () => {
          btnNinguno.classList.remove("activo");

          if (esMultiple) {
            // Lógica de Selección Múltiple
            if (!Array.isArray(payloadEdicionDia[catId])) {
              payloadEdicionDia[catId] = [];
            }
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
                btn.style.setProperty("color", esColorClaro(opc.color) ? "#000" : "#fff", "important");
              }
            }
          } else {
            // Lógica de Selección Única
            payloadEdicionDia[catId] = opc.id;
            contenedorChips.querySelectorAll(".chip-selection-btn").forEach((b) => {
              b.classList.remove("activo");
              b.style.backgroundColor = "";
              b.style.color = "";
            });
            
            btn.classList.add("activo");
            if (opc.color) {
              btn.style.setProperty("background-color", opc.color, "important");
              btn.style.setProperty("color", esColorClaro(opc.color) ? "#000" : "#fff", "important");
            }
          }
        };
        contenedorChips.appendChild(btn);
      });
      grupoDiv.appendChild(contenedorChips);
    }
    containerInputs.appendChild(grupoDiv);
  });

  document.getElementById("input-comentario-dia").value = payloadEdicionDia.comentario || "";
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

      // 👇 Cambiamos confirm() por mostrarConfirmacionCustom con await
      const confirmado = await mostrarConfirmacionCustom(
        `¿Deseas eliminar todos los datos introducidos para el día ${numeroDia}?`,
        "⚠️ ELIMINAR DÍA"
      );
      
      if (!confirmado) return;

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