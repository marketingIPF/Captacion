/* ==========================================================================
   RK Palanca · WebApp Captación · App logic
   ========================================================================== */

const STORAGE_KEY = "rkp_captacion_v1";
const DEFAULT_EMAIL_TO = "julia@inmobiliariapalanca.com";

// ---------- ESTADO ----------
let state = loadState() || {
  propietarios: [{}],
  fields: {},
  chips: {},
  checks: {},
  firmas: {}     // { agente: dataURL, propietario_1: dataURL, propietario_2: dataURL }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("No se pudo cargar el estado:", e);
    return null;
  }
}

let saveTimer;
function saveState() {
  showStatus("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showStatus("saved");
    } catch (e) {
      console.error("No se pudo guardar el estado:", e);
      showStatus("error");
    }
  }, 200);
}

function showStatus(kind) {
  const el = document.getElementById("saveStatus");
  if (!el) return;
  el.classList.remove("saving");
  if (kind === "saving") {
    el.classList.add("saving");
    el.querySelector(".label").textContent = "Guardando…";
  } else if (kind === "saved") {
    el.querySelector(".label").textContent = "Guardado";
  } else if (kind === "error") {
    el.querySelector(".label").textContent = "Error";
  }
}

// ---------- POBLAR LISTAS ----------
function populateAgentes() {
  const sel = document.getElementById("agente");
  for (const a of window.AGENTS) {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = `${a.name} · ${a.role}`;
    o.dataset.email = a.email;
    o.dataset.phone = a.phone;
    o.dataset.name = a.name;
    sel.appendChild(o);
  }
}

function populateTiposChips() {
  const wrap = document.getElementById("tipo-group");
  for (const t of window.TIPOS_INMUEBLE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.name = "tipo";
    b.dataset.value = t;
    b.textContent = t;
    wrap.appendChild(b);
  }
}

// ---------- ACCORDION ----------
document.querySelectorAll(".section-header").forEach(h => {
  h.addEventListener("click", (e) => {
    const sec = h.parentElement;
    sec.classList.toggle("open");
  });
});

// ---------- CHIP GROUPS ----------
function bindChip(btn) {
  btn.addEventListener("click", () => {
    const name = btn.dataset.name;
    const val = btn.dataset.value;
    const group = btn.parentElement;
    const wasActive = btn.getAttribute("aria-pressed") === "true";
    // Single-select: toggle off others
    group.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", "false"));
    if (!wasActive) {
      btn.setAttribute("aria-pressed", "true");
      state.chips[name] = val;
    } else {
      delete state.chips[name];
    }
    saveState();
    updateSectionMeta();
    handleSpecialChips(name, state.chips[name]);
  });
}

function handleSpecialChips(name, value) {
  if (name === "operacion") {
    document.getElementById("precioSuffix").textContent = value === "Alquiler" ? "€/mes" : "€";
  }
  if (name === "tipo") {
    const isChalet = /chalet|adosado|pareado|casa/i.test(value || "");
    document.getElementById("chaletBlock").style.display = isChalet ? "" : "none";
  }
}

// ---------- INPUTS / TEXT FIELDS ----------
function bindTextField(el) {
  const name = el.name || el.id;
  if (!name) return;
  el.addEventListener("input", () => {
    state.fields[name] = el.value;
    saveState();
    updateSectionMeta();
  });
}

// ---------- CHECKBOXES MULTIPLES ----------
function bindCheckGroup() {
  document.querySelectorAll('input[type="checkbox"][name]').forEach(cb => {
    if (cb.id === "rgpd_aceptado") {
      cb.addEventListener("change", () => {
        state.fields.rgpd_aceptado = cb.checked;
        saveState();
      });
      return;
    }
    cb.addEventListener("change", () => {
      const name = cb.name;
      state.checks[name] = state.checks[name] || [];
      if (cb.checked) {
        if (!state.checks[name].includes(cb.value)) state.checks[name].push(cb.value);
      } else {
        state.checks[name] = state.checks[name].filter(v => v !== cb.value);
      }
      saveState();
    });
  });
}

// ---------- PROPIETARIOS ----------
function renderPropietarios() {
  const list = document.getElementById("propietariosList");
  list.innerHTML = "";
  state.propietarios.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "propietario-card";
    card.innerHTML = `
      <div class="head">
        <h4>Propietario ${i + 1}</h4>
        ${state.propietarios.length > 1 ? `<button type="button" class="btn-link" data-remove="${i}">Eliminar</button>` : ""}
      </div>
      <div class="grid grid-2">
        <div class="field">
          <label class="field-label">Nombre y apellidos</label>
          <input type="text" data-prop-field="nombre" data-idx="${i}" value="${esc(p.nombre)}" autocomplete="name" />
        </div>
        <div class="field">
          <label class="field-label">DNI / NIF</label>
          <input type="text" data-prop-field="dni" data-idx="${i}" value="${esc(p.dni)}" autocomplete="off" />
        </div>
        <div class="field">
          <label class="field-label">Teléfono móvil${i === 0 ? ' <span class="required">*</span>' : ''}</label>
          <input type="tel" inputmode="numeric" data-prop-field="movil" data-idx="${i}" value="${esc(p.movil)}" autocomplete="tel" />
        </div>
        <div class="field">
          <label class="field-label">Teléfono fijo</label>
          <input type="tel" inputmode="numeric" data-prop-field="telefono" data-idx="${i}" value="${esc(p.telefono)}" />
        </div>
        <div class="field full-width">
          <label class="field-label">Email</label>
          <input type="email" data-prop-field="email" data-idx="${i}" value="${esc(p.email)}" autocomplete="email" />
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll("[data-prop-field]").forEach(input => {
    input.addEventListener("input", () => {
      const idx = +input.dataset.idx;
      const field = input.dataset.propField;
      state.propietarios[idx] = state.propietarios[idx] || {};
      state.propietarios[idx][field] = input.value;
      saveState();
      updateSectionMeta();
    });
  });
  list.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.remove;
      state.propietarios.splice(idx, 1);
      saveState();
      renderPropietarios();
      renderFirmas();
      updateSectionMeta();
    });
  });
}

function esc(v) { return (v == null ? "" : String(v)).replace(/"/g, "&quot;"); }

document.getElementById("addPropietario").addEventListener("click", () => {
  if (state.propietarios.length >= 4) return;
  state.propietarios.push({});
  saveState();
  renderPropietarios();
  renderFirmas();
});

// ---------- FIRMAS (canvas) ----------
function renderFirmas() {
  const wrap = document.getElementById("firmasContainer");
  wrap.innerHTML = "";

  const sigs = [];
  state.propietarios.forEach((p, i) => {
    const key = `propietario_${i + 1}`;
    sigs.push({
      key,
      label: `Firma ${state.propietarios.length === 1 ? "del propietario" : "del propietario " + (i + 1)}`,
      name: p.nombre || ""
    });
  });
  sigs.push({ key: "agente", label: "Firma del agente captador", name: getCurrentAgent()?.name || "" });

  for (const s of sigs) {
    const div = document.createElement("div");
    div.className = "firma-wrap";
    div.innerHTML = `
      <div class="head">
        <h4>${s.label}${s.name ? " · " + s.name : ""}</h4>
        <button type="button" class="btn-link" data-clear-firma="${s.key}">Borrar firma</button>
      </div>
      <div class="firma-canvas-box ${state.firmas[s.key] ? "signed" : ""}">
        <canvas data-firma="${s.key}"></canvas>
        <div class="placeholder">Firma aquí con el dedo</div>
      </div>
    `;
    wrap.appendChild(div);
  }

  wrap.querySelectorAll("canvas[data-firma]").forEach(setupSignaturePad);
  wrap.querySelectorAll("[data-clear-firma]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.clearFirma;
      delete state.firmas[key];
      saveState();
      renderFirmas();
    });
  });
}

function setupSignaturePad(canvas) {
  const key = canvas.dataset.firma;
  const box = canvas.parentElement;
  const ctx = canvas.getContext("2d");

  // tamaño físico responsive
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";

    // restaurar imagen previa
    if (state.firmas[key]) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, r.width, r.height); box.classList.add("signed"); };
      img.src = state.firmas[key];
    } else {
      box.classList.remove("signed");
    }
  }
  resize();
  window.addEventListener("resize", resize);

  let drawing = false;
  let lastX = 0, lastY = 0;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x, y };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const { x, y } = pos(e);
    lastX = x; lastY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x; lastY = y;
  }
  function end(e) {
    if (!drawing) return;
    drawing = false;
    box.classList.add("signed");
    // guardar como dataURL (PNG redimensionado para no inflar el localStorage)
    state.firmas[key] = canvas.toDataURL("image/png");
    saveState();
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
  canvas.addEventListener("touchcancel", end);
}

function getCurrentAgent() {
  const id = state.fields.agente;
  return window.AGENTS.find(a => a.id === id);
}

// ---------- META POR SECCIÓN ----------
function updateSectionMeta() {
  // 0 - agente + operación + tipo
  const a = getCurrentAgent();
  const op = state.chips.operacion;
  const tipo = state.chips.tipo;
  setMeta(0, [a?.name?.split(" ")[0], op, tipo].filter(Boolean).join(" · "));

  // 1 - propietarios
  const propsWithName = state.propietarios.filter(p => p.nombre).length;
  setMeta(1, propsWithName ? `${propsWithName} propietario${propsWithName > 1 ? "s" : ""}` : "");

  // 2 - ubicación
  setMeta(2, state.fields.poblacion || "");

  // 3 - economía
  setMeta(3, state.fields.precio ? formatNumber(state.fields.precio) + " €" : "");

  // 4 - distribución
  const sup = state.fields.m2_construidos;
  const dorm = state.fields.dormitorios;
  setMeta(4, [sup && sup + " m²", dorm && dorm + " dorm."].filter(Boolean).join(" · "));
}

function setMeta(idx, text) {
  const el = document.getElementById("meta-" + idx);
  if (el) el.textContent = text || "";
}

function formatNumber(v) {
  const n = parseInt(String(v).replace(/\D/g, ""), 10);
  if (isNaN(n)) return v;
  return n.toLocaleString("es-ES");
}

// ---------- RESTAURAR FORMULARIO ----------
function restoreForm() {
  // Inputs / selects / textareas (no checkboxes ni chips)
  Object.entries(state.fields || {}).forEach(([name, val]) => {
    const el = document.querySelector(`[name="${name}"], #${name}`);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  });

  // Chips
  Object.entries(state.chips || {}).forEach(([name, val]) => {
    const btn = document.querySelector(`.chip[data-name="${name}"][data-value="${CSS.escape(val)}"]`);
    if (btn) btn.setAttribute("aria-pressed", "true");
    handleSpecialChips(name, val);
  });

  // Checkbox multi
  Object.entries(state.checks || {}).forEach(([name, arr]) => {
    arr.forEach(v => {
      const cb = document.querySelector(`input[type="checkbox"][name="${name}"][value="${CSS.escape(v)}"]`);
      if (cb) cb.checked = true;
    });
  });

  // Chalet block visibility
  handleSpecialChips("tipo", state.chips.tipo);
  handleSpecialChips("operacion", state.chips.operacion);
}

// ---------- VALIDACIÓN ----------
function validate() {
  const errors = [];
  if (!state.fields.agente) errors.push("Selecciona el agente captador.");
  if (!state.chips.operacion) errors.push("Selecciona el tipo de operación (Venta o Alquiler).");
  if (!state.chips.tipo) errors.push("Selecciona el tipo de inmueble.");
  const movil = (state.propietarios[0] || {}).movil;
  if (!movil) errors.push("Indica el teléfono móvil del propietario principal.");
  return errors;
}

// ---------- GENERACIÓN EMAIL ----------
function generateEmail() {
  const a = getCurrentAgent();
  const ref = state.fields.ref || "(sin ref)";
  const pob = state.fields.poblacion || "(sin población)";
  const subject = `Prospecto · Ref. ${ref} · ${pob}`;

  // ---- Cuerpo "humano" ----
  const lines = [];
  const push = (t = "") => lines.push(t);

  push("FICHA DE CAPTACIÓN — RK PALANCA FONTESTAD");
  push("══════════════════════════════════════════");
  push("");
  push("◆ AGENTE E IDENTIFICACIÓN");
  push(`  Agente captador : ${a ? a.name + " (Id " + a.id + ")" : "(sin asignar)"}`);
  push(`  Email agente    : ${a ? a.email : "-"}`);
  push(`  Prospecto       : ${state.fields.prospecto || "-"}`);
  push(`  Referencia      : ${state.fields.ref || "-"}`);
  push(`  Fecha visita    : ${state.fields.fecha || hoy()}`);
  push(`  Operación       : ${state.chips.operacion || "-"}`);
  push(`  Tipo inmueble   : ${state.chips.tipo || "-"}`);
  push("");

  push("◆ PROPIETARIOS");
  state.propietarios.forEach((p, i) => {
    if (!p.nombre && !p.movil && !p.email) return;
    push(`  · Propietario ${i + 1}`);
    push(`     Nombre  : ${p.nombre || "-"}`);
    push(`     DNI/NIF : ${p.dni || "-"}`);
    push(`     Móvil   : ${p.movil || "-"}`);
    push(`     Fijo    : ${p.telefono || "-"}`);
    push(`     Email   : ${p.email || "-"}`);
  });
  push("");

  push("◆ UBICACIÓN");
  push(`  Dirección : ${state.fields.direccion || "-"}`);
  push(`  Nº / Pl. / Pta : ${state.fields.numero || "-"} / ${state.fields.planta || "-"} / ${state.fields.puerta || "-"}`);
  push(`  Población : ${state.fields.poblacion || "-"}`);
  push(`  C.P.      : ${state.fields.cp || "-"}`);
  push(`  Provincia : ${state.fields.provincia || "-"}`);
  push(`  Suelo     : ${state.chips.suelo || "-"}`);
  push(`  Cert. energético : ${state.chips.cee || "-"}`);
  push(`  Autorización venta : ${state.chips.autorizacion || "-"}`);
  push(`  Documentación : ${joinCheck("doc")}`);
  if (isChaletType()) {
    push(`  [Chalet] Agua : ${state.chips.agua || "-"}`);
    push(`  [Chalet] Acceso asfaltado : ${state.chips.acceso || "-"}`);
  }
  push("");

  push("◆ ECONÓMICOS");
  push(`  Precio solicitado : ${fmtMoney(state.fields.precio)} ${state.chips.operacion === "Alquiler" ? "€/mes" : "€"}`);
  push(`  Precio mínimo     : ${fmtMoney(state.fields.precio_minimo)} €`);
  push(`  Gastos comunidad  : ${fmtMoney(state.fields.comunidad)} €/mes`);
  push(`  IBI               : ${fmtMoney(state.fields.ibi)} €/año`);
  push(`  Derrama aprobada  : ${state.chips.derrama || "-"} ${state.fields.derrama_importe ? "(" + fmtMoney(state.fields.derrama_importe) + " €)" : ""}`);
  push(`  VPO               : ${state.chips.vpo || "-"} ${state.fields.vpo_expediente ? "(Exp. " + state.fields.vpo_expediente + ")" : ""}`);
  push("");

  push("◆ DISTRIBUCIÓN Y SUPERFICIES");
  push(`  M² construidos : ${state.fields.m2_construidos || "-"}`);
  push(`  M² útiles      : ${state.fields.m2_utiles || "-"}`);
  push(`  M² parcela     : ${state.fields.m2_parcela || "-"}`);
  push(`  M² terraza     : ${state.fields.m2_terraza || "-"}`);
  push(`  Año construc.  : ${state.fields.anyo || "-"}`);
  push(`  Alturas edif.  : ${state.fields.alturas || "-"}`);
  push(`  Dorm./Baños/Aseos : ${state.fields.dormitorios || "-"} / ${state.fields.banos || "-"} / ${state.fields.aseos || "-"}`);
  push(`  Salón / Cocina : ${state.fields.salon_m2 || "-"} m² / ${state.fields.cocina_m2 || "-"} m²`);
  push(`  Equipamiento   : ${joinCheck("anexos")}`);
  push(`  Garajes / Trast. / Pisc. : ${state.fields.num_garajes || "-"} / ${state.fields.num_trasteros || "-"} / ${state.fields.num_piscinas || "-"}`);
  push("");

  push("◆ CALIDADES");
  push(`  Ventanas       : ${joinCheck("ventanas_material")}`);
  push(`  Apertura       : ${joinCheck("ventanas_apertura")}`);
  push(`  Puertas        : ${joinCheck("puertas")}`);
  push(`  Suelos         : ${joinCheck("suelos")}`);
  push(`  Cocina         : ${state.chips.cocina_tipo || "-"}`);
  push(`  Fuegos         : ${joinCheck("fuegos")}`);
  push(`  Agua caliente  : ${joinCheck("agua_caliente")}`);
  push(`  Aire acond.    : ${state.chips.ac || "-"}`);
  push(`  Calefacción    : ${state.chips.radiadores || "-"}`);
  push(`  Paredes        : ${joinCheck("paredes")}`);
  push("");

  push("◆ EDIFICIO Y ENTORNO");
  push(`  Ascensor       : ${state.chips.ascensor || "-"}`);
  push(`  Zonas comunes  : ${joinCheck("zonas")}`);
  push(`  Conserjería    : ${state.chips.conserjeria || "-"}`);
  push(`  Fachada        : ${joinCheck("fachada")}`);
  push(`  Estado         : ${state.chips.estado || "-"}`);
  push(`  Orientación    : ${joinCheck("orientacion")}`);
  push(`  Vistas         : ${joinCheck("vistas")}`);
  push(`  Servicios 5min : ${joinCheck("servicios")}`);
  push("");

  if (state.fields.observaciones || state.fields.observaciones_publicas) {
    push("◆ OBSERVACIONES");
    if (state.fields.observaciones) {
      push("  · Internas:");
      push(indent(state.fields.observaciones, "    "));
    }
    if (state.fields.observaciones_publicas) {
      push("  · Públicas (portales):");
      push(indent(state.fields.observaciones_publicas, "    "));
    }
    push("");
  }

  push("◆ RGPD Y FIRMAS");
  push(`  Política de datos informada : ${state.fields.rgpd_aceptado ? "Sí" : "No"}`);
  state.propietarios.forEach((p, i) => {
    const key = `propietario_${i + 1}`;
    push(`  Firma propietario ${i + 1} : ${state.firmas[key] ? "✓ Capturada" : "✗ Pendiente"}`);
  });
  push(`  Firma agente : ${state.firmas.agente ? "✓ Capturada" : "✗ Pendiente"}`);
  push("");
  push("  Nota: las firmas se han capturado en pantalla y quedan");
  push("  registradas en el dispositivo del agente.");
  push("");

  // ---- Bloque API ----
  push("══════════════════════════════════════════");
  push("DATOS PARA API IAGESTIÓN — grabar_prospecto");
  push("══════════════════════════════════════════");
  const api = buildApiPayload();
  Object.entries(api).forEach(([k, v]) => {
    push(`${k} = ${v}`);
  });
  push("");
  push("--- JSON ---");
  push(JSON.stringify(api, null, 2));

  return { subject, body: lines.join("\n") };
}

function buildApiPayload() {
  const a = getCurrentAgent();
  const prop = state.propietarios[0] || {};
  const op = state.chips.operacion;

  // booleans → 0/1
  const ascensor01 = state.chips.ascensor === "Sí" || state.chips.ascensor === "A cota cero" ? 1 : (state.chips.ascensor === "No" ? 0 : "");
  const tieneTerraza = (state.checks.anexos || []).includes("Terraza") ? 1 : 0;
  const tienePiscina = (state.checks.anexos || []).includes("Piscina") || (state.checks.zonas || []).includes("Piscina") ? 1 : 0;

  const p = {
    // Obligatorios
    Movil: digits(prop.movil),
    Operacion: op || "",
    Tipo: state.chips.tipo || "",
    IdGestor: a ? a.id : "",
    IdCaptador: a ? a.id : "",
    Insertar: 1,
    Estado: "Activo",
    // Datos económicos
    Precio: digits(state.fields.precio),
    // Distribución
    Habitaciones: int(state.fields.dormitorios),
    Banos: int(state.fields.banos),
    Aseos: int(state.fields.aseos),
    Metros_Construidos: int(state.fields.m2_construidos),
    Metros_Utiles: int(state.fields.m2_utiles),
    Garaje: int(state.fields.num_garajes),
    // Otros
    Ascensor: ascensor01,
    Terraza: tieneTerraza,
    Piscina: tienePiscina,
    // Ubicación
    Direccion: state.fields.direccion || "",
    Numero: state.fields.numero || "",
    Puerta: state.fields.puerta || "",
    Planta: int(state.fields.planta),
    Poblacion: state.fields.poblacion || "",
    Municipio: state.fields.poblacion || "",
    Provincia: state.fields.provincia || "Valencia",
    CP: int(state.fields.cp),
    // Refs y textos
    RefCRM: state.fields.ref || "",
    Titulo: `${state.chips.tipo || "Inmueble"} en ${state.fields.poblacion || "—"}`,
    Descripcion: state.fields.observaciones_publicas || "",
    Notas: state.fields.observaciones || ""
  };

  // Limpia valores vacíos para no enviar basura
  Object.keys(p).forEach(k => {
    if (p[k] === "" || p[k] === null || p[k] === undefined || Number.isNaN(p[k])) delete p[k];
  });
  return p;
}

// ---------- HELPERS ----------
function joinCheck(name) {
  const arr = state.checks[name] || [];
  return arr.length ? arr.join(", ") : "-";
}
function isChaletType() {
  return /chalet|adosado|pareado|casa/i.test(state.chips.tipo || "");
}
function fmtMoney(v) {
  const n = parseInt(String(v || "").replace(/\D/g, ""), 10);
  return isNaN(n) ? "-" : n.toLocaleString("es-ES");
}
function digits(v) { return String(v || "").replace(/\D/g, ""); }
function int(v) { const n = parseInt(String(v || "").replace(/[^\d-]/g, ""), 10); return isNaN(n) ? "" : n; }
function indent(s, pad) { return String(s || "").split("\n").map(l => pad + l).join("\n"); }
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ---------- TOAST ----------
function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + kind + " show";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3000);
}

// ---------- MODALES ----------
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
document.querySelectorAll("[data-close]").forEach(b => {
  b.addEventListener("click", () => b.closest(".modal-overlay").classList.remove("open"));
});
document.querySelectorAll(".modal-overlay").forEach(o => {
  o.addEventListener("click", (e) => { if (e.target === o) o.classList.remove("open"); });
});

// ---------- ENVIAR ----------
document.getElementById("btnSend").addEventListener("click", () => {
  const errs = validate();
  if (errs.length) {
    toast(errs[0], "error");
    return;
  }
  const { subject, body } = generateEmail();
  document.getElementById("prevSubject").textContent = subject;
  document.getElementById("prevBody").textContent = body;
  document.getElementById("prevTo").value = state.fields._lastTo || DEFAULT_EMAIL_TO;
  openModal("previewModal");
});

document.getElementById("btnOpenMail").addEventListener("click", () => {
  const { subject, body } = generateEmail();
  const to = document.getElementById("prevTo").value.trim();
  state.fields._lastTo = to;
  saveState();
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // Algunos clientes truncan en > ~2000 chars; en ese caso, copiar al portapapeles
  if (url.length > 1800) {
    navigator.clipboard.writeText(body).then(() => {
      toast("Cuerpo copiado al portapapeles — pégalo en el correo", "success");
    }).catch(() => {});
  }
  window.location.href = url;
  closeModal("previewModal");
});

// ---------- BORRAR ----------
document.getElementById("btnClear").addEventListener("click", () => openModal("clearModal"));
document.getElementById("btnClearConfirm").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = { propietarios: [{}], fields: {}, chips: {}, checks: {}, firmas: {} };
  saveState();
  // Reset UI
  document.getElementById("captacionForm").reset();
  document.querySelectorAll(".chip[aria-pressed='true']").forEach(c => c.setAttribute("aria-pressed", "false"));
  renderPropietarios();
  renderFirmas();
  updateSectionMeta();
  closeModal("clearModal");
  toast("Ficha borrada", "success");
  document.getElementById("chaletBlock").style.display = "none";
});

// ---------- AGENTE ----------
document.getElementById("agente").addEventListener("change", (e) => {
  state.fields.agente = e.target.value;
  saveState();
  updateSectionMeta();
  renderFirmas(); // actualiza el nombre bajo la firma del agente
});

// ---------- PWA INSTALL ----------
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBanner").style.display = "flex";
});
document.getElementById("installBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById("installBanner").style.display = "none";
});

// ---------- SERVICE WORKER ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- INIT ----------
function init() {
  populateAgentes();
  populateTiposChips();

  // fecha por defecto = hoy si está vacía
  if (!state.fields.fecha) state.fields.fecha = hoy();

  // bind chips después de poblar
  document.querySelectorAll(".chip").forEach(bindChip);
  // bind text inputs (no checkboxes, no chip-buttons)
  document.querySelectorAll("input[name], select[name], textarea[name], input[id]:not([type='checkbox']), textarea[id]")
    .forEach(el => { if (el.type !== "checkbox" && !el.classList.contains("chip")) bindTextField(el); });
  bindCheckGroup();

  renderPropietarios();
  renderFirmas();
  restoreForm();
  updateSectionMeta();
  showStatus("saved");
}

document.addEventListener("DOMContentLoaded", init);
