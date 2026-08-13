// JS/totales.js

// --- ESTA FUNCIÓN DEVUELVE EL MAPA PLANO PARA FIREBASE ---
export function calcularTotales(datosMesActual, categoriesConfig, fechaActual = new Date()) {
    if (!categoriesConfig || Object.keys(categoriesConfig).length === 0) return null;

    const mapaTotalesConsolidados = {};

    // --------------------------------------------------------------------------
    // CAMBIO 1: Calcular días totales del mes y asignarlo a C_E_DiasMes
    // --------------------------------------------------------------------------
    const diasMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
    mapaTotalesConsolidados["C_E_DiasMes"] = diasMes;

    // 1. Inicialización en plano
    Object.keys(categoriesConfig).forEach((catId) => {
        const cat = categoriesConfig[catId];
        if (!cat) return;
        
        // Inicializamos a 0 todas las opciones de complementos y categorías normales
        if (catId === "S_complementos") {
            (cat.opciones || []).forEach((o) => (mapaTotalesConsolidados[o.id] = 0));
        } else if (!catId.startsWith("F_E_")) {
            (cat.opciones || []).forEach((o) => (mapaTotalesConsolidados[o.id] = 0));
        }
    });

    // 2. Procesamiento de los datos del mes (evitamos contar claves de sistema o 'valoresTotales')
    Object.entries(datosMesActual).forEach(([diaId, datosDia]) => {
        if (!datosDia || diaId === "valoresTotales" || diaId === "C_sistema") return;
        
        Object.keys(datosDia).forEach((catId) => {
            if (catId === "S_complementos") {
                Object.entries(datosDia["S_complementos"] || {}).forEach(([opcId, val]) => {
                    if (mapaTotalesConsolidados[opcId] !== undefined) {
                        mapaTotalesConsolidados[opcId] += Number(val || 0);
                    }
                });
            } else if (catId !== "comentario" && !catId.startsWith("F_E_") && catId !== "C_sistema") {
                const val = datosDia[catId];
                if (Array.isArray(val)) {
                    val.forEach(id => { 
                        if (mapaTotalesConsolidados[id] !== undefined) mapaTotalesConsolidados[id]++;
                    });
                } else {
                    if (mapaTotalesConsolidados[val] !== undefined) mapaTotalesConsolidados[val]++;
                }
            }
        });
    });

    // 3. Preparar variables para cálculos de fórmulas
    // Clonamos los acumulados actuales mayores que 0 como variables de entorno
    const scopeVariables = {};
    Object.entries(mapaTotalesConsolidados).forEach(([id, val]) => {
        if (val > 0) scopeVariables[id] = val;
    });

    // 4. Ejecución de fórmulas y añadirlas al mapa plano
    Object.keys(categoriesConfig).forEach((catId) => {
        if (catId.startsWith("F_E_")) {
            const fConf = categoriesConfig[catId];
            let expr = "";
            fConf.componentes.forEach((c) => {
                const val = c.esNumeroFijo ? c.valorFijo : (scopeVariables[c.variableId] || 0);
                expr += ` ${c.signo || ""} ${val} `;
            });

            try {
                // CORRECCIÓN DE SEGURIDAD: Validar que la expresión SOLO contenga números, operadores, puntos y espacios
                if (/^[0-9.+\-*/()\s]+$/.test(expr) || expr.trim() === "") {
                    const res = new Function(`return (${expr || 0});`)();
                    mapaTotalesConsolidados[catId] = Math.round(res * 100) / 100;
                    
                    // Actualizamos las variables por si otra fórmula depende de esta
                    scopeVariables[catId] = mapaTotalesConsolidados[catId];
                } else {
                    console.warn(`[Seguridad] Expresión bloqueada por caracteres no válidos en: ${catId}`, expr);
                    mapaTotalesConsolidados[catId] = 0;
                }
            } catch (e) {
                console.error("Error al calcular fórmula: ", catId, e);
                mapaTotalesConsolidados[catId] = 0;
            }
        }
    });

    // 5. Limpieza de ceros:
    // --------------------------------------------------------------------------
    // CAMBIO 2: Evitar que C_E_DiasMes se borre aunque valga 0 o no coincida
    // --------------------------------------------------------------------------
    Object.keys(mapaTotalesConsolidados).forEach((key) => {
        if (mapaTotalesConsolidados[key] === 0 && key !== "C_E_DiasMes") {
            delete mapaTotalesConsolidados[key];
        }
    });

    return mapaTotalesConsolidados; // Devuelve { "C_E_DiasMes": 31, "C_E_laborable": 21, ... }
}

// --- ESTA FUNCIÓN SE ENCARGA SÓLO DE MAQUETAR EL HTML ---
export function renderizarTotales(datosMesActual, categoriesConfig, fechaActual = new Date()) {
    const contenedorTotales = document.getElementById("totals-grid");
    if (!contenedorTotales) return;
    
    if (!categoriesConfig || Object.keys(categoriesConfig).length === 0) {
        contenedorTotales.innerHTML = `<p class="no-data-text">Configurando categorías...</p>`;
        return;
    }

    const totales = calcularTotales(datosMesActual, categoriesConfig, fechaActual);
    if (!totales) {
        contenedorTotales.innerHTML = `<p class="no-data-text">No hay datos.</p>`;
        return;
    }

    let html = "";

    // Pintar categorías estándar
    Object.keys(categoriesConfig).forEach((catId) => {
        if (catId === "S_complementos" || catId === "C_sistema" || catId.startsWith("F_E_")) return;
        const cat = categoriesConfig[catId];
        let items = "";
        cat.opciones.forEach(o => { 
            const cantidad = totales[o.id] || 0;
            if (cantidad > 0) {
                items += `<div class="total-row-item"><span class="total-badge" style="background:${o.color}"></span>${o.valor}: <strong>${cantidad}</strong></div>`;
            }
        });
        if (items) html += `<div class="total-card-block"><h4>${cat.nombre}</h4>${items}</div>`;
    });

    // Pintar complementos
    if (categoriesConfig["S_complementos"]) {
        let items = "";
        categoriesConfig["S_complementos"].opciones.forEach(o => { 
            const cantidad = totales[o.id] || 0;
            if (cantidad > 0) {
                items += `<div class="total-row-item">${o.valor}: <strong>${cantidad}</strong></div>`;
            }
        });
        if (items) html += `<div class="total-card-block"><h4>Complementos</h4>${items}</div>`;
    }

    // Pintar fórmulas
    let fItems = "";
    Object.keys(categoriesConfig).forEach((catId) => {
        if (catId.startsWith("F_E_") && totales[catId] !== undefined) {
            const fConf = categoriesConfig[catId];
            fItems += `<div class="total-row-item">⚡ ${fConf.nombre}: <strong>${totales[catId]}</strong></div>`;
        }
    });
    if (fItems) {
        html += `<div class="total-card-block"><h4>🧮 Fórmulas</h4>${fItems}</div>`;
    }

    contenedorTotales.innerHTML = html || `<p class="no-data-text">No hay datos.</p>`;
}