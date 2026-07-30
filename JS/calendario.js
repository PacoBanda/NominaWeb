import { db, obtenerUsuarioActual } from "./firebase-init.js";
import {
  onSnapshot,
  doc,
  setDoc,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// IMPORTS NECESARIOS DE OTROS MÓDULOS (Asegúrate de tener estos archivos)
import { abrirEditorDia } from "./editor-dia.js";
import { renderizarTotales } from "./totales.js";

// --- ESTADO GLOBAL ---
let USUARIO_ID = null;
let mapaSlotsConfig = {};
let datosMesActual = {};
let categoriesConfig = {};
let desvincularEscuchadorMes = null;
let fechaActual = new Date();

document.addEventListener("DOMContentLoaded", async () => {
  USUARIO_ID = await obtenerUsuarioActual();
  if (!USUARIO_ID) return;

  // Botones de Navegación y Configuración
  document.getElementById("btn-prev").onclick = cambiarMesAnterior;
  document.getElementById("btn-next").onclick = cambiarMesSiguiente;
  document.getElementById("btn-config-visual").onclick = abrirModalConfig;
  document.getElementById("btn-cerrar-config").onclick = () =>
    document.getElementById("modal-config").classList.add("hidden");
  document.getElementById("btn-guardar-config").onclick = guardarConfig;

  escucharConfiguracion();
  escucharCategorias();
});

function escucharConfiguracion() {
  onSnapshot(
    doc(db, "usuarios", USUARIO_ID, "configuracion", "visual"),
    (docSnap) => {
      mapaSlotsConfig = docSnap.exists() ? docSnap.data() : mapaSlotsConfig;
      if (Object.keys(datosMesActual).length > 0)
        actualizarPantallaCompleta(); 
    }
  );
}

function escucharCategorias() {
  onSnapshot(
    collection(db, "usuarios", USUARIO_ID, "categorias"),
    (snapshot) => {
      categoriesConfig = {};
      snapshot.forEach((docSnap) => {
        categoriesConfig[docSnap.id] = docSnap.data();
      });
      escucharDatosMesActual();
    }
  );
}

function escucharDatosMesActual() {
  if (desvincularEscuchadorMes) desvincularEscuchadorMes();
  const ano = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const docRef = doc(db, "usuarios", USUARIO_ID, "diario", `${ano}_${mes}`);

  desvincularEscuchadorMes = onSnapshot(docRef, (docSnap) => {
    datosMesActual = docSnap.exists() ? docSnap.data() : {};
    actualizarPantallaCompleta();
  });
}

function cambiarMesAnterior() {
  fechaActual.setMonth(fechaActual.getMonth() - 1);
  escucharDatosMesActual();
}

function cambiarMesSiguiente() {
  fechaActual.setMonth(fechaActual.getMonth() + 1);
  escucharDatosMesActual();
}

function abrirModalConfig() {
  const container = document.getElementById("config-slots-container");
  if (!container) return;
  container.innerHTML = "";

  const slotsConfigurables = ["slot_1", "slot_2", "slot_3"];
  slotsConfigurables.forEach((key, index) => {
    let options = `<option value="">-- Vacío --</option>`;
    
    Object.keys(categoriesConfig).forEach((catId) => {
      const esValida = catId.startsWith("C_") || catId === "S_complementos";
      
      if (esValida) {
        const selected = mapaSlotsConfig[key] === catId ? "selected" : "";
        options += `<option value="${catId}" ${selected}>${categoriesConfig[catId].nombre}</option>`;
      }
    });

    container.innerHTML += `
      <div style="margin-bottom:10px;">
        Slot ${index + 1}: 
        <select class="slot-select" id="${key}">${options}</select>
      </div>`;
  });

  const isNotaChecked = mapaSlotsConfig.slot_nota === "true" ? "checked" : "";
  container.innerHTML += `
        <div style="margin-top:20px; border-top:1px solid #ccc; padding-top:10px;">
            <label>
                <input type="checkbox" id="check-slot-nota" ${isNotaChecked}> 
                Mostrar columna de NOTAS
            </label>
        </div>`;

  document.getElementById("modal-config")?.classList.remove("hidden");
}

async function guardarConfig() {
  const nuevoMapa = {};
  document
    .querySelectorAll(".slot-select")
    .forEach((el) => (nuevoMapa[el.id] = el.value));

  nuevoMapa.slot_nota = document.getElementById("check-slot-nota")?.checked
    ? "true"
    : "false";

  // Guardado directo en Firestore
  try {
    await setDoc(doc(db, "usuarios", USUARIO_ID, "configuracion", "visual"), nuevoMapa);
  } catch (err) {
    console.error("Error al guardar la configuración:", err);
  }

  mapaSlotsConfig = nuevoMapa;
  document.getElementById("modal-config")?.classList.add("hidden");
  renderizarCalendarioCompleto();
}

function renderizarCalendarioCompleto() {
  const listContainer = document.getElementById("calendar-grid");
  const title = document.getElementById("month-year-title");
  if (!listContainer || !title) return;

  const daysInMonth = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
  title.innerText = `${fechaActual.toLocaleString("es-ES", { month: "long" }).toUpperCase()} ${fechaActual.getFullYear()}`;
  listContainer.innerHTML = "";

  const diasSemana = ["D", "L", "M", "X", "J", "V", "S"];
  const ordenSlots = ["slot_1", "slot_2", "slot_3"];

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), i);
    const datosDia = datosMesActual[i] || {};
    
    let colorTurno = null;
    const catTurnos = categoriesConfig["C_turnos"];
    if (datosDia["C_turnos"] && catTurnos?.opciones) {
        const opcion = catTurnos.opciones.find(o => o.id === datosDia["C_turnos"]);
        if (opcion?.color) colorTurno = opcion.color;
    }

    let colorTipo = null;
    const catTipos = categoriesConfig["C_tipodia"];
    if (datosDia.C_tipodia && catTipos?.opciones) {
        const opcionTipo = catTipos.opciones.find(o => o.id === datosDia.C_tipodia);
        if (opcionTipo?.color) colorTipo = opcionTipo.color;
    }
    
    const row = document.createElement("div");
    row.className = "day-row";
    if (colorTurno) row.style.setProperty('--color-turno', colorTurno);
    if (colorTipo) row.style.setProperty('--color-tipo', colorTipo);
    if (colorTurno) row.classList.add("con-turno");
    if (colorTipo) row.classList.add("con-tipo");
    if (mapaSlotsConfig.slot_nota === "true") row.classList.add("show-notes");
    if (d.getDay() === 6) row.classList.add("sabado");
    if (d.getDay() === 0) row.classList.add("domingo");

    let htmlContenido = "";
    ordenSlots.forEach((slotKey) => {
      const catId = mapaSlotsConfig[slotKey];
      let contenido = "";
      
      if (catId && datosDia[catId] && categoriesConfig[catId]) {
        const valGuardado = datosDia[catId];
        const categoria = categoriesConfig[catId];

        if (catId.startsWith("S_")) {
          contenido = Object.entries(valGuardado)
            .filter(([_, cant]) => cant > 0)
            .map(([id, cant]) => {
              const opc = categoria.opciones?.find(o => o.id === id);
              if (!opc) return "";
              const nombre = opc.valor;
              const truncado = nombre.length > 9 ? nombre.substring(0, 9) : nombre;
              return `<div>${truncado} ${cant}</div>`;
            })
            .join("");
        } else {
          contenido = categoria.opciones ? 
            (Array.isArray(valGuardado) ? valGuardado : [valGuardado])
              .map(id => {
                const nombre = categoria.opciones.find(o => o.id === id)?.valor || id;
                return `<div>${nombre}</div>`;
              })
              .join("") : 
            `<div>${valGuardado}</div>`;
        }
      }
      htmlContenido += `<div class="day-col">${contenido}</div>`;
    });

    if (mapaSlotsConfig.slot_nota === "true") {
      htmlContenido += `<div class="day-col day-col-nota">${datosDia.comentario || ""}</div>`;
    }

    row.innerHTML = `<div class="day-label">${diasSemana[d.getDay()]}</div>
                     <div class="day-num">${i}</div>
                     ${htmlContenido}`;

    // Evento de clic para abrir el editor
    if (typeof abrirEditorDia === "function") {
      row.onclick = () => abrirEditorDia(i, fechaActual, datosMesActual, categoriesConfig, renderizarCalendarioCompleto);
    }

    listContainer.appendChild(row);
  }
}

function actualizarPantallaCompleta() {
  renderizarCalendarioCompleto();
  if (typeof renderizarTotales === "function") {
    renderizarTotales(datosMesActual, categoriesConfig);
  }
}