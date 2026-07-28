export function mostrarConfirmacionCustom(mensaje, titulo = "⚠️ CONFIRMACIÓN CRÍTICA") {
  return new Promise((resolve) => {
    let modal = document.getElementById("custom-confirm-modal");

    // Si el HTML del modal no existe en la página, lo inyecta dinámicamente
    if (!modal) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
        <div id="custom-confirm-modal" class="modal-backdrop hidden">
          <div class="modal-brutal-box">
            <div id="custom-confirm-header" class="modal-brutal-header">${titulo}</div>
            <div class="modal-brutal-body">
              <p id="custom-confirm-message"></p>
            </div>
            <div class="modal-brutal-actions">
              <button id="btn-confirm-cancel" class="btn-modal-brutal cancel">CANCELAR</button>
              <button id="btn-confirm-accept" class="btn-modal-brutal accept">ACEPTAR</button>
            </div>
          </div>
        </div>
      `
      );
      modal = document.getElementById("custom-confirm-modal");
    }

    const headerElem = document.getElementById("custom-confirm-header");
    const msgElem = document.getElementById("custom-confirm-message");
    const btnAceptar = document.getElementById("btn-confirm-accept");
    const btnCancelar = document.getElementById("btn-confirm-cancel");

    if (headerElem) headerElem.textContent = titulo;
    if (msgElem) msgElem.textContent = mensaje;

    modal.classList.remove("hidden");

    const finaliza = (resultado) => {
      modal.classList.add("hidden");
      btnAceptar.removeEventListener("click", alAceptar);
      btnCancelar.removeEventListener("click", alCancelar);
      resolve(resultado);
    };

    const alAceptar = () => finaliza(true);
    const alCancelar = () => finaliza(false);

    btnAceptar.addEventListener("click", alAceptar);
    btnCancelar.addEventListener("click", alCancelar);
  });
}