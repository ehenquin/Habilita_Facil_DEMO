/* ============================================================
   HABILITÁ FÁCIL — DEMO
   Frontend conectado al Apps Script suministrado.
   ============================================================ */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzvWJRX1VtUcqOB_UIPLRo-boxumBae3CPjPHLSrhhUnKV9qF8O7rTQJQVNEBUg4nPJ/exec";

const TUTORIAL_KEY = "habilita_facil_demo_tutorial_v1";

const state = {
  bootstrap: {
    actividades: [],
    requisitos: [],
    preguntas: []
  },
  tutorialIndex: 0,
  wizardStep: 1,
  selectedActivity: null,
  currentHabilitacionId: null,
  currentTitularId: null,
  form: {
    titular: {},
    local: {},
    files: {},
    respuestas: {}
  },
  certificate: null,
  municipal: {
    habilitaciones: [],
    filter: "TODOS",
    search: "",
    selectedId: null
  }
};

const WIZARD_STEPS = [
  { n: 1, title: "Actividad", hint: "Elegí qué vas a habilitar." },
  { n: 2, title: "Datos", hint: "Titular y local." },
  { n: 3, title: "Documentación", hint: "Solo lo necesario." },
  { n: 4, title: "Declaración jurada", hint: "Confirmá condiciones." },
  { n: 5, title: "Confirmación", hint: "Revisá y habilitá." }
];

/* ============================================================
   HELPERS
   ============================================================ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value ?? "").trim();
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

function activityIcon(category) {
  const c = normalize(category).toLowerCase();
  if (c.includes("gastr")) return "☕";
  if (c.includes("comerc")) return "▤";
  if (c.includes("serv")) return "⌘";
  if (c.includes("especial")) return "!";
  return "⌂";
}

function showToast(message, type = "") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast ${type}`.trim();
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3300);
}

function setBusy(button, busy, busyText = "Procesando…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function setApiStatus(ok, text) {
  const node = $("#apiStatus");
  node.classList.remove("online", "offline");
  node.classList.add(ok ? "online" : "offline");
  node.innerHTML = `<i></i> ${escapeHtml(text)}`;
}

function connectionErrorMessage() {
  return navigator.onLine === false
    ? "El dispositivo no tiene conexión a Internet."
    : "No se pudo leer la respuesta del servidor. Reintentá en unos segundos.";
}

function responseDiagnostics(response, text) {
  return {
    status: response.status,
    url: response.url,
    contentType: response.headers.get("content-type") || "",
    preview: text.slice(0, 200)
  };
}

function logResponseDiagnostics(label, response, text) {
  console.error(label, responseDiagnostics(response, text));
}

async function fetchApi(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (navigator.onLine === false) {
      throw new Error("El dispositivo no tiene conexión a Internet.");
    }
    throw error;
  }
}

async function parseApiResponse(response, text, label) {
  if (!response.ok) {
    logResponseDiagnostics(`${label}: respuesta HTTP no exitosa`, response, text);
    throw new Error(connectionErrorMessage());
  }

  try {
    return JSON.parse(text);
  } catch {
    logResponseDiagnostics(`${label}: la respuesta no es JSON válido`, response, text);
    throw new Error(connectionErrorMessage());
  }
}

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("_ts", Date.now().toString());

  const response = await fetchApi(url.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow"
  });

  const text = await response.text();
  const data = await parseApiResponse(response, text, `apiGet(${action})`);

  if (!data.ok) {
    throw new Error(data.error || "Error en la API.");
  }

  return data;
}

async function apiPost(payload) {
  const response = await fetchApi(`${API_URL}?_ts=${Date.now()}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  const text = await response.text();
  const data = await parseApiResponse(response, text, `apiPost(${payload?.action || "sin action"})`);

  return data;
}

function openModal(html) {
  $("#modalContent").innerHTML = html;
  $("#modalBackdrop").classList.remove("hidden");
  document.body.classList.add("no-scroll");
}

function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
  $("#modalContent").innerHTML = "";
  document.body.classList.remove("no-scroll");
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */

async function bootstrap() {
  bindGlobalEvents();
  initTutorial();

  try {
    const data = await apiGet("bootstrap");
    state.bootstrap.actividades = data.actividades || [];
    state.bootstrap.requisitos = data.requisitos || [];
    state.bootstrap.preguntas = data.preguntas || [];
    setApiStatus(true, "Backend conectado");
  } catch (error) {
    console.error(error);
    setApiStatus(false, "Sin conexión");
    showToast(error.message, "error");
  }

  showView("home");
}

function bindGlobalEvents() {
  document.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) {
      showView(go.dataset.go);
    }
  });

  $("#replayTutorial").addEventListener("click", () => showTutorial(true));
  $("#wizardExit").addEventListener("click", () => showView("home"));
  $("#wizardBack").addEventListener("click", wizardBack);
  $("#wizardNext").addEventListener("click", wizardNext);
  $("#printCertificate").addEventListener("click", () => window.print());

  $("#refreshMunicipal").addEventListener("click", loadMunicipal);
  $("#municipalSearch").addEventListener("input", (event) => {
    state.municipal.search = event.target.value.toLowerCase().trim();
    renderMunicipalTable();
  });

  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (event) => {
    if (event.target === $("#modalBackdrop")) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (!$("#tutorialOverlay").classList.contains("hidden")) {
      if (event.key === "ArrowRight") tutorialNext();
      if (event.key === "ArrowLeft") tutorialPrev();
      if (event.key === "Escape") finishTutorial();
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted && $("#view-municipio")?.classList.contains("active")) {
      loadMunicipal();
    }
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */

function showView(name) {
  $$(".view").forEach((view) => view.classList.remove("active"));
  const target = $(`#view-${name}`);
  if (!target) return;
  target.classList.add("active");

  $$(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.go === name);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "wizard") {
    startWizard();
  }

  if (name === "municipio") {
    loadMunicipal();
  }
}

/* ============================================================
   TUTORIAL
   ============================================================ */

function initTutorial() {
  const track = $("#tutorialTrack");
  let touchStartX = 0;
  let touchStartY = 0;

  track.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
  }, { passive: true });

  track.addEventListener("touchend", (event) => {
    const dx = event.changedTouches[0].screenX - touchStartX;
    const dy = event.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    dx < 0 ? tutorialNext() : tutorialPrev();
  }, { passive: true });

  $("#tutorialNext").addEventListener("click", tutorialNext);
  $("#tutorialPrev").addEventListener("click", tutorialPrev);
  $("#tutorialSkip").addEventListener("click", finishTutorial);

  const dots = $("#tutorialDots");
  $$(".tutorial-slide").forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.addEventListener("click", () => setTutorialSlide(index));
    dots.appendChild(dot);
  });

  if (!localStorage.getItem(TUTORIAL_KEY)) {
    showTutorial();
  } else {
    setTutorialSlide(0);
  }
}

function showTutorial(force = false) {
  if (force) state.tutorialIndex = 0;
  $("#tutorialOverlay").classList.remove("hidden");
  document.body.classList.add("no-scroll");
  setTutorialSlide(state.tutorialIndex);
}

function setTutorialSlide(index) {
  const slides = $$(".tutorial-slide");
  state.tutorialIndex = Math.max(0, Math.min(index, slides.length - 1));

  slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === state.tutorialIndex);
  });

  $$("#tutorialDots button").forEach((dot, i) => {
    dot.classList.toggle("active", i === state.tutorialIndex);
  });

  $("#tutorialPrev").disabled = state.tutorialIndex === 0;
  $("#tutorialNext").textContent =
    state.tutorialIndex === slides.length - 1 ? "Entrar a la app" : "Siguiente";
}

function tutorialNext() {
  const total = $$(".tutorial-slide").length;
  if (state.tutorialIndex >= total - 1) {
    finishTutorial();
    return;
  }
  setTutorialSlide(state.tutorialIndex + 1);
}

function tutorialPrev() {
  setTutorialSlide(state.tutorialIndex - 1);
}

function finishTutorial() {
  localStorage.setItem(TUTORIAL_KEY, "1");
  $("#tutorialOverlay").classList.add("hidden");
  document.body.classList.remove("no-scroll");
}

/* ============================================================
   WIZARD
   ============================================================ */

function resetWizardState() {
  state.wizardStep = 1;
  state.selectedActivity = null;
  state.currentHabilitacionId = null;
  state.currentTitularId = null;
  state.form = {
    titular: {},
    local: {},
    files: {},
    respuestas: {}
  };
  state.certificate = null;
}

function startWizard() {
  resetWizardState();
  renderWizard();
}

function renderWizard() {
  renderWizardSidebar();

  const content = $("#wizardContent");

  if (state.wizardStep === 1) content.innerHTML = renderStepActivity();
  if (state.wizardStep === 2) content.innerHTML = renderStepData();
  if (state.wizardStep === 3) content.innerHTML = renderStepDocuments();
  if (state.wizardStep === 4) content.innerHTML = renderStepQuestions();
  if (state.wizardStep === 5) content.innerHTML = renderStepReview();

  bindWizardStepEvents();

  $("#wizardBack").style.visibility = state.wizardStep === 1 ? "hidden" : "visible";
  $("#wizardNext").textContent = state.wizardStep === 5 ? "Habilitar ahora" : "Continuar";
  syncWizardNextState();
}

function renderWizardSidebar() {
  const index = state.wizardStep - 1;
  const current = WIZARD_STEPS[index];
  const percent = state.wizardStep * 20;
  const circumference = 270;
  const offset = circumference - (circumference * percent / 100);

  $("#progressPercent").textContent = `${percent}%`;
  $("#progressRingValue").style.strokeDashoffset = offset;
  $("#sideTitle").textContent = current.title;
  $("#sideHint").textContent = current.hint;

  $("#wizardSteps").innerHTML = WIZARD_STEPS.map((step) => `
    <div class="step-item ${step.n === state.wizardStep ? "active" : ""} ${step.n < state.wizardStep ? "done" : ""}">
      <i>${step.n < state.wizardStep ? "✓" : step.n}</i>
      <span>${escapeHtml(step.title)}</span>
    </div>
  `).join("");
}

function wizardTitle(number, title, text) {
  return `
    <div class="wizard-title">
      <span class="number">${number}</span>
      <div>
        <h2>${title}</h2>
        <p>${text}</p>
      </div>
    </div>
  `;
}

function renderStepActivity() {
  const actividades = state.bootstrap.actividades;

  return `
    ${wizardTitle(1, "¿Qué querés habilitar?", "Elegí la actividad principal que vas a desarrollar en el local.")}

    <div class="info-strip">
      <strong>i</strong>
      <span>
        Para esta demo usamos un catálogo reducido. Cada actividad tiene reglas y nivel de riesgo precargados desde Google Sheets.
      </span>
    </div>

    <div class="activity-grid">
      ${actividades.map((activity) => `
        <button class="activity-card ${state.selectedActivity?.IDActividad === activity.IDActividad ? "selected" : ""}"
                type="button"
                data-activity-id="${escapeHtml(activity.IDActividad)}">
          <span class="activity-icon">${activityIcon(activity.Categoria)}</span>
          <span>
            <strong>${escapeHtml(activity.Actividad)}</strong>
            <small>${escapeHtml(activity.Categoria)}</small>
          </span>
          <span class="risk-pill ${escapeHtml(activity.NivelRiesgo)}">${escapeHtml(activity.NivelRiesgo)}</span>
        </button>
      `).join("") || `<div class="info-strip amber">No se pudieron cargar actividades desde la API.</div>`}
    </div>
  `;
}

function renderStepData() {
  const t = state.form.titular;
  const l = state.form.local;

  return `
    ${wizardTitle(2, "Contanos quién sos y dónde vas a trabajar", "Pedimos solamente los datos básicos para crear la habilitación.")}

    <section class="form-section">
      <h3>Datos del titular</h3>
      <div class="form-grid">
        ${field("Nombre y apellido", "NombreApellido", t.NombreApellido, "text", "Ej. Lucía Gómez")}
        ${field("DNI", "DNI", t.DNI, "text", "Ej. 32123456")}
        ${field("CUIT", "CUIT", t.CUIT, "text", "Ej. 27-32123456-4")}
        ${field("Teléfono", "Telefono", t.Telefono, "tel", "Ej. 342 555 0101")}
        ${field("Email", "Email", t.Email, "email", "Ej. lucia@correo.com")}
        ${field("Domicilio real", "DomicilioReal", t.DomicilioReal, "text", "Calle, número, ciudad")}
      </div>
    </section>

    <section class="form-section">
      <h3>Datos del local</h3>
      <div class="form-grid">
        ${field("Nombre comercial", "NombreFantasia", l.NombreFantasia, "text", "Ej. La Esquina")}
        ${field("Superficie aproximada (m²)", "SuperficieM2", l.SuperficieM2, "number", "Ej. 45")}
        <div class="field span-2">
          <label for="DomicilioLocal">Domicilio del local</label>
          <input id="DomicilioLocal" name="DomicilioLocal" type="text"
                 value="${escapeHtml(l.DomicilioLocal || "")}"
                 placeholder="Calle, número, Santa Fe"
                 autocomplete="street-address" />
        </div>
      </div>
    </section>

    <div class="info-strip green">
      <strong>✓</strong>
      <span>
        Actividad seleccionada: <strong>${escapeHtml(state.selectedActivity?.Actividad || "—")}</strong>.
        Nivel de riesgo: <strong>${escapeHtml(state.selectedActivity?.NivelRiesgo || "—")}</strong>.
      </span>
    </div>
  `;
}

function field(label, name, value = "", type = "text", placeholder = "") {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="${type}"
             value="${escapeHtml(value || "")}"
             placeholder="${escapeHtml(placeholder)}" />
    </div>
  `;
}

function requirementsForSelectedActivity() {
  if (!state.selectedActivity) return [];
  return state.bootstrap.requisitos.filter((r) =>
    String(r.IDActividad) === String(state.selectedActivity.IDActividad) &&
    String(r.Obligatorio).toUpperCase() === "SI" &&
    String(r.Momento).toUpperCase() === "INICIO"
  );
}

function documentRequirementsComplete() {
  const requirements = requirementsForSelectedActivity();
  return requirements.every((req) => Boolean(state.form.files[req.TipoDocumento]));
}

function syncWizardNextState() {
  const next = $("#wizardNext");
  if (!next) return;
  next.disabled = state.wizardStep === 3 && !documentRequirementsComplete();
}

function renderStepDocuments() {
  const requirements = requirementsForSelectedActivity();
  const loaded = requirements.filter((req) => state.form.files[req.TipoDocumento]).length;
  const total = requirements.length;
  const progress = total ? Math.round((loaded / total) * 100) : 100;

  return `
    ${wizardTitle(3, "Subí tu documentación", "Te pedimos únicamente los documentos necesarios para tu actividad.")}

    ${requirements.length ? `
      <section class="docs-progress-card" aria-label="Documentación necesaria">
        <div class="docs-progress-head">
          <div>
            <h3>Documentación necesaria</h3>
            <p>${loaded} de ${total} documentos cargados</p>
          </div>
          <strong>${progress}%</strong>
        </div>
        <div class="docs-progress-bar" aria-hidden="true">
          <span style="width:${progress}%"></span>
        </div>
        <div class="docs-checklist">
          ${requirements.map((req) => {
            const done = Boolean(state.form.files[req.TipoDocumento]);
            return `
              <div class="${done ? "done" : ""}">
                <span>${done ? "✓" : "○"}</span>
                ${escapeHtml(req.TipoDocumento)}
              </div>
            `;
          }).join("")}
        </div>
      </section>
    ` : ""}

    <div class="docs-list">
      ${requirements.length ? requirements.map((req) => {
        const file = state.form.files[req.TipoDocumento];
        return `
          <article class="doc-row ${file ? "uploaded" : ""}">
            <span class="doc-icon">▣</span>
            <div class="doc-copy">
              <strong>${escapeHtml(req.TipoDocumento)}</strong>
              <small>${escapeHtml(req.Descripcion || "Documento requerido")}</small>
              ${file ? `
                <div class="doc-upload-state">
                  <b>✓ Documento cargado</b>
                  <span>${escapeHtml(file.name)}</span>
                </div>
              ` : `
                <div class="doc-upload-state pending">
                  <b>Documento pendiente</b>
                  <span>Seleccioná un archivo para continuar.</span>
                </div>
              `}
            </div>
            <div class="file-control">
              <input type="file"
                     id="file-${escapeHtml(req.IDRequisito)}"
                     data-doc-type="${escapeHtml(req.TipoDocumento)}" />
              <label class="file-label ${file ? "ready" : ""}"
                     for="file-${escapeHtml(req.IDRequisito)}">
                📁 Elegir archivo
              </label>
            </div>
          </article>
        `;
      }).join("") : `
        <div class="info-strip green">
          <strong>✓</strong>
          <span>Esta actividad no requiere documentación adicional en esta etapa.</span>
        </div>
      `}
    </div>

    ${requirements.length ? `
      <div class="info-strip">
        <strong>i</strong>
        <span>
          En esta DEMO el archivo se selecciona desde tu dispositivo, pero el backend registra solamente su nombre.
          Más adelante conectaremos la carga real a Google Drive.
        </span>
      </div>
    ` : ""}
  `;
}

function questionsForSelectedActivity() {
  if (!state.selectedActivity) return [];

  const category = String(state.selectedActivity.Categoria || "").toLowerCase();

  return state.bootstrap.preguntas
    .filter((q) => {
      if (String(q.Activa).toUpperCase() !== "SI") return false;
      return String(q.AplicaCategoria).toUpperCase() === "TODAS" ||
        String(q.AplicaCategoria).toLowerCase() === category;
    })
    .sort((a, b) => Number(a.Orden || 0) - Number(b.Orden || 0));
}

function renderStepQuestions() {
  const questions = questionsForSelectedActivity();

  return `
    ${wizardTitle(4, "Completá tu declaración jurada", "Respondé de buena fe. La información podrá ser verificada posteriormente.")}

    <div class="info-strip amber">
      <strong>!</strong>
      <span>
        La habilitación inmediata se basa en la declaración responsable del titular.
        Una respuesta incompatible puede derivar el trámite a revisión municipal.
      </span>
    </div>

    <div class="questions-list">
      ${questions.map((q) => {
        const selected = state.form.respuestas[q.IDPregunta] || "";
        return `
          <article class="question-card">
            <h4>${escapeHtml(q.TextoPregunta)}</h4>
            <div class="segmented">
              <label>
                <input type="radio" name="q-${escapeHtml(q.IDPregunta)}"
                       value="SI" data-question="${escapeHtml(q.IDPregunta)}"
                       ${selected === "SI" ? "checked" : ""}>
                <span>Sí</span>
              </label>
              <label>
                <input type="radio" name="q-${escapeHtml(q.IDPregunta)}"
                       value="NO" data-question="${escapeHtml(q.IDPregunta)}"
                       ${selected === "NO" ? "checked" : ""}>
                <span>No</span>
              </label>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderStepReview() {
  const t = state.form.titular;
  const l = state.form.local;
  const requirements = requirementsForSelectedActivity();
  const questions = questionsForSelectedActivity();

  return `
    ${wizardTitle(5, "Revisá y obtené tu habilitación", "Si todo está completo, el sistema emitirá la habilitación digital inmediatamente.")}

    <div class="review-card">
      <div class="review-block">
        <small>TITULAR</small>
        <strong>${escapeHtml(t.NombreApellido || "—")}</strong>
        <div class="muted">${escapeHtml(t.CUIT || "")}</div>
      </div>
      <div class="review-block">
        <small>COMERCIO</small>
        <strong>${escapeHtml(l.NombreFantasia || "—")}</strong>
        <div class="muted">${escapeHtml(l.DomicilioLocal || "")}</div>
      </div>
      <div class="review-block">
        <small>ACTIVIDAD</small>
        <strong>${escapeHtml(state.selectedActivity?.Actividad || "—")}</strong>
        <div class="muted">Riesgo ${escapeHtml(state.selectedActivity?.NivelRiesgo || "—")}</div>
      </div>
      <div class="review-block">
        <small>CHECKLIST</small>
        <strong>${requirements.length} documento(s) · ${questions.length} respuesta(s)</strong>
        <div class="muted">Trámite ${escapeHtml(state.currentHabilitacionId || "—")}</div>
      </div>
    </div>

    <label class="ddjj-accept">
      <input id="finalDeclaration" type="checkbox">
      <span>
        <strong>Declaro bajo juramento</strong> que la información cargada es verdadera y que el establecimiento
        cumple las condiciones declaradas para desarrollar la actividad seleccionada.
        Comprendo que el Municipio podrá verificar posteriormente lo informado.
      </span>
    </label>

    <div class="info-strip green">
      <strong>✓</strong>
      <span>
        Si la actividad admite habilitación inmediata, al continuar se generará el número oficial de la DEMO y el certificado digital.
      </span>
    </div>
  `;
}

function bindWizardStepEvents() {
  if (state.wizardStep === 1) {
    $$("[data-activity-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.activityId;
        state.selectedActivity = state.bootstrap.actividades.find((a) => String(a.IDActividad) === String(id));
        $$(".activity-card").forEach((card) => card.classList.remove("selected"));
        button.classList.add("selected");
      });
    });
  }

  if (state.wizardStep === 3) {
    $$('input[type="file"][data-doc-type]').forEach((input) => {
      input.addEventListener("change", () => {
        const type = input.dataset.docType;
        const file = input.files?.[0];
        if (file) state.form.files[type] = file;
        renderWizard();
      });
    });
  }

  if (state.wizardStep === 4) {
    $$('input[type="radio"][data-question]').forEach((input) => {
      input.addEventListener("change", () => {
        state.form.respuestas[input.dataset.question] = input.value;
      });
    });
  }
}

function collectDataForm() {
  state.form.titular = {
    NombreApellido: normalize($("#NombreApellido")?.value),
    DNI: normalize($("#DNI")?.value),
    CUIT: normalize($("#CUIT")?.value),
    Email: normalize($("#Email")?.value),
    Telefono: normalize($("#Telefono")?.value),
    DomicilioReal: normalize($("#DomicilioReal")?.value)
  };

  state.form.local = {
    NombreFantasia: normalize($("#NombreFantasia")?.value),
    SuperficieM2: normalize($("#SuperficieM2")?.value),
    DomicilioLocal: normalize($("#DomicilioLocal")?.value),
    IDActividad: state.selectedActivity?.IDActividad || ""
  };
}

function validateDataForm() {
  collectDataForm();
  const t = state.form.titular;
  const l = state.form.local;

  const required = [
    t.NombreApellido,
    t.DNI,
    t.CUIT,
    t.Email,
    t.Telefono,
    t.DomicilioReal,
    l.NombreFantasia,
    l.SuperficieM2,
    l.DomicilioLocal
  ];

  if (required.some((value) => !value)) {
    showToast("Completá todos los datos básicos para continuar.", "error");
    return false;
  }

  if (Number(l.SuperficieM2) <= 0) {
    showToast("La superficie debe ser mayor a 0.", "error");
    return false;
  }

  return true;
}

async function wizardNext() {
  const button = $("#wizardNext");

  if (state.wizardStep === 1) {
    if (!state.selectedActivity) {
      showToast("Elegí una actividad para continuar.", "error");
      return;
    }
    state.wizardStep = 2;
    renderWizard();
    return;
  }

  if (state.wizardStep === 2) {
    if (!validateDataForm()) return;

    setBusy(button, true, "Creando trámite…");

    try {
      const result = await apiPost({
        action: "crearHabilitacion",
        titular: state.form.titular,
        local: state.form.local
      });

      if (!result.ok) throw new Error(result.error || "No se pudo crear el trámite.");

      state.currentHabilitacionId = result.IDHabilitacion;
      state.currentTitularId = result.IDTitular;
      state.wizardStep = 3;
      renderWizard();
      showToast(`Trámite ${result.IDHabilitacion} creado.`, "success");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      setBusy(button, false);
      syncWizardNextState();
    }
    return;
  }

  if (state.wizardStep === 3) {
    const requirements = requirementsForSelectedActivity();
    const missing = requirements.filter((req) => !state.form.files[req.TipoDocumento]);

    if (missing.length) {
      showToast(`Falta seleccionar: ${missing.map((r) => r.TipoDocumento).join(", ")}`, "error");
      return;
    }

    setBusy(button, true, "Registrando…");

    try {
      for (const req of requirements) {
        const file = state.form.files[req.TipoDocumento];

        const result = await apiPost({
          action: "registrarDocumento",
          IDHabilitacion: state.currentHabilitacionId,
          TipoDocumento: req.TipoDocumento,
          NombreArchivo: file?.name || "",
          URL_o_FileID: `demo://seleccionado/${file?.name || "sin-archivo"}`
        });

        if (!result.ok) throw new Error(result.error || `No se pudo registrar ${req.TipoDocumento}.`);
      }

      state.wizardStep = 4;
      renderWizard();
      showToast("Documentación registrada.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      setBusy(button, false);
      syncWizardNextState();
    }
    return;
  }

  if (state.wizardStep === 4) {
    const questions = questionsForSelectedActivity();
    const missing = questions.filter((q) => !state.form.respuestas[q.IDPregunta]);

    if (missing.length) {
      showToast("Respondé todas las preguntas de la declaración jurada.", "error");
      return;
    }

    setBusy(button, true, "Guardando DDJJ…");

    try {
      const result = await apiPost({
        action: "guardarDDJJ",
        IDHabilitacion: state.currentHabilitacionId,
        respuestas: questions.map((q) => ({
          IDPregunta: q.IDPregunta,
          Respuesta: state.form.respuestas[q.IDPregunta],
          Observacion: ""
        }))
      });

      if (!result.ok) throw new Error(result.error || "No se pudo guardar la DDJJ.");

      state.wizardStep = 5;
      renderWizard();
      showToast("Declaración jurada guardada.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      setBusy(button, false);
    }
    return;
  }

  if (state.wizardStep === 5) {
    if (!$("#finalDeclaration")?.checked) {
      showToast("Tenés que aceptar la declaración jurada final.", "error");
      return;
    }

    setBusy(button, true, "Emitiendo habilitación…");

    try {
      const result = await apiPost({
        action: "finalizarHabilitacion",
        IDHabilitacion: state.currentHabilitacionId
      });

      if (!result.ok) {
        if (result.tipo === "DOCUMENTACION_INCOMPLETA") {
          throw new Error(`Falta documentación: ${(result.faltantes || []).join(", ")}`);
        }
        if (result.tipo === "DDJJ_INCOMPLETA") {
          throw new Error("La declaración jurada está incompleta.");
        }
        throw new Error(result.error || "No se pudo finalizar el trámite.");
      }

      if (!result.habilitado) {
        openModal(`
          <h3>El trámite requiere revisión</h3>
          <p>
            Esta actividad o alguna respuesta de la DDJJ no permite una habilitación automática.
            El expediente quedó en estado <strong>${escapeHtml(result.estado || "EN_REVISION")}</strong>.
          </p>
          <div class="modal-actions">
            <button class="btn primary" type="button" data-go="municipio" onclick="closeModal()">Ver panel municipal</button>
          </div>
        `);
        return;
      }

      state.certificate = {
        numero: result.NumeroHabilitacion,
        fecha: new Date(),
        titular: state.form.titular.NombreApellido,
        negocio: state.form.local.NombreFantasia,
        actividad: state.selectedActivity?.Actividad,
        domicilio: state.form.local.DomicilioLocal
      };

      renderCertificate();
      showView("certificate");
      showToast("Habilitación digital emitida.", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      setBusy(button, false);
    }
  }
}

function wizardBack() {
  if (state.wizardStep <= 1) return;

  // Una vez creado el expediente no volvemos a los datos para evitar duplicar
  // titulares/trámites en esta demo simple.
  if (state.wizardStep === 3 && state.currentHabilitacionId) {
    showToast("El expediente ya fue creado. En esta demo continuá con el checklist.", "error");
    return;
  }

  state.wizardStep -= 1;
  renderWizard();
}

/* ============================================================
   CERTIFICATE
   ============================================================ */

function renderCertificate() {
  const c = state.certificate;
  if (!c) return;

  $("#certNumber").textContent = c.numero || "—";
  $("#certDate").textContent = formatDate(c.fecha, true);
  $("#certBusiness").textContent = c.negocio || "—";
  $("#certHolder").textContent = c.titular || "—";
  $("#certActivity").textContent = c.actividad || "—";
  $("#certAddress").textContent = c.domicilio || "—";
  renderFakeQr(c.numero || "DEMO");
}

function renderFakeQr(seed) {
  const grid = $("#qrGrid");
  grid.innerHTML = "";

  let hash = 0;
  for (const char of String(seed)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }

  const size = 15;

  function finder(x, y) {
    const zones = [
      [0, 0],
      [size - 5, 0],
      [0, size - 5]
    ];
    for (const [sx, sy] of zones) {
      if (x >= sx && x < sx + 5 && y >= sy && y < sy + 5) {
        const lx = x - sx;
        const ly = y - sy;
        return lx === 0 || ly === 0 || lx === 4 || ly === 4 || (lx >= 2 && lx <= 2 && ly >= 2 && ly <= 2);
      }
    }
    return null;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = document.createElement("i");
      const forced = finder(x, y);
      const randomish = Math.abs(Math.sin((x + 1) * 17.13 + (y + 1) * 31.7 + hash)) > .47;
      if (forced === true || (forced === null && randomish)) cell.classList.add("on");
      grid.appendChild(cell);
    }
  }
}

/* ============================================================
   MUNICIPAL
   ============================================================ */

function setMunicipalRefreshBusy(busy) {
  const button = $("#refreshMunicipal");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "Actualizando…" : "Actualizar";
}

function renderEmptyMunicipalDetail() {
  const detail = $("#municipalDetail");
  if (!detail) return;
  detail.innerHTML = `
    <div class="empty-detail">
      <div>⌁</div>
      <h3>Seleccioná un trámite</h3>
      <p>Acá vas a ver el expediente, la documentación declarada y las acciones de verificación.</p>
    </div>
  `;
}

async function loadMunicipal() {
  const wrap = $("#municipalTableWrap");
  wrap.innerHTML = `<div class="loading-box">Cargando trámites…</div>`;
  setMunicipalRefreshBusy(true);

  try {
    const data = await apiGet("habilitaciones");
    state.municipal.habilitaciones = data.habilitaciones || [];

    if (
      state.municipal.selectedId &&
      !state.municipal.habilitaciones.some((row) =>
        String(row.IDHabilitacion) === String(state.municipal.selectedId)
      )
    ) {
      state.municipal.selectedId = null;
      renderEmptyMunicipalDetail();
    }

    renderStatusFilters();
    renderMunicipalTable();

    if (state.municipal.selectedId) {
      loadExpediente(state.municipal.selectedId);
    }
  } catch (error) {
    console.error(error);
    wrap.innerHTML = `<div class="loading-box">No se pudieron cargar los trámites.</div>`;
    showToast(error.message, "error");
  } finally {
    setMunicipalRefreshBusy(false);
  }
}

function renderStatusFilters() {
  const statuses = [
    { key: "TODOS", label: "Todos" },
    { key: "HABILITADO_PROVISORIO", label: "Provisorios" },
    { key: "OBSERVADO", label: "Observados" },
    { key: "VERIFICADO", label: "Verificados" }
  ];

  $("#statusFilters").innerHTML = statuses.map((s) => `
    <button class="filter-chip ${state.municipal.filter === s.key ? "active" : ""}"
            type="button"
            data-filter="${s.key}">
      ${s.label}
    </button>
  `).join("");

  $$("[data-filter]", $("#statusFilters")).forEach((button) => {
    button.addEventListener("click", () => {
      state.municipal.filter = button.dataset.filter;
      renderStatusFilters();
      renderMunicipalTable();
    });
  });
}

function filteredMunicipalRows() {
  return state.municipal.habilitaciones.filter((row) => {
    const statusOk = state.municipal.filter === "TODOS" ||
      String(row.Estado) === state.municipal.filter;

    const haystack = [
      row.IDHabilitacion,
      row.NumeroHabilitacion,
      row.NombreFantasia,
      row.DomicilioLocal,
      row.IDActividad,
      row.Estado
    ].join(" ").toLowerCase();

    const searchOk = !state.municipal.search || haystack.includes(state.municipal.search);

    return statusOk && searchOk;
  });
}

function renderMunicipalTable() {
  const rows = filteredMunicipalRows();
  const wrap = $("#municipalTableWrap");

  if (!rows.length) {
    wrap.innerHTML = `<div class="loading-box">No hay trámites para este filtro.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>EXPEDIENTE</th>
          <th>FECHA</th>
          <th>COMERCIO</th>
          <th>RIESGO</th>
          <th>ESTADO</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr data-expediente="${escapeHtml(row.IDHabilitacion)}"
              class="${state.municipal.selectedId === row.IDHabilitacion ? "selected" : ""}">
            <td><strong>${escapeHtml(row.IDHabilitacion)}</strong></td>
            <td>${escapeHtml(formatDate(row.FechaSolicitud))}</td>
            <td>
              <strong>${escapeHtml(row.NombreFantasia || "Sin nombre")}</strong><br>
              <span class="muted">${escapeHtml(row.DomicilioLocal || "")}</span>
            </td>
            <td><span class="risk-pill ${escapeHtml(row.NivelRiesgo)}">${escapeHtml(row.NivelRiesgo || "—")}</span></td>
            <td><span class="status-badge ${escapeHtml(row.Estado)}">${escapeHtml(statusLabel(row.Estado))}</span></td>
            <td>›</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $$("[data-expediente]", wrap).forEach((row) => {
    row.addEventListener("click", () => {
      state.municipal.selectedId = row.dataset.expediente;
      renderMunicipalTable();
      loadExpediente(row.dataset.expediente);
    });
  });
}

function statusLabel(status) {
  const map = {
    BORRADOR: "Borrador",
    HABILITADO_PROVISORIO: "Habilitado provisorio",
    EN_REVISION: "En revisión",
    OBSERVADO: "Observado",
    VERIFICADO: "Verificado",
    SUSPENDIDO: "Suspendido"
  };
  return map[status] || status || "—";
}

function documentUrl(doc) {
  return normalize(doc.URL_o_FileID || doc.URL || doc.FileURL || doc.Link || doc.Enlace);
}

function renderMunicipalDocuments(docs) {
  if (!docs.length) {
    return `<div class="mini-list"><div><span>Sin documentos registrados</span><b>—</b></div></div>`;
  }

  return `
    <div class="municipal-doc-list">
      ${docs.map((doc) => {
        const url = documentUrl(doc);
        const isRealUrl = /^https?:\/\//i.test(url);
        return `
          <article class="municipal-doc-item">
            <span class="municipal-doc-check">✓</span>
            <div>
              <strong>${escapeHtml(doc.TipoDocumento || "Documento")}</strong>
              <small>${escapeHtml(doc.NombreArchivo || "Archivo registrado")}</small>
              <div class="municipal-doc-meta">
                <b>${escapeHtml(doc.EstadoDocumento || "PRESENTADO")}</b>
                ${isRealUrl
                  ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Ver documento</a>`
                  : `<span>Archivo demo</span>`}
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function loadExpediente(id) {
  const detail = $("#municipalDetail");
  detail.innerHTML = `<div class="loading-box">Cargando expediente…</div>`;

  try {
    const data = await apiGet("expediente", { id });
    renderExpedienteDetail(data);
  } catch (error) {
    console.error(error);
    detail.innerHTML = `<div class="empty-detail"><h3>Error</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderExpedienteDetail(data) {
  const h = data.habilitacion || {};
  const t = data.titular || {};
  const a = data.actividad || {};
  const docs = data.documentos || [];
  const respuestas = data.respuestas || [];
  const verificaciones = data.verificaciones || [];

  $("#municipalDetail").innerHTML = `
    <div class="detail-head">
      <small>EXPEDIENTE</small>
      <h3>${escapeHtml(h.IDHabilitacion || "—")}</h3>
      <span class="status-badge ${escapeHtml(h.Estado)}">${escapeHtml(statusLabel(h.Estado))}</span>
    </div>

    <div class="detail-body">
      <div class="detail-kv">
        <span>Solicitante</span><strong>${escapeHtml(t.NombreApellido || "—")}</strong>
        <span>Comercio</span><strong>${escapeHtml(h.NombreFantasia || "—")}</strong>
        <span>Actividad</span><strong>${escapeHtml(a.Actividad || h.IDActividad || "—")}</strong>
        <span>Domicilio</span><strong>${escapeHtml(h.DomicilioLocal || "—")}</strong>
        <span>Riesgo</span><strong>${escapeHtml(h.NivelRiesgo || "—")}</strong>
        <span>Habilitación</span><strong>${escapeHtml(h.NumeroHabilitacion || "Pendiente")}</strong>
      </div>

      <div class="detail-section">
        <h4>Documentación</h4>
        ${renderMunicipalDocuments(docs)}
      </div>

      <div class="detail-section">
        <h4>Declaración jurada</h4>
        <div class="mini-list">
          <div><span>Respuestas registradas</span><b>${respuestas.length}</b></div>
          <div><span>Verificaciones previas</span><b>${verificaciones.length}</b></div>
        </div>
      </div>

      <div class="detail-section">
        <h4>Verificación municipal</h4>
        <textarea id="verificationNote" class="verification-textarea"
                  placeholder="Observación del inspector…">${escapeHtml(h.ObservacionGeneral || "")}</textarea>

        <div class="verify-actions">
          <button class="btn primary compact" type="button" data-verify="CONFORME">✓ Confirmar</button>
          <button class="btn secondary compact" type="button" data-verify="OBSERVADO">! Observar</button>
          <button class="btn compact" style="background:#fdecee;color:#a62d38" type="button" data-verify="NO_CONFORME">Suspender</button>
        </div>
      </div>
    </div>
  `;

  $$("[data-verify]", $("#municipalDetail")).forEach((button) => {
    button.addEventListener("click", () => submitVerification(button.dataset.verify));
  });
}

async function submitVerification(result) {
  const id = state.municipal.selectedId;
  if (!id) return;

  const note = normalize($("#verificationNote")?.value);

  if (result !== "CONFORME" && !note) {
    showToast("Escribí una observación antes de observar o suspender.", "error");
    return;
  }

  openModal(`
    <h3>Confirmar acción</h3>
    <p>
      Vas a registrar el resultado <strong>${escapeHtml(result)}</strong> para el expediente
      <strong>${escapeHtml(id)}</strong>.
    </p>
    <div class="modal-actions">
      <button class="btn secondary" type="button" id="cancelVerify">Cancelar</button>
      <button class="btn primary" type="button" id="confirmVerify">Confirmar</button>
    </div>
  `);

  $("#cancelVerify").addEventListener("click", closeModal);
  $("#confirmVerify").addEventListener("click", async () => {
    const button = $("#confirmVerify");
    setBusy(button, true, "Guardando…");

    try {
      const response = await apiPost({
        action: "registrarVerificacion",
        IDHabilitacion: id,
        Inspector: "Inspector Demo",
        Resultado: result,
        Observaciones: note,
        EvidenciaURL: ""
      });

      if (!response.ok) throw new Error(response.error || "No se pudo registrar la verificación.");

      closeModal();
      showToast(`Estado actualizado a ${response.EstadoPosterior}.`, "success");
      await loadMunicipal();
      await loadExpediente(id);
    } catch (error) {
      showToast(error.message, "error");
      setBusy(button, false);
    }
  });
}

/* ============================================================
   START
   ============================================================ */

document.addEventListener("DOMContentLoaded", bootstrap);
