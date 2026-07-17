import { db, USUARIO_ID } from "./firebase-init.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  limit,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// --- ESTADO GLOBAL ---
let SISTEMA_VARIABLES = {
  C_S_cantidad_1: 1,
  C_S_dias_mes: 30,
  C_S_dia_natural: 1,
  C_S_total_devengado: 0,
};

// Variable para el "Snapshot" que se guardará en Firestore
let snapshotNominaActual = { items: [], totales: {} };
let periodoActual = "2026_06"; // Variable dinámica para el mes

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
      doc(
        db,
        "usuarios",
        USUARIO_ID,
        "PreciosVariables",
        `${idConcepto}_${anio}`,
      ),
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

// --- MOTOR PRINCIPAL ---

async function ejecutarMotorCalculo(idDoc = periodoActual) {
  try {
    periodoActual = idDoc; // Sincroniza la variable global
    const docRefCierre = doc(db, "usuarios", USUARIO_ID, "NominasCerradas", idDoc);
    const snapCierre = await getDoc(docRefCierre);

    // Si el mes ya fue cerrado, cargamos el histórico
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

    const tbodyDev = document.getElementById("tbody-devengos");
    const tbodyRet = document.getElementById("tbody-retenciones");
    const tbodyBase = document.getElementById("tbody-bases");
    tbodyDev.innerHTML = tbodyRet.innerHTML = tbodyBase.innerHTML = "";

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

    const cachePrecios = new Map();
    let bruto = 0,
      deducciones = 0;
    snapshotNominaActual.items = [];

    for (const c of conceptos) {
      // --- LÓGICA DE FORMA DE PAGO ---
      const pago = (c.forma_pago || "Mensual").toLowerCase();
      if (pago === "junio" && mesInt !== 6) continue;
      if (pago === "diciembre" && mesInt !== 12) continue;

      const cant = totales[c.variable_cantidad] || 0;
      
      if (!cachePrecios.has(c.id)) {
        cachePrecios.set(
          c.id,
          c.tipo_precio === "Variable"
            ? await obtenerPrecioVariable(c.id, anio, mesInt)
            : await obtenerPrecioFijo(c.id, `${anio}-${mes}-01`),
        );
      }
      
      const precio = cachePrecios.get(c.id);
      const subtotal = cant * precio;
      
      // --- FILTRO: Ocultar conceptos con resultado 0 ---
      if (subtotal === 0) continue;

      const clase = (c.clase || "").toString().trim().toLowerCase();
      const nombre = (c.concepto || "").trim();

      snapshotNominaActual.items.push({
        codigo: c.codigo_empresa,
        nombre,
        cantidad: cant,
        precio,
        subtotal,
        clase,
      });

      const fila = `<tr><td>${c.codigo_empresa || "--"}</td><td>${nombre}</td><td>${cant.toFixed(1)}</td><td>${precio.toFixed(2)}</td><td>${subtotal.toFixed(2)}</td></tr>`;

      if (clase === "retencion") {
        tbodyRet.insertAdjacentHTML("beforeend", fila);
        deducciones += subtotal;
      } else if (clase === "base") {
        tbodyBase.insertAdjacentHTML(
          "beforeend",
          `<tr><td>${nombre}</td><td>${subtotal.toFixed(2)}</td></tr>`,
        );
      } else {
        tbodyDev.insertAdjacentHTML("beforeend", fila);
        bruto += subtotal;
      }
    }

    snapshotNominaActual.totales = {
      bruto,
      deducciones,
      neto: bruto - deducciones,
    };

    // Actualización de UI
    document.getElementById("txt-total-bruto").textContent = `${bruto.toFixed(2)}`;
    document.getElementById("txt-total-deducciones").textContent = `${deducciones.toFixed(2)}`;
    document.getElementById("txt-total-neto").textContent = `${(bruto - deducciones).toFixed(2)}`;
    document.getElementById("titulo-mes-anio-nomina").textContent = `PERIODO: ${idDoc.replace("_", "/")}`;
    
  } catch (e) {
    console.error("Error al ejecutar motor de cálculo:", e);
  }
}

// --- CIERRE INMUTABLE ---

export async function cerrarNomina(periodo) {
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
    ejecutarMotorCalculo(periodo); // Refrescar vista tras cerrar
  } catch (e) {
    console.error("Error al cerrar:", e);
  }
}

// --- NAVEGACIÓN ENTRE MESES ---

function cambiarPeriodo(direccion) {
    const [anio, mes] = periodoActual.split("_").map(Number);
    let nuevoMes = mes + direccion;
    let nuevoAnio = anio;

    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++; }
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio--; }

    periodoActual = `${nuevoAnio}_${nuevoMes.toString().padStart(2, '0')}`;
    ejecutarMotorCalculo(periodoActual);
}

// --- RENDERIZADO CERRADO ---

function renderizarDesdeCierre(data, idDoc) {
  const tbodyDev = document.getElementById("tbody-devengos");
  const tbodyRet = document.getElementById("tbody-retenciones");
  const tbodyBase = document.getElementById("tbody-bases");
  tbodyDev.innerHTML = tbodyRet.innerHTML = tbodyBase.innerHTML = "";

  if (data.items) {
    data.items.forEach((item) => {
      const fila = `<tr>
    <td>${item.codigo || "--"}</td>
    <td>${item.nombre}</td>
    <td>${item.cantidad}</td>
    <td>${item.precio.toFixed(2)}</td>
    <td>${item.subtotal.toFixed(2)}</td>
</tr>`;
      if (item.clase === "retencion")
        tbodyRet.insertAdjacentHTML("beforeend", fila);
      else if (item.clase === "base")
        tbodyBase.insertAdjacentHTML(
          "beforeend",
          `<tr><td>${item.nombre}</td><td>${item.subtotal.toFixed(2)}€</td></tr>`,
        );
      else tbodyDev.insertAdjacentHTML("beforeend", fila);
    });
  }

  if (data.totales) {
    document.getElementById("txt-total-bruto").textContent = `${data.totales.bruto.toFixed(2)} €`;
    document.getElementById("txt-total-deducciones").textContent = `${data.totales.deducciones.toFixed(2)} €`;
    document.getElementById("txt-total-neto").textContent = `${data.totales.neto.toFixed(2)} €`;
  }
  document.getElementById("titulo-mes-anio-nomina").textContent = `PERIODO CERRADO: ${idDoc.replace("_", "/")}`;
}

// --- INICIALIZACIÓN ---

document.addEventListener("DOMContentLoaded", () => {
  ejecutarMotorCalculo(periodoActual);

  document.getElementById("btn-mes-anterior").addEventListener("click", () => cambiarPeriodo(-1));
  document.getElementById("btn-mes-siguiente").addEventListener("click", () => cambiarPeriodo(1));

  const btn = document.getElementById("btn-cerrar-nomina");
  if (btn) {
    btn.addEventListener("click", () => cerrarNomina(periodoActual));
  }
});