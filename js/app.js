/* ==========================================================================
   RK Palanca · WebApp Captación · App logic
   ========================================================================== */

const STORAGE_KEY = "rkp_captacion_v1";
const HISTORY_KEY = "rkp_captacion_history";
const DEFAULT_EMAIL_TO = "julia@inmobiliariapalanca.com";

// ---------- ESTADO ----------
let state = loadState() || {
  propietarios: [{}],
  fields: {},
  chips: {},
  checks: {}
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

// ---------- HISTORIAL ----------
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveHistory(arr) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
  catch (e) { console.error("No se pudo guardar historial:", e); }
}
function archiveSnapshot(status) {
  // No archivar si el formulario está vacío
  if (isStateEmpty(state)) return null;
  let hist = loadHistory();
  // Si esta ficha proviene de un borrador del historial, eliminar la entrada
  // original para evitar duplicados (se sustituirá por la versión actual).
  if (state._sourceDraftId) {
    hist = hist.filter(h => h.id !== state._sourceDraftId);
  }
  const a = getCurrentAgent();
  const data = JSON.parse(JSON.stringify(state));
  delete data._sourceDraftId; // no persistir el vínculo dentro del snapshot
  const item = {
    id: "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    status,                       // 'draft' | 'sent'
    ts: Date.now(),
    label: buildSnapshotLabel(),
    agenteName: a ? a.name : "",
    data: data
  };
  hist.unshift(item);
  // Limitar a 100 entradas (las más antiguas se descartan)
  if (hist.length > 100) hist.length = 100;
  saveHistory(hist);
  updateHistoryBadge();
  return item;
}
function buildSnapshotLabel() {
  const tipo = state.chips.tipo || "Inmueble";
  const pob = state.fields.poblacion || "";
  const ref = state.fields.ref || "";
  const propietario = (state.propietarios[0] || {}).nombre || "";
  const parts = [tipo];
  if (pob) parts.push(pob);
  if (ref) parts.push(ref);
  if (propietario) parts.push(propietario);
  return parts.join(" · ");
}
function isStateEmpty(s) {
  const f = s.fields || {};
  const hasFields = Object.keys(f).some(k => k !== "_lastTo" && k !== "fecha" && k !== "provincia" && f[k]);
  const hasChips = Object.keys(s.chips || {}).length > 0;
  const hasChecks = Object.values(s.checks || {}).some(arr => Array.isArray(arr) && arr.length);
  const hasProp = (s.propietarios || []).some(p => p && Object.values(p).some(v => v));
  return !(hasFields || hasChips || hasChecks || hasProp);
}
function resetActiveState() {
  state = { propietarios: [{}], fields: { fecha: hoy(), provincia: "Valencia" }, chips: {}, checks: {} };
  saveState();
  // Reset UI
  document.getElementById("captacionForm").reset();
  document.querySelectorAll(".chip[aria-pressed='true']").forEach(c => c.setAttribute("aria-pressed", "false"));
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById("chaletBlock").style.display = "none";
  document.getElementById("agente").value = "";
  document.getElementById("provincia").value = "Valencia";
  document.getElementById("fecha").value = state.fields.fecha;
  renderPropietarios();
  updateSectionMeta();
}
function updateHistoryBadge() {
  const hist = loadHistory();
  const drafts = hist.filter(h => h.status === "draft").length;
  const badge = document.getElementById("historyBadge");
  if (!badge) return;
  if (drafts > 0) { badge.hidden = false; badge.textContent = drafts; }
  else { badge.hidden = true; }
}
function formatDateTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderHistory(activeTab) {
  const list = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  const all = loadHistory();
  const drafts = all.filter(h => h.status === "draft");
  const sent = all.filter(h => h.status === "sent");
  document.getElementById("countDraft").textContent = drafts.length;
  document.getElementById("countSent").textContent = sent.length;

  const items = activeTab === "sent" ? sent : drafts;
  list.innerHTML = "";
  if (items.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `
      <div class="info">
        <p class="label">${escHtml(it.label || "(sin datos)")}</p>
        <p class="meta">${formatDateTime(it.ts)}${it.agenteName ? " · " + escHtml(it.agenteName) : ""}</p>
      </div>
      <div class="actions">
        <button type="button" class="icon-btn" data-load="${it.id}">Cargar</button>
        <button type="button" class="icon-btn danger" data-del="${it.id}">Eliminar</button>
      </div>
    `;
    list.appendChild(row);
  }
  list.querySelectorAll("[data-load]").forEach(b => b.addEventListener("click", () => loadFromHistory(b.dataset.load)));
  list.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => deleteFromHistory(b.dataset.del)));
}

function escHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function loadFromHistory(id) {
  const hist = loadHistory();
  const item = hist.find(h => h.id === id);
  if (!item) return;
  const proceed = () => {
    state = JSON.parse(JSON.stringify(item.data));
    state.propietarios = state.propietarios && state.propietarios.length ? state.propietarios : [{}];
    state._sourceDraftId = item.id; // recuerda de qué entrada del historial proviene
    saveState();
    // Reset UI y restaurar
    document.getElementById("captacionForm").reset();
    document.querySelectorAll(".chip[aria-pressed='true']").forEach(c => c.setAttribute("aria-pressed", "false"));
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    renderPropietarios();
    restoreForm();
    updateSectionMeta();
    closeModal("historyModal");
    toast("Ficha cargada", "success");
  };
  if (!isStateEmpty(state)) {
    askConfirm(
      "¿Descartar la ficha actual?",
      "Vas a sustituirla por la ficha guardada. Si quieres conservarla, guarda primero como borrador.",
      proceed
    );
  } else proceed();
}
function deleteFromHistory(id) {
  askConfirm(
    "¿Eliminar esta ficha del historial?",
    "Esta acción no se puede deshacer.",
    () => {
      const hist = loadHistory().filter(h => h.id !== id);
      saveHistory(hist);
      const activeTab = document.querySelector(".history-tabs .tab.active").dataset.tab;
      renderHistory(activeTab);
      updateHistoryBadge();
      toast("Eliminada", "success");
    }
  );
}

// Confirmación genérica
function askConfirm(title, text, onYes) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").textContent = text;
  const btn = document.getElementById("btnConfirmYes");
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener("click", () => {
    closeModal("confirmModal");
    onYes();
  });
  openModal("confirmModal");
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
    const cb = document.getElementById("chaletBlock");
    if (cb) cb.style.display = isChalet ? "" : "none";
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
});


function setupSignaturePad_DEPRECATED(canvas) {
  const key = canvas.dataset.firma;
  const box = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  let dpr = window.devicePixelRatio || 1;

  function applyContextStyles() {
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0) return;
    // Guardar contenido actual antes de redimensionar
    const prev = canvas.toDataURL("image/png");
    const had = box.classList.contains("signed");

    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    // resetTransform + scale para no acumular
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    applyContextStyles();

    // Restaurar imagen previa (de la firma actual o del state)
    const src = had ? prev : state.firmas[key];
    if (src) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, r.width, r.height);
        box.classList.add("signed");
      };
      img.src = src;
    }
  }
  resize();
  window.addEventListener("resize", resize);

  let drawing = false;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e) {
    if (e.button !== undefined && e.button !== 0) return; // sólo botón izquierdo
    drawing = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un punto para click sin arrastre
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  }
  function end(e) {
    if (!drawing) return;
    drawing = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    box.classList.add("signed");
    state.firmas[key] = canvas.toDataURL("image/png");
    saveState();
  }

  // Pointer events: cubre ratón, dedo y stylus en navegadores modernos
  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointerleave", end);
  canvas.addEventListener("pointercancel", end);
  // Evita que el navegador interprete el gesto como scroll
  canvas.style.touchAction = "none";
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
  // Ya no hay campos obligatorios; siempre permitir envío.
  return [];
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
  // Archivar en historial como 'enviado' y limpiar el formulario activo
  archiveSnapshot("sent");
  resetActiveState();
  setTimeout(() => toast("Ficha archivada en Enviados", "success"), 600);
});

// ---------- BORRADOR ----------
document.getElementById("btnSaveDraft").addEventListener("click", () => {
  if (isStateEmpty(state)) {
    toast("No hay datos para guardar", "error");
    return;
  }
  archiveSnapshot("draft");
  resetActiveState();
  toast("Borrador guardado — puedes empezar otra ficha", "success");
});

// ---------- HISTORIAL ----------
document.getElementById("btnHistory").addEventListener("click", () => {
  document.querySelectorAll(".history-tabs .tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "draft"));
  renderHistory("draft");
  openModal("historyModal");
});
document.querySelectorAll(".history-tabs .tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".history-tabs .tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    renderHistory(t.dataset.tab);
  });
});

// ---------- BORRAR ----------
document.getElementById("btnClear").addEventListener("click", () => openModal("clearModal"));
document.getElementById("btnClearConfirm").addEventListener("click", () => {
  resetActiveState();
  closeModal("clearModal");
  toast("Ficha borrada", "success");
});

// ---------- AGENTE ----------
document.getElementById("agente").addEventListener("change", (e) => {
  state.fields.agente = e.target.value;
  saveState();
  updateSectionMeta();
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
  restoreForm();
  updateSectionMeta();
  updateHistoryBadge();
  showStatus("saved");
}

document.addEventListener("DOMContentLoaded", init);
