// JS/categorias.js
import { db, USUARIO_ID } from "./firebase-init.js";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// --- CONSTANTES ---
const ID_TARJETA_SUMAR_FIJA = "S_complementos";
const ID_CONTAR_SISTEMA = "C_sistema";
const ID_CONTAR_TURNOS = "C_turnos";
const ID_CONTAR_TIPODIA = "C_tipodia";

// --- ESTADO ---
let idFormulaEnEdicion = null;
let idElementoEnEdicion = null;
activarEscuchadorCategorias();

function activarEscuchadorCategorias() {
  const colRef = collection(db, "usuarios", USUARIO_ID, "categorias");

  onSnapshot(colRef, async (snapshot) => {
    const listaCantidadContainer = document.getElementById("lista-cantidad");
    const listaContarContainer = document.getElementById("lista-contar");
    const listaFormulasContainer = document.getElementById("lista-formulas");

    if (
      !listaCantidadContainer ||
      !listaContarContainer ||
      !listaFormulasContainer
    )
      return;

    listaCantidadContainer.innerHTML = "";
    listaContarContainer.innerHTML = "";
    listaFormulasContainer.innerHTML = "";

    let existeTarjetaSumar = false;
    let existeContarSistema = false;
    let existeContarTurnos = false;
    let existeContarTipoDia = false;

    const docsContar = [];
    const docsFormulas = [];
    let dataTarjetaCantidad = null;

    const opcionesDisponiblesParaFormulas = [];

    snapshot.forEach((subDoc) => {
      const id = subDoc.id;
      const data = subDoc.data();
      if (!data) return;

      const idLower = id.toLowerCase();
      const esTarjetaSistemaGenerica =
        idLower === "sistema" ||
        idLower === "c_sistema" ||
        idLower === "predefinida" ||
        idLower === "c_predefinida";

      if (id === ID_TARJETA_SUMAR_FIJA) {
        existeTarjetaSumar = true;
        dataTarjetaCantidad = { id, data };
        (data.opciones || []).forEach((o) => {
          opcionesDisponiblesParaFormulas.push({
            id: o.id,
            nombre: `Cantidad → ${o.valor}`,
          });
        });
      } else if (id.startsWith("C_") || esTarjetaSistemaGenerica) {
        if (id === ID_CONTAR_SISTEMA) existeContarSistema = true;
        if (id === ID_CONTAR_TURNOS) existeContarTurnos = true;
        if (id === ID_CONTAR_TIPODIA) existeContarTipoDia = true;
        docsContar.push({ id, data });
        (data.opciones || []).forEach((o) => {
          opcionesDisponiblesParaFormulas.push({
            id: o.id,
            nombre: `${data.nombre} → ${o.valor}`,
          });
        });
      } else if (id.startsWith("F_")) {
        docsFormulas.push({ id, data });
      }
    });

    if (!existeTarjetaSumar) {
      await setDoc(
        doc(db, "usuarios", USUARIO_ID, "categorias", ID_TARJETA_SUMAR_FIJA),
        { nombre: "Complementos de Cantidad", opciones: [] },
      );
      return;
    }
    if (!existeContarSistema) {
      await setDoc(
        doc(db, "usuarios", USUARIO_ID, "categorias", ID_CONTAR_SISTEMA),
        {
          nombre: "Lista_Sistema",
          seleccionMultiple: false,
          opciones: [
            {
              id: "C_E_dia_natural",
              valor: "Dia_Natural",
              color: "#cc0000",
              visible: true,
              posicion: 1,
            },
            {
              id: "C_E_dias_mes",
              valor: "Dias_Mes",
              color: "#cc0000",
              visible: true,
              posicion: 2,
            },
          ],
        },
      );
      return;
    }
    if (!existeContarTurnos) {
      await setDoc(
        doc(db, "usuarios", USUARIO_ID, "categorias", ID_CONTAR_TURNOS),
        { nombre: "Lista_Turnos", seleccionMultiple: false, opciones: [] },
      );
      return;
    }
    if (!existeContarTipoDia) {
      await setDoc(
        doc(db, "usuarios", USUARIO_ID, "categorias", ID_CONTAR_TIPODIA),
        { nombre: "Lista_TipoDia", seleccionMultiple: false, opciones: [] },
      );
      return;
    }

    docsContar.sort((a, b) => {
      const prioridades = {
        [ID_CONTAR_SISTEMA]: 1,
        [ID_CONTAR_TURNOS]: 2,
        [ID_CONTAR_TIPODIA]: 3,
      };
      const prioridaA = prioridades[a.id] || 99;
      const prioridaB = prioridades[b.id] || 99;
      return prioridaA !== prioridaB
        ? prioridaA - prioridaB
        : (a.data.nombre || "").localeCompare(b.data.nombre || "");
    });

    docsFormulas.sort((a, b) =>
      (a.data.nombre || "").localeCompare(b.data.nombre || ""),
    );

    if (dataTarjetaCantidad)
      listaCantidadContainer.appendChild(
        crearTarjetaCategoriaDOM(
          dataTarjetaCantidad.id,
          dataTarjetaCantidad.data,
        ),
      );
    // CÓDIGO MODIFICADO:
    docsContar.forEach((docItem) => {
      // Si el ID corresponde a la lista del sistema, no la añadimos al contenedor visual
      if (docItem.id === ID_CONTAR_SISTEMA) return;

      listaContarContainer.appendChild(
        crearTarjetaCategoriaDOM(docItem.id, docItem.data),
      );
    });
    docsFormulas.forEach((docItem) =>
      listaFormulasContainer.appendChild(
        crearTarjetaFormulaDOM(
          docItem.id,
          docItem.data,
          opcionesDisponiblesParaFormulas,
        ),
      ),
    );
  });
}

function crearTarjetaCategoriaDOM(id, categoria) {
  const card = document.createElement("div");
  card.className = "card";
  const esTarjetaSistemaFija =
    id === ID_CONTAR_SISTEMA ||
    id === ID_CONTAR_TURNOS ||
    id === ID_CONTAR_TIPODIA ||
    id === ID_TARJETA_SUMAR_FIJA;
  const esContarDinámico = id.startsWith("C_") && !esTarjetaSistemaFija;
  const esTarjetaTurnos = id === ID_CONTAR_TURNOS;
  const isChecked = categoria.seleccionMultiple === true ? "checked" : "";

  card.innerHTML = `
    <div style="margin-bottom: 8px;"><h2 class="category-title" style="margin: 0;"></h2></div>
    <div class="elements-list"></div>
    
    <div class="control-footer-row" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 2px 0;">
        <div>${esContarDinámico ? `<div style="display: flex; align-items: center; gap: 4px;"><input type="checkbox" class="check-toggle-multiple" id="chk-mult-${id}" ${isChecked} style="width: 12px; height: 12px; margin: 0; cursor: pointer; accent-color: #000; border: 1.5px solid #000;"><label for="chk-mult-${id}" style="font-size: 10px; font-weight: bold; cursor: pointer; color: #000; user-select: none;">Múltiple</label></div>` : "<div></div>"}</div>
        <div class="add-element-trigger" style="cursor: pointer; font-weight: bold; color: #000; font-size: 11px; text-decoration:underline;">Añadir elemento +</div>
    </div>

    <div class="inline-form-add" style="display: none; flex-direction: column; gap: 6px; border: 1.5px dashed #000; padding: 8px; margin-top: 8px; background: #fafafa;">
        <input type="text" class="input-element-name" placeholder="Nombre..." style="padding: 4px; border: 1.5px solid #000; font-weight: bold; width: 100%; box-sizing: border-box; font-size:11px;">
        
        ${esTarjetaTurnos ? `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;"><div style="display:flex; flex-direction:column; gap:2px;"><label style="font-size:9px; font-weight:bold;">H. Inicio:</label><input type="time" class="input-turno-inicio" style="padding: 2px; border: 1.5px solid #000; font-size:11px; font-weight:bold;"></div><div style="display:flex; flex-direction:column; gap:2px;"><label style="font-size:9px; font-weight:bold;">H. Fin:</label><input type="time" class="input-turno-fin" style="padding: 2px; border: 1.5px solid #000; font-size:11px; font-weight:bold;"></div></div><div style="display: flex; flex-direction: column; gap: 2px;"><label style="font-size:9px; font-weight:bold;">Cantidad de Horas:</label><input type="number" step="0.01" class="input-turno-horas" placeholder="Ej: 8" style="padding: 4px; border: 1.5px solid #000; font-weight: bold; font-size:11px; box-sizing: border-box; width:100%;"></div>` : ""}
        
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 11px; font-weight: bold; margin-top: 2px;">
            <div class="color-presets-wrapper"><span style="font-size: 10px; color:#555;">Paleta:</span><div class="color-box-preset" data-color="#a3e635" style="background-color: #a3e635;" title="Verde Lima"></div><div class="color-box-preset" data-color="#f472b6" style="background-color: #f472b6;" title="Rosa"></div><div class="color-box-preset" data-color="#38bdf8" style="background-color: #38bdf8;" title="Celeste"></div></div>
            <div style="display: flex; align-items: center; gap: 4px;"><span style="font-size: 10px; color:#555;">Otro:</span><input type="color" class="input-element-color" value="#a3e635" style="border: 1.5px solid #000; padding: 0; cursor: pointer; width: 22px; height: 18px;"></div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top:6px; align-items: center;">
            <div id="error-duplicado-${id}" style="display:none; color:#cc0000; font-size:10px; font-weight:bold; margin-right:auto;">⚠️ ¡Nombre duplicado!</div>
            <button class="btn-cancel-element" style="background: #e2e8f0; border: 1.5px solid #000; font-weight: bold; padding: 2px 8px; cursor: pointer; font-size:10px;">X</button>
            <button class="btn-save-element" style="background: #ffff00; border: 1.5px solid #000; font-weight: bold; padding: 2px 8px; cursor: pointer; box-shadow: 1px 1px 0px #000; font-size:10px;">OK</button>
        </div>
    </div>
    ${esContarDinámico ? `<div class="btn-delete-card">× Eliminar Categoría</div>` : ""}
  `;

  card.querySelector(".category-title").textContent =
    categoria.nombre || "Sin Nombre";
  card.querySelectorAll(".inline-form-add .color-box-preset").forEach((box) => {
    box.onclick = () => {
      card
        .querySelectorAll(".inline-form-add .color-box-preset")
        .forEach((b) => b.classList.remove("selected-preset"));
      box.classList.add("selected-preset");
      card.querySelector(".inline-form-add .input-element-color").value =
        box.getAttribute("data-color");
    };
  });

  const listContainer = card.querySelector(".elements-list");
  (categoria.opciones || []).forEach((opc) => {
    const item = document.createElement("div");
    item.className = "element-item";
    item.style.backgroundColor = opc.color || "#a3e635";
    item.style.color = isColorLight(opc.color || "#a3e635")
      ? "#000000"
      : "#ffffff";
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";
    item.style.gap = "2px";
    item.style.padding = "6px 8px";

    const claveEdicionUnica = `${id}_${opc.id}`;
    if (idElementoEnEdicion === claveEdicionUnica) {
      item.style.backgroundColor = "#ffffff";
      item.style.color = "#000000";
      item.style.border = "2px dashed #000000";
      item.innerHTML = `<div style="display: flex; flex-direction: column; gap: 4px; padding: 2px 0;" onclick="event.stopPropagation();">
    <input type="text" class="edit-input-name" style="padding: 2px 4px; font-size: 11px; font-weight: bold; border: 1.5px solid #000; width: 100%; box-sizing: border-box;">
    ${esTarjetaTurnos ? `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;"><input type="time" class="edit-input-inicio" value="${opc.horaInicio || "00:00"}" style="padding: 1px 2px; font-size: 10px; font-weight: bold; border: 1.5px solid #000;"><input type="time" class="edit-input-fin" value="${opc.horaFin || "00:00"}" style="padding: 1px 2px; font-size: 10px; font-weight: bold; border: 1.5px solid #000;"></div><input type="number" step="0.01" class="edit-input-horas" value="${opc.totalHoras || 0}" style="padding: 2px 4px; font-size: 10px; font-weight: bold; border: 1.5px solid #000; width: 100%; box-sizing: border-box;">` : ""}
    
    <!-- FIX: Añadido el div de error que faltaba en el DOM dinámico -->
    <div class="error-msg-edit" style="display:none; color:#cc0000; font-size:10px; font-weight:bold; margin-top:2px;">⚠️ Nombre duplicado</div>

    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 4px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
            <div class="color-presets-wrapper"><div class="color-box-preset" data-color="#a3e635" style="background-color: #a3e635;"></div><div class="color-box-preset" data-color="#f472b6" style="background-color: #f472b6;"></div><div class="color-box-preset" data-color="#38bdf8" style="background-color: #38bdf8;"></div></div>
            <input type="color" class="edit-input-color" value="${opc.color || "#a3e635"}" style="width: 20px; height: 16px; border: 1px solid #000; padding: 0; cursor: pointer;">
        </div>
        <div style="display: flex; justify-content: space-between; gap: 8px; margin-top: 4px;">
            <button class="btn-delete-item-edit" style="background:#ffcccc; border: 1.5px solid #cc0000; color:#cc0000; font-size: 9px; font-weight: bold; padding: 1px 6px; cursor: pointer;">Eliminar</button>
            <div style="display:flex; gap: 4px;">
                <button class="btn-cancel-edit-item" style="background:#e2e8f0; border: 1.5px solid #000; font-size: 9px; font-weight: bold; padding: 1px 6px; cursor: pointer;">SALIR</button>
                <button class="btn-save-edit-item" style="background:#ffff00; border: 1.5px solid #000; font-size: 9px; font-weight: bold; padding: 1px 6px; cursor: pointer; box-shadow: 1px 1px 0px #000;">OK</button>
            </div>
        </div>
    </div>
  </div>`;
      item.querySelector(".edit-input-name").value = opc.valor;
      item.querySelectorAll(".color-box-preset").forEach((box) => {
        box.onclick = () => {
          item.querySelector(".edit-input-color").value =
            box.getAttribute("data-color");
        };
      });
      item.querySelector(".btn-cancel-edit-item").onclick = (e) => {
        e.stopPropagation();
        idElementoEnEdicion = null;
        activarEscuchadorCategorias();
      };
      item.querySelector(".btn-delete-item-edit").onclick = (e) => {
        e.stopPropagation();
        eliminarElemento(id, opc.id);
      };
      // ... dentro de tu bloque donde creas el modo edición (idElementoEnEdicion === claveEdicionUnica) ...

      item.querySelector(".btn-save-edit-item").onclick = async (e) => {
        e.stopPropagation();
        const nuevoNombre = item.querySelector(".edit-input-name").value.trim();

        // Validamos que el nombre no esté vacío
        if (!nuevoNombre) return;

        // --- LÓGICA DE VALIDACIÓN PARA EDICIÓN ---
        // Buscamos si existe OTRO elemento con el mismo nombre,
        // pero que NO sea el que estamos editando actualmente (o.id !== opc.id)
        const existe = (categoria.opciones || []).some(
          (o) =>
            o.valor.toLowerCase() === nuevoNombre.toLowerCase() &&
            o.id !== opc.id,
        );

        // Asegúrate de tener este elemento en el HTML del modo edición
        const errorDiv = item.querySelector(".error-msg-edit");

        if (existe) {
          // Visualizamos el error si el nombre está duplicado
          if (errorDiv) errorDiv.style.display = "block";
          item.querySelector(".edit-input-name").style.border =
            "1.5px solid #cc0000";
          return; // Detenemos la ejecución aquí
        }
        // -----------------------------------------------

        // Si llega aquí, la validación pasó. Recuperamos los datos actualizados.
        const nuevoColor = item.querySelector(".edit-input-color").value;
        let datosActualizados = {
          ...opc,
          valor: nuevoNombre,
          color: nuevoColor,
        };

        // Si la tarjeta es de turnos, capturamos los nuevos valores
        if (esTarjetaTurnos) {
          datosActualizados.horaInicio =
            item.querySelector(".edit-input-inicio").value || "00:00";
          datosActualizados.horaFin =
            item.querySelector(".edit-input-fin").value || "00:00";
          datosActualizados.totalHoras =
            parseFloat(item.querySelector(".edit-input-horas").value) || 0;
        }

        // Cerramos el modo edición y guardamos en Firebase
        idElementoEnEdicion = null;
        await guardarCambiosElemento(id, opc.id, datosActualizados);
      };
    } else {
      let detallesHorario =
        esTarjetaTurnos && opc.horaInicio
          ? `<div style="font-size: 9px; opacity: 0.85; font-weight: normal; margin-top: 1px;">🕒 ${opc.horaInicio} a ${opc.horaFin} (${opc.totalHoras}h)</div>`
          : "";
      item.innerHTML = `<div class="clickable-content" style="display: flex; justify-content: space-between; width: 100%; align-items: center; cursor: pointer;" title="Haz clic para modificar"><div style="display: flex; flex-direction: column; width: 100%; overflow: hidden;"><span class="element-text-content" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; font-size: 11px;"></span>${detallesHorario}</div></div>`;
      item.querySelector(".element-text-content").textContent = opc.valor;
      item.querySelector(".clickable-content").onclick = () => {
        idElementoEnEdicion = claveEdicionUnica;
        activarEscuchadorCategorias();
      };
    }
    listContainer.appendChild(item);
  });

  const footerActions = card.querySelector(".control-footer-row");
  const trigger = card.querySelector(".add-element-trigger");
  const form = card.querySelector(".inline-form-add");
  const btnCancel = card.querySelector(".btn-cancel-element");
  const btnSave = card.querySelector(".btn-save-element");
  const inputName = card.querySelector(".input-element-name");
  const inputColor = card.querySelector(".input-element-color");
  trigger.onclick = () => {
    form.style.display = "flex";
    footerActions.style.display = "none";
    inputName.focus();
  };
  btnCancel.onclick = () => {
    form.style.display = "none";
    footerActions.style.display = "flex";
    inputName.value = "";
  };

  btnSave.onclick = async () => {
    const valorLimpio = inputName.value.trim();
    // Seleccionamos el div de error que acabamos de añadir al HTML
    const errorDiv = card.querySelector(`#error-duplicado-${id}`);

    if (!valorLimpio) return;

    const existe = (categoria.opciones || []).some(
      (o) => o.valor.toLowerCase() === valorLimpio.toLowerCase(),
    );

    // --- LÓGICA DE VALIDACIÓN SIN ALERT ---
    if (existe) {
      inputName.style.border = "1.5px solid #cc0000";
      inputName.style.backgroundColor = "#fff0f0";

      // Mostramos el mensaje visual en lugar del alert
      if (errorDiv) errorDiv.style.display = "block";

      return; // Detenemos aquí
    }

    // Si no existe, reseteamos estilos y ocultamos el error
    inputName.style.border = "1.5px solid #000";
    inputName.style.backgroundColor = "#fff";
    if (errorDiv) errorDiv.style.display = "none";
    // --------------------------------------

    const colorFinal = inputColor.value;
    const prefijoPadre = id.substring(0, 2);
    const sufijo = Math.random().toString(36).substr(2, 9);
    const idElementoBase = valorLimpio.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const idNuevoElemento = esTarjetaTurnos
      ? `${prefijoPadre}E_${idElementoBase}`
      : `${prefijoPadre}E_${sufijo}`;

    let datosElemento = {
      id: idNuevoElemento,
      valor: valorLimpio,
      color: colorFinal,
    };

    if (esTarjetaTurnos) {
      datosElemento.horaInicio =
        card.querySelector(".input-turno-inicio").value || "00:00";
      datosElemento.horaFin =
        card.querySelector(".input-turno-fin").value || "00:00";
      datosElemento.totalHoras =
        parseFloat(card.querySelector(".input-turno-horas").value) || 0;
    }

    try {
      const docRef = doc(db, "usuarios", USUARIO_ID, "categorias", id);
      const docSnap = await getDoc(docRef);
      const opcionesActuales = docSnap.exists()
        ? docSnap.data().opciones || []
        : [];

      const opcionesActualizadas = [...opcionesActuales, datosElemento];
      await updateDoc(docRef, { opciones: opcionesActualizadas });

      form.style.display = "none";
      footerActions.style.display = "flex";
      inputName.value = "";
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };
  if (esContarDinámico) {
    const chkMultiple = card.querySelector(".check-toggle-multiple");
    if (chkMultiple) {
      chkMultiple.onchange = async () => {
        try {
          await updateDoc(doc(db, "usuarios", USUARIO_ID, "categorias", id), {
            seleccionMultiple: chkMultiple.checked,
          });
        } catch (e) {
          console.error(e);
        }
      };
    }
    card.querySelector(".btn-delete-card").onclick = () =>
      eliminarCategoria(id);
  }
  return card;
}

function crearTarjetaFormulaDOM(id, dataFormula, opcionesDisponibles) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.borderColor = "#605ca8";
  const subElementosAsociados = dataFormula.componentes || [];
  const estaAbierta = idFormulaEnEdicion === id;
  card.innerHTML = `
        <div style="margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;"><h2 class="formula-card-title" style="margin: 0; color:#605ca8; font-size:13px;"></h2></div>
        <div class="elements-list"></div>
        <div class="control-footer-row-formula" style="display: ${estaAbierta ? "none" : "flex"}; justify-content: flex-end; align-items: center; margin-top: 10px; padding: 2px 0;"><div class="toggle-editor-trigger" style="cursor: pointer; font-weight: bold; color: #605ca8; font-size: 11px; text-decoration: underline; user-select:none;">Configurar 🛠️</div></div>
        <div class="inline-editor-formula" style="display: ${estaAbierta ? "flex" : "none"}; flex-direction: column; gap: 6px; border: 1.5px dashed #605ca8; padding: 8px; margin-top: 8px; background: #fbfaff;"><div style="display:flex; flex-direction:column; gap:2px;"><select class="select-variable-formula" style="padding:4px; border:1.5px solid #000; font-weight:bold; font-size:11px; background:#fff; width:100%;">${opcionesDisponibles.map((o) => `<option value="${o.id}">${o.nombre}</option>`).join("")}</select></div><div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;"><input type="number" step="any" class="input-numero-formula" placeholder="Número fijo (opcional)..." style="padding:4px; border:1.5px solid #000; font-weight:bold; font-size:11px; background:#fff; width:100%; box-sizing:border-box;"></div><div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:4px; margin-top:4px;"><button class="btn-add-pieza-formula" data-signo="+" style="background:#e2f7ed; border:1.5px solid #000; font-weight:bold; cursor:pointer; padding:4px; font-size:11px;">+</button><button class="btn-add-pieza-formula" data-signo="-" style="background:#fce8e6; border:1.5px solid #000; font-weight:bold; cursor:pointer; padding:4px; font-size:11px;">-</button><button class="btn-add-pieza-formula" data-signo="*" style="background:#fff9db; border:1.5px solid #000; font-weight:bold; cursor:pointer; padding:4px; font-size:11px;">×</button><button class="btn-add-pieza-formula" data-signo="/" style="background:#e3fafc; border:1.5px solid #000; font-weight:bold; cursor:pointer; padding:4px; font-size:11px;">÷</button></div><button class="btn-cerrar-editor-formula" style="background:#e2e8f0; border:1.5px solid #000; font-weight:bold; font-size:10px; padding:3px; margin-top:4px; cursor:pointer; width:100%;">Cerrar Editor</button></div>
        <div class="btn-delete-card" style="margin-top:10px;">× Eliminar Fórmula</div>
    `;
  card.querySelector(".formula-card-title").textContent =
    `🧮 ${dataFormula.nombre || "Fórmula sin nombre"}`;
  const listContainer = card.querySelector(".elements-list");
  subElementosAsociados.forEach((itemPieza, index) => {
    const itemRow = document.createElement("div");
    itemRow.className = "element-item";
    itemRow.style.color = "#000000";
    itemRow.style.border = "1.5px solid #000";
    if (itemPieza.signo === "+") itemRow.style.backgroundColor = "#e2f7ed";
    else if (itemPieza.signo === "-") itemRow.style.backgroundColor = "#fce8e6";
    else if (itemPieza.signo === "*") itemRow.style.backgroundColor = "#fff9db";
    else if (itemPieza.signo === "/") itemRow.style.backgroundColor = "#e3fafc";
    itemRow.innerHTML = `<div style="display:flex; align-items:center; gap:6px; max-width: 85%;"><span style="font-weight:bold; font-size:12px;">${itemPieza.signo === "*" ? "×" : itemPieza.signo === "/" ? "÷" : itemPieza.signo}</span><span class="formula-piece-name" style="font-size:11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></span></div><span class="btn-quitar-pieza" style="cursor:pointer; font-weight:bold; color:#cc0000; font-size:12px;">×</span>`;
    const pieceContainer = itemRow.querySelector(".formula-piece-name");
    if (itemPieza.esNumeroFijo)
      pieceContainer.textContent = `Fijo: ${itemPieza.valorFijo}`;
    else {
      const metaInfo = opcionesDisponibles.find(
        (o) => o.id === itemPieza.variableId,
      );
      pieceContainer.textContent = metaInfo
        ? metaInfo.nombre
        : itemPieza.variableId;
    }
    itemRow.querySelector(".btn-quitar-pieza").onclick = async () => {
      await updateDoc(doc(db, "usuarios", USUARIO_ID, "categorias", id), {
        componentes: subElementosAsociados.filter((_, idx) => idx !== index),
      });
    };
    listContainer.appendChild(itemRow);
  });
  card.querySelector(".toggle-editor-trigger").onclick = () => {
    idFormulaEnEdicion = id;
    card.querySelector(".inline-editor-formula").style.display = "flex";
    card.querySelector(".control-footer-row-formula").style.display = "none";
  };
  card.querySelector(".btn-cerrar-editor-formula").onclick = () => {
    idFormulaEnEdicion = null;
    card.querySelector(".inline-editor-formula").style.display = "none";
    card.querySelector(".control-footer-row-formula").style.display = "flex";
  };
  card.querySelectorAll(".btn-add-pieza-formula").forEach((btn) => {
    btn.onclick = async () => {
      const signo = btn.getAttribute("data-signo");
      const inputNum = card.querySelector(".input-numero-formula");
      const valorManual = inputNum.value.trim();
      const variableSeleccionada = card.querySelector(
        ".select-variable-formula",
      ).value;
      let nuevaPieza =
        valorManual !== ""
          ? {
              signo: signo,
              esNumeroFijo: true,
              valorFijo: parseFloat(valorManual),
            }
          : {
              signo: signo,
              esNumeroFijo: false,
              variableId: variableSeleccionada,
            };
      if (isNaN(nuevaPieza.valorFijo) && nuevaPieza.esNumeroFijo) return;
      if (!nuevaPieza.variableId && !nuevaPieza.esNumeroFijo) return;
      await updateDoc(doc(db, "usuarios", USUARIO_ID, "categorias", id), {
        componentes: [...subElementosAsociados, nuevaPieza],
      });
      inputNum.value = "";
    };
  });
  card.querySelector(".btn-delete-card").onclick = () => eliminarCategoria(id);
  return card;
}

async function guardarCambiosElemento(
  categoriaId,
  elementoId,
  nuevosDatosElemento,
) {
  const docRef = doc(db, "usuarios", USUARIO_ID, "categorias", categoriaId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const opciones = docSnap.data().opciones || [];
      await updateDoc(docRef, {
        opciones: opciones.map((opc) =>
          opc.id === elementoId ? nuevosDatosElemento : opc,
        ),
      });
    }
  } catch (e) {
    console.error("Error al editar elemento:", e);
  }
}

window.crearNuevaCategoriaContar = async function (inputId) {
  const input = document.getElementById(inputId);
  const nombreLimpio = input.value.trim();
  if (!nombreLimpio) return;
  const slug = nombreLimpio
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");
  try {
    await setDoc(doc(db, "usuarios", USUARIO_ID, "categorias", `C_${slug}`), {
      nombre: nombreLimpio,
      seleccionMultiple: false,
      opciones: [],
    });
    input.value = "";
  } catch (e) {
    alert("Error: " + e.message);
  }
};

window.crearNuevaFormula = async function (inputId) {
  const input = document.getElementById(inputId);
  const nombreLimpio = input.value.trim();
  if (!nombreLimpio) return;
  const slug = nombreLimpio
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");
  try {
    await setDoc(doc(db, "usuarios", USUARIO_ID, "categorias", `F_E_${slug}`), {
      nombre: nombreLimpio,
      componentes: [],
    });
    input.value = "";
  } catch (e) {
    alert("Error: " + e.message);
  }
};

async function eliminarElemento(categoriaId, elementoId) {
  const docRef = doc(db, "usuarios", USUARIO_ID, "categorias", categoriaId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists())
      await updateDoc(docRef, {
        opciones: (docSnap.data().opciones || []).filter(
          (opc) => opc.id !== elementoId,
        ),
      });
  } catch (e) {
    console.error(e);
  }
}

async function eliminarCategoria(categoriaId) {
  if (confirm("¿Seguro que quieres eliminar esta categoría?")) {
    try {
      await deleteDoc(
        doc(db, "usuarios", USUARIO_ID, "categorias", categoriaId),
      );
    } catch (e) {
      console.error(e);
    }
  }
}

function isColorLight(colorHex) {
  const hex = colorHex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}
