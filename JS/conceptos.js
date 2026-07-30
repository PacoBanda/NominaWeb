import { db, obtenerUsuarioActual } from "./firebase-init.js";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// --- ESTADO Y UI REQUERIDOS ---
let USUARIO_ID = null;

const state = {
  variables: [],
  conceptos: [],
  modoEdicion: null // null | 'NUEVO' | id_concepto
};

// Referencias al DOM
let tbody;
let btnNuevo;
let tituloModulo;

document.addEventListener("DOMContentLoaded", async () => {
  USUARIO_ID = await obtenerUsuarioActual();
  if (!USUARIO_ID) return;

  // Inicialización de elementos del DOM con selectores corregidos
  tbody = document.getElementById("tbody-conceptos");
  btnNuevo = document.getElementById("btn-nuevo-concepto");
  tituloModulo = document.getElementById("titulo-modulo");

  // Listener en tiempo real para las categorías/variables de Firestore
  onSnapshot(collection(db, "usuarios", USUARIO_ID, "categorias"), (snap) => {
    state.variables = [];
    snap.forEach((docSnap) => {
      const catId = docSnap.id;
      const catData = docSnap.data();
      const cssClass = `cat-${catId.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      if (catData.opciones && Array.isArray(catData.opciones)) {
        catData.opciones.forEach((opc) =>
          state.variables.push({
            id: opc.id,
            nombre: opc.valor || opc.id,
            categoria: cssClass,
          }),
        );
      } else {
        state.variables.push({
          id: catId,
          nombre: catData.nombre || catData.valor || catId,
          categoria: cssClass,
        });
      }
    });
    renderUI();
  });

  // Listener en tiempo real para los conceptos de nómina
  onSnapshot(
    collection(db, "usuarios", USUARIO_ID, "ConceptosNomina"),
    (snap) => {
      const ordenClases = { "Devengo": 1, "Retencion": 2, "Base": 3 };

      state.conceptos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
            const prioridadA = ordenClases[a.clase] || 4;
            const prioridadB = ordenClases[b.clase] || 4;
            
            if (prioridadA !== prioridadB) {
                return prioridadA - prioridadB;
            }
            return (a.codigo_empresa || "").localeCompare(b.codigo_empresa || "");
        });
      renderUI();
    },
  );

  btnNuevo?.addEventListener("click", () => iniciarEdicion());
  tbody?.addEventListener("click", manejarClickTabla);
});

function renderUI() {
  if (!tbody || !tituloModulo) return;

  if (state.modoEdicion) return;
  
  tituloModulo.innerHTML = "Conceptos Nómina";

  tbody.innerHTML =
    state.conceptos.length === 0
      ? `<tr><td colspan="7" style="text-align:center;">No hay conceptos.</td></tr>`
      : state.conceptos
          .map((c) => {
            const v = state.variables.find((v) => v.id === c.variable_cantidad);
            const claseAbrev = c.clase?.charAt(0).toUpperCase() || "";
            return `
            <tr>
                <td class="text-center">${c.codigo_empresa || "—"}</td>
                <td class="font-bold clickable-concept" style="cursor:pointer;" data-id="${c.id}">${c.concepto}</td>
                <td><span class="badge-clase-view ${c.clase?.toLowerCase()}">${claseAbrev}</span></td>
                <td>${v ? `<span class="pill-variable ${v.categoria}">${v.nombre}</span>` : "—"}</td>
                <td>${c.tipo_precio === "Fijo" ? "F" : "V"}</td>
                <td>${c.forma_pago}</td>
                <td class="text-center"><button class="btn-delete-link" data-id="${c.id}">❌</button></td>
            </tr>`;
          })
          .join("");
}

function iniciarEdicion(id = null) {
    if (!tbody || !tituloModulo) return;

    state.modoEdicion = id || "NUEVO";
    
    const textoTitulo = id ? "Editando Concepto" : "Nuevo Concepto";
    tituloModulo.innerHTML = textoTitulo;

    const data = id ? state.conceptos.find(c => c.id === id) : { 
        codigo_empresa: "", 
        concepto: "", 
        clase: "Devengo", 
        variable_cantidad: state.variables[0]?.id || "", 
        tipo_precio: "Variable", 
        forma_pago: "Mensual" 
    };

    if (!data) {
        alert("El concepto ya no existe.");
        state.modoEdicion = null;
        renderUI();
        return;
    }

    const generarPills = (campo, opciones, valorActual) => opciones.map(op => `
        <button type="button" class="btn-pill-brutal ${valorActual === op.id ? 'active' : ''} ${op.categoria || ''}" 
                data-campo="${campo}" data-val="${op.id}">${op.nombre}</button>`).join('');

    tbody.innerHTML = `
        <tr class="fila-edicion-activa">
            <td>
                <input type="text" id="input-concepto-codigo" value="${data.codigo_empresa}" class="input-brutal-style" style="width: 40px;">
            </td>
            <td>
                <input type="text" id="input-concepto-nombre" value="${data.concepto}" class="input-brutal-style" style="width: 100%; min-width: 150px;">
            </td>
            <td>
                <div class="columna-vertical">
                    ${generarPills('clase', [
                        {id:'Devengo', nombre:'Devengo'}, 
                        {id:'Retencion', nombre:'Retención'}, 
                        {id:'Base', nombre:'Base'}
                    ], data.clase)}
                </div>
            </td>
            <td>
                <div class="columna-vertical">
                    ${generarPills('variable_cantidad', state.variables, data.variable_cantidad)}
                </div>
            </td>
            <td>
                <div class="columna-vertical">
                    ${generarPills('tipo_precio', [
                        {id:'Fijo', nombre:'Fijo'}, 
                        {id:'Variable', nombre:'Variable'}
                    ], data.tipo_precio)}
                </div>
            </td>
            <td>
                <div class="columna-vertical">
                    ${generarPills('forma_pago', [
                        {id:'Mensual', nombre:'Mensual'}, 
                        {id:'Junio', nombre:'Junio'}, 
                        {id:'Diciembre', nombre:'Diciembre'}
                    ], data.forma_pago)}
                </div>
            </td>
            <td class="contenedor-acciones-edicion">
                <div class="columna-vertical">
                    <button id="btn-guardar-inline" class="btn-guardar-brutal" style="width: 100%;">Save</button>
                    <button id="btn-cancelar-inline" class="btn-cancelar-brutal" style="width: 100%;">Salir</button>
                </div>
            </td>
        </tr>`;

    document.querySelectorAll('.btn-pill-brutal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const campo = e.target.dataset.campo;
            document.querySelectorAll(`.btn-pill-brutal[data-campo="${campo}"]`).forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    document.getElementById("btn-guardar-inline")?.addEventListener("click", guardarConcepto);
    document.getElementById("btn-cancelar-inline")?.addEventListener("click", () => { 
        state.modoEdicion = null; 
        renderUI(); 
    });
}

async function guardarConcepto() {
  const getPillValue = (campo) =>
    document.querySelector(`.btn-pill-brutal[data-campo="${campo}"].active`)
      ?.dataset.val || "";
      
  const conceptoTexto = document.getElementById("input-concepto-nombre")?.value || "";

  if (!conceptoTexto) return alert("El nombre es obligatorio");

  const idNombreBase = conceptoTexto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const id = state.modoEdicion === "NUEVO" ? `C_N_${idNombreBase}` : state.modoEdicion;

  const datosGuardar = {
    codigo_empresa: document.getElementById("input-concepto-codigo")?.value || "",
    concepto: conceptoTexto,
    clase: getPillValue("clase"),
    variable_cantidad: getPillValue("variable_cantidad"),
    tipo_precio: getPillValue("tipo_precio"),
    forma_pago: getPillValue("forma_pago"),
  };

  try {
    await setDoc(
      doc(db, "usuarios", USUARIO_ID, "ConceptosNomina", id),
      datosGuardar
    );
    state.modoEdicion = null;
    renderUI();
  } catch (error) {
    console.error("Error guardando el concepto: ", error);
  }
}

function manejarClickTabla(e) {
  if (e.target.classList.contains("btn-delete-link"))
    eliminarConcepto(e.target.dataset.id);
  if (e.target.classList.contains("clickable-concept"))
    iniciarEdicion(e.target.dataset.id);
}

async function eliminarConcepto(id) {
  if (confirm("¿Eliminar este concepto?")) {
    try {
      await deleteDoc(doc(db, "usuarios", USUARIO_ID, "ConceptosNomina", id));
    } catch (error) {
      console.error("Error eliminando concepto: ", error);
    }
  }
}