import { db, obtenerUsuarioActual } from "./firebase-init.js";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

let USUARIO_ID = null;

// --- ESTADO GLOBAL ---
let SISTEMA_VARIABLES = {
  C_S_cantidad_1: 1,
  C_S_base_cc: 0, // Base C.C.
  C_S_base_at: 0, // Base A.T.
  C_S_base_he: 0, // Base H.E.
  C_S_total_devengado: 0,
};

let snapshotNominaActual = { items: [], totales: {} };

// --- CÁLCULO DINÁMICO DEL PERIODO ACTUAL ---
const fechaHoy = new Date();
const anioActual = fechaHoy.getFullYear();
const mesActual = String(fechaHoy.getMonth() + 1).padStart(2, "0");
let periodoActual = `${anioActual}_${mesActual}`; 

document.addEventListener("DOMContentLoaded", async () => {
  USUARIO_ID = await obtenerUsuarioActual();
  if (!USUARIO_ID) return;

  ejecutarMotorCalculo(periodoActual);

  document.getElementById("btn-mes-anterior")?.addEventListener("click", () => cambiarPeriodo(-1));
  document.getElementById("btn-mes-siguiente")?.addEventListener("click", () => cambiarPeriodo(1));
  document.getElementById("btn-cerrar-nomina")?.addEventListener("click", () => cerrarNomina(periodoActual));
});

// --- FUNCIONES DE APOYO ---
async function obtenerPrecioFijo(idConcepto, fechaPeriodo) {
  try {
    const q = query(
      collection(db, "usuarios", USUARIO_ID, "PreciosFijos"),
      where("fechaVigor", "<=", fechaPeriodo),
      orderBy("fechaVigor", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    return !snap.empty
      ? parseFloat(snap.docs[0].data().valores?.[idConcepto] || 0)
      : 0;
  } catch (e) {
    console.error("Error al obtener precio fijo", e);
    return 0;
  }
}

async function obtenerPrecioVariable(idConcepto, anio, mes) {
  try {
    const snap = await getDoc(
      doc(db, "usuarios", USUARIO_ID, "PreciosVariables", `${idConcepto}_${anio}`),
    );
    return snap.exists() ? parseFloat(snap.data().meses?.[`m${mes}`] || 0) : 0;
  } catch (e) {
    console.error("Error al obtener precio variable", e);
    return 0;
  }
}

function configurarUI(estaCerrada) {
  const btnCerrar = document.getElementById("btn-cerrar-nomina");
  if (btnCerrar) {
    btnCerrar.style.display = estaCerrada ? "none" : "block";
  }
}

function mostrarConfirmacionCustom(mensaje) {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    const msgElem = document.getElementById("custom-confirm-message");
    const btnAceptar = document.getElementById("btn-confirm-accept");
    const btnCancelar = document.getElementById("btn-confirm-cancel");

    if (!modal || !msgElem) return resolve(false);

    msgElem.textContent = mensaje;
    modal.classList.remove("hidden");

    const alAceptar = () => finaliza(true);
    const alCancelar = () => finaliza(false);

    const finaliza = (resultado) => {
      modal.classList.add("hidden");
      btnAceptar.removeEventListener("click", alAceptar);
      btnCancelar.removeEventListener("click", alCancelar);
      resolve(resultado);
    };

    btnAceptar.addEventListener("click", alAceptar);
    btnCancelar.addEventListener("click", alCancelar);
  });
}

// --- MOTOR PRINCIPAL ---
async function ejecutarMotorCalculo(idDoc = periodoActual) {
  try {
    periodoActual = idDoc; 
    const docRefCierre = doc(db, "usuarios", USUARIO_ID, "NominasCerradas", idDoc);
    const snapCierre = await getDoc(docRefCierre);

    if (snapCierre.exists()) {
      renderizarDesdeCierre(snapCierre.data(), idDoc);
      configurarUI(true);
      return;
    }

    configurarUI(false);
    const [anio, mes] = idDoc.split("_");
    const mesInt = parseInt(mes);
    const diasDelMes = new Date(parseInt(anio), mesInt, 0).getDate();
    
    SISTEMA_VARIABLES.C_S_dias_mes = diasDelMes;
    SISTEMA_VARIABLES.C_S_dia_natural = diasDelMes;
    SISTEMA_VARIABLES.C_S_total_devengado = 0;

    const tbodyDev = document.getElementById("tbody-devengos");
    const tbodyRet = document.getElementById("tbody-retenciones");
    const tbodyBase = document.getElementById("tbody-bases");
    
    if (tbodyDev) tbodyDev.innerHTML = "";
    if (tbodyRet) tbodyRet.innerHTML = "";
    if (tbodyBase) tbodyBase.innerHTML = "";

    const [snapConceptos, docDiario] = await Promise.all([
      getDocs(collection(db, "usuarios", USUARIO_ID, "ConceptosNomina")),
      getDoc(doc(db, "usuarios", USUARIO_ID, "diario", idDoc)),
    ]);

    const totales = {
      ...(docDiario.exists() ? docDiario.data().valoresTotales : {}),
      ...SISTEMA_VARIABLES,
    };
    
    const conceptos = snapConceptos.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // -------------------------------------------------------------------------
    // ORDENACIÓN DE CONCEPTOS:
    // 1. Por CLASE (Devengos primero, Bases en medio, Retenciones al final)
    // 2. Por CÓDIGO DE EMPRESA (0001, 0015, 0203, 0242, 0350...)
    // -------------------------------------------------------------------------
    conceptos.sort((a, b) => {
      const claseA = (a.clase || "").toLowerCase();
      const claseB = (b.clase || "").toLowerCase();
      
      const ordenClase = { devengo: 1, base: 2, retencion: 3 };
      const pesoA = ordenClase[claseA] || 4;
      const pesoB = ordenClase[claseB] || 4;
      
      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }

      const codA = (a.codigo_empresa || a.codigo || "").toString();
      const codB = (b.codigo_empresa || b.codigo || "").toString();

      return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: "base" });
    });

    const promesasPrecios = conceptos.map(c => 
      c.tipo_precio === "Variable"
        ? obtenerPrecioVariable(c.id, anio, mesInt)
        : obtenerPrecioFijo(c.id, `${anio}-${mes}-01`)
    );
    const preciosResueltos = await Promise.all(promesasPrecios);

    // -------------------------------------------------------------------------
    // PRIMERA PASADA: Identificar Base A.T., Base C.C. y Base H.E.
    // -------------------------------------------------------------------------
    conceptos.forEach((c, i) => {
      const nombreConcepto = (c.concepto || "").trim().toLowerCase();
      const cant = totales[c.variable_cantidad] || 0;
      const precio = preciosResueltos[i] || 0;
      const subtotalCalculado = cant * precio;

      // Base A.T.
      if (nombreConcepto.includes("base a.t.") || nombreConcepto.includes("base at")) {
        totales.C_S_base_at = subtotalCalculado;
        SISTEMA_VARIABLES.C_S_base_at = subtotalCalculado;
      }

      // Base C.C.
      if (nombreConcepto.includes("base c.c.") || nombreConcepto.includes("base cc")) {
        totales.C_S_base_cc = subtotalCalculado;
        SISTEMA_VARIABLES.C_S_base_cc = subtotalCalculado;
      }

      // Base H.E.
      if (nombreConcepto.includes("base h.e.") || nombreConcepto.includes("base he")) {
        totales.C_S_base_he = subtotalCalculado;
        SISTEMA_VARIABLES.C_S_base_he = subtotalCalculado;
      }
    });

    let bruto = 0, deducciones = 0;
    snapshotNominaActual.items = [];

    // -------------------------------------------------------------------------
    // SEGUNDA PASADA: Renderizado y cálculo definitivo de la nómina
    // -------------------------------------------------------------------------
    conceptos.forEach((c, i) => {
      const pago = (c.forma_pago || "Mensual").toLowerCase();
      if (pago === "junio" && mesInt !== 6) return;
      if (pago === "diciembre" && mesInt !== 12) return;

      totales.C_S_total_devengado = bruto;

      const cant = totales[c.variable_cantidad] || 0;
      const precio = preciosResueltos[i] || 0;
      const subtotal = cant * precio;
      
      if (subtotal === 0) return;

      const clase = (c.clase || "").toString().trim().toLowerCase();
      const nombre = (c.concepto || "").trim();

      snapshotNominaActual.items.push({
        codigo: c.codigo_empresa || "--",
        nombre,
        cantidad: cant,
        precio,
        subtotal,
        clase,
      });

      const fila = `<tr>
        <td>${c.codigo_empresa || "--"}</td>
        <td>${nombre}</td>
        <td>${cant.toFixed(1)}</td>
        <td>${precio.toFixed(2)} €</td>
        <td><strong>${subtotal.toFixed(2)} €</strong></td>
      </tr>`;

      if (clase === "retencion") {
        tbodyRet?.insertAdjacentHTML("beforeend", fila);
        deducciones += subtotal;
      } else if (clase === "base") {
        tbodyBase?.insertAdjacentHTML(
          "beforeend",
          `<tr><td>${nombre}</td><td><strong>${subtotal.toFixed(2)} €</strong></td></tr>`,
        );
      } else {
        tbodyDev?.insertAdjacentHTML("beforeend", fila);
        bruto += subtotal;
      }
    });

    snapshotNominaActual.totales = {
      bruto,
      deducciones,
      neto: bruto - deducciones,
    };

    if(document.getElementById("txt-total-bruto")) document.getElementById("txt-total-bruto").textContent = `${bruto.toFixed(2)} €`;
    if(document.getElementById("txt-total-deducciones")) document.getElementById("txt-total-deducciones").textContent = `${deducciones.toFixed(2)} €`;
    if(document.getElementById("txt-total-neto")) document.getElementById("txt-total-neto").textContent = `${(bruto - deducciones).toFixed(2)} €`;
    if(document.getElementById("titulo-mes-anio-nomina")) document.getElementById("titulo-mes-anio-nomina").textContent = `PERIODO: ${idDoc.replace("_", "/")}`;
    
    if (tbodyDev && tbodyDev.children.length === 0) tbodyDev.innerHTML = `<tr><td colspan="5" class="no-data">Sin devengos en este periodo</td></tr>`;
    if (tbodyRet && tbodyRet.children.length === 0) tbodyRet.innerHTML = `<tr><td colspan="5" class="no-data">Sin retenciones en este periodo</td></tr>`;
    if (tbodyBase && tbodyBase.children.length === 0) tbodyBase.innerHTML = `<tr><td colspan="2" class="no-data">Sin bases de cotización</td></tr>`;

  } catch (e) {
    console.error("Error al ejecutar motor de cálculo:", e);
  }
}

export async function cerrarNomina(periodo) {
  const periodoFormateado = periodo.replace("_", "/");
  const confirmado = await mostrarConfirmacionCustom(`¿Cerrar nómina de ${periodoFormateado}? Los datos serán inmutables, aunque cambies datos en el calendario.`);
  if (!confirmado) return;

  try {
    const datosCierre = {
      ...snapshotNominaActual,
      fechaCierre: new Date().toISOString(),
      periodo: periodo,
    };
    await setDoc(
      doc(db, "usuarios", USUARIO_ID, "NominasCerradas", periodo),
      datosCierre,
    );
    ejecutarMotorCalculo(periodo); 
  } catch (e) {
    console.error("Error al cerrar la nómina:", e);
  }
}

function cambiarPeriodo(direccion) {
    const [anio, mes] = periodoActual.split("_").map(Number);
    let nuevoMes = mes + direccion;
    let nuevoAnio = anio;

    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++; }
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio--; }

    periodoActual = `${nuevoAnio}_${nuevoMes.toString().padStart(2, '0')}`;
    ejecutarMotorCalculo(periodoActual);
}

function renderizarDesdeCierre(data, idDoc) {
  const tbodyDev = document.getElementById("tbody-devengos");
  const tbodyRet = document.getElementById("tbody-retenciones");
  const tbodyBase = document.getElementById("tbody-bases");
  
  if (tbodyDev) tbodyDev.innerHTML = "";
  if (tbodyRet) tbodyRet.innerHTML = "";
  if (tbodyBase) tbodyBase.innerHTML = "";

  if (data.items) {
    data.items.forEach((item) => {
      const fila = `<tr>
        <td>${item.codigo || "--"}</td>
        <td>${item.nombre}</td>
        <td>${Number(item.cantidad).toFixed(1)}</td>
        <td>${Number(item.precio).toFixed(2)} €</td>
        <td><strong>${Number(item.subtotal).toFixed(2)} €</strong></td>
      </tr>`;
      
      if (item.clase === "retencion") {
        tbodyRet?.insertAdjacentHTML("beforeend", fila);
      } else if (item.clase === "base") {
        tbodyBase?.insertAdjacentHTML(
          "beforeend",
          `<tr><td>${item.nombre}</td><td><strong>${Number(item.subtotal).toFixed(2)} €</strong></td></tr>`,
        );
      } else {
        tbodyDev?.insertAdjacentHTML("beforeend", fila);
      }
    });
  }

  if (data.totales) {
    if(document.getElementById("txt-total-bruto")) document.getElementById("txt-total-bruto").textContent = `${Number(data.totales.bruto).toFixed(2)} €`;
    if(document.getElementById("txt-total-deducciones")) document.getElementById("txt-total-deducciones").textContent = `${Number(data.totales.deducciones).toFixed(2)} €`;
    if(document.getElementById("txt-total-neto")) document.getElementById("txt-total-neto").textContent = `${Number(data.totales.neto).toFixed(2)} €`;
  }
  
  if(document.getElementById("titulo-mes-anio-nomina")) document.getElementById("titulo-mes-anio-nomina").textContent = `PERIODO CERRADO: ${idDoc.replace("_", "/")}`;
  
  if (tbodyDev && tbodyDev.children.length === 0) tbodyDev.innerHTML = `<tr><td colspan="5" class="no-data">Sin devengos registrados</td></tr>`;
  if (tbodyRet && tbodyRet.children.length === 0) tbodyRet.innerHTML = `<tr><td colspan="5" class="no-data">Sin retenciones registradas</td></tr>`;
  if (tbodyBase && tbodyBase.children.length === 0) tbodyBase.innerHTML = `<tr><td colspan="2" class="no-data">Sin bases registradas</td></tr>`;
}