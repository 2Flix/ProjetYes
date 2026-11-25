const PREV_PAGE = "methode.html";
const IMPORT_PAGE = "index.html";
const NEXT_PAGE = "visualisation.html";
const METHOD_KEY = "method";               // écrit par methode.js : "cnn", "knn" ou "ann"
const RESULT_KEY = "results";              // lu par la page de visualisation (sessionStorage)
const API_URL = "/api/analyze";            // fourni par server.py
const REDIRECT_DELAY = 700;                // ms entre 100 % et l'ouverture des résultats
const MIN_DURATION = 1500;                 // ms : la barre ne va jamais plus vite (le calcul peut être quasi instantané)

// Étapes affichées : "until" = pourcentage à partir duquel l'étape est terminée
// (mêmes seuils que dans server.py)
const STAGES = [
  { key: "stageRead", until: 15 },
  { key: "stagePrep", until: 35 },
  { key: "stageFeatures", until: 55 },
  { key: "stageModel", until: 90 },
  { key: "stageResults", until: 100 },
];

/* ---------- Traductions ---------- */
const I18N = {
  fr: {
    subtitle: "Projet 4031 · Reconnaissance des mouvements",
    channels: "EMG / 8 canaux",
    step1: "Import", step2: "Méthode", step3: "Visualisation",
    title: "Analyse en cours",
    barLabel: "Analyse des signaux",
    done: "Analyse terminée",
    cancel: "Annuler",
    back: "Retour",
    disclaimer: "Interface de recherche — pas un dispositif médical",
    lead: (method, n) => `Méthode ${method} · ${n} fichier${n > 1 ? "s" : ""}`,
    stageRead: "Lecture des fichiers",
    stagePrep: "Prétraitement du signal",
    stageFeatures: "Extraction des caractéristiques",
    stageModel: "Classification des gestes",
    stageResults: "Préparation des résultats",
    errors: {
      network: "Serveur d’analyse injoignable. Lancez « python server.py » puis ouvrez http://localhost:5000.",
      unknown_method: d => `La méthode « ${d} » n’est pas disponible. Choisissez CNN ou ANN.`,
      model_missing: d => `Le modèle ${d.toUpperCase()} est introuvable. Lancez « python train.py ${d} --data … » pour l’entraîner.`,
      bad_file: d => `Fichier illisible — ${d}`,
      too_short: d => `Fichier trop court — ${d}`,
      no_files: "Aucun fichier à analyser.",
      storage: "Impossible de conserver les résultats dans le navigateur.",
      server: d => `Erreur du serveur : ${d}`,
    },
  },
  en: {
    subtitle: "Project 4031 · Movement recognition",
    channels: "EMG / 8 channels",
    step1: "Import", step2: "Method", step3: "Visualization",
    title: "Analysis in progress",
    barLabel: "Analysing signals",
    done: "Analysis complete",
    cancel: "Cancel",
    back: "Back",
    disclaimer: "Research interface — not a medical device",
    lead: (method, n) => `${method} method · ${n} file${n > 1 ? "s" : ""}`,
    stageRead: "Reading files",
    stagePrep: "Preprocessing the signal",
    stageFeatures: "Extracting features",
    stageModel: "Classifying gestures",
    stageResults: "Preparing results",
    errors: {
      network: "Analysis server unreachable. Run “python server.py” then open http://localhost:5000.",
      unknown_method: d => `The “${d}” method is not available. Choose CNN or ANN.`,
      model_missing: d => `The ${d.toUpperCase()} model was not found. Run “python train.py ${d} --data …” to train it.`,
      bad_file: d => `Unreadable file — ${d}`,
      too_short: d => `File too short — ${d}`,
      no_files: "No file to analyse.",
      storage: "Unable to keep the results in the browser.",
      server: d => `Server error: ${d}`,
    },
  },
};

let lang = "fr";
try { lang = localStorage.getItem("lang") || "fr"; } catch {}

function t(key, ...args) {
  const value = I18N[lang][key];
  return typeof value === "function" ? value(...args) : value;
}

/* ---------- Éléments ---------- */
const leadEl = document.getElementById("lead");
const errorEl = document.getElementById("error");
const barLabelEl = document.getElementById("barLabel");
const percentEl = document.getElementById("percent");
const progressEl = document.getElementById("progress");
const barEl = document.getElementById("progressBar");
const stagesEl = document.getElementById("stages");
const cancelBtn = document.getElementById("cancelBtn");

let method = null;
let fileTotal = null;
let progress = 0;          // valeur affichée
let target = 0;            // valeur réelle reçue du serveur
let finished = false;
let failed = null;         // { code, detail } si erreur
let frameId = null;
let lastTs = null;
let abortCtl = null;

/* ---------- Affichage ---------- */
function checkIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M3 8.5l3.2 3L13 4.5");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function currentStageIndex(pct) {
  const idx = STAGES.findIndex(s => pct < s.until);
  return idx === -1 ? STAGES.length : idx;   // STAGES.length = tout est terminé
}

function renderStages() {
  const current = failed ? -1 : currentStageIndex(progress);
  stagesEl.replaceChildren(...STAGES.map((stage, i) => {
    const state = i < current ? "done" : i === current ? "active" : "pending";
    const li = document.createElement("li");
    li.className = `stage stage--${state}`;

    const icon = document.createElement("span");
    icon.className = "stage__icon";
    icon.setAttribute("aria-hidden", "true");
    if (state === "done") icon.append(checkIcon());

    const label = document.createElement("span");
    label.textContent = t(stage.key);

    li.append(icon, label);
    return li;
  }));
}

function updateLead() {
  if (method && fileTotal !== null) leadEl.textContent = t("lead", method.toUpperCase(), fileTotal);
}

function updateBarLabel() {
  barLabelEl.textContent = finished ? t("done") : t("barLabel");
}

function updateError() {
  if (!failed) { errorEl.hidden = true; return; }
  const msg = I18N[lang].errors[failed.code] || I18N[lang].errors.server;
  errorEl.textContent = typeof msg === "function" ? msg(failed.detail || failed.code) : msg;
  errorEl.hidden = false;
  cancelBtn.textContent = t("back");
}

/* ---------- Progression ---------- */
let lastStage = -1;

function setProgress(pct) {
  progress = Math.min(100, Math.max(0, pct));
  barEl.style.width = `${progress}%`;
  progressEl.setAttribute("aria-valuenow", String(Math.round(progress)));
  percentEl.textContent = `${Math.round(progress)} %`;

  const stage = currentStageIndex(progress);
  if (stage !== lastStage) { lastStage = stage; renderStages(); }

  if (progress >= 100) finish();
}

// La barre rattrape la progression réelle (target), sans dépasser 100 % en MIN_DURATION
function tick(now) {
  if (lastTs === null) lastTs = now;
  const dt = now - lastTs;
  lastTs = now;
  if (progress < target) setProgress(Math.min(target, progress + (dt * 100) / MIN_DURATION));
  if (!finished && !failed) frameId = requestAnimationFrame(tick);
}

function finish() {
  if (finished) return;
  finished = true;
  cancelAnimationFrame(frameId);
  updateBarLabel();
  cancelBtn.disabled = true;
  setTimeout(() => { window.location.href = NEXT_PAGE; }, REDIRECT_DELAY);
}

function fail(code, detail = "") {
  if (finished || failed) return;
  failed = { code, detail };
  cancelAnimationFrame(frameId);
  renderStages();
  updateError();
}

/* ---------- Appel au serveur ---------- */
async function runAnalysis(files) {
  const body = new FormData();
  body.append("method", method);
  files.forEach(f => body.append("files", new Blob([f.content], { type: "text/plain" }), f.name));

  abortCtl = new AbortController();
  let gotResult = false;

  const handle = msg => {
    if (msg.type === "progress") {
      target = Math.max(target, msg.value);
    } else if (msg.type === "result") {
      try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(msg.data)); gotResult = true; }
      catch (err) { console.error(err); fail("storage"); }
    } else if (msg.type === "error") {
      fail(msg.code, msg.detail);
    }
  };

  try {
    const res = await fetch(API_URL, { method: "POST", body, signal: abortCtl.signal });
    if (!res.ok || !res.body) { fail("server", `HTTP ${res.status}`); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      lines.filter(Boolean).forEach(l => handle(JSON.parse(l)));
    }
    if (buffer.trim()) handle(JSON.parse(buffer));
    if (!gotResult && !failed) fail("server", "réponse incomplète");
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    fail("network");
  }
}

/* ---------- Langue ---------- */
function setLang(newLang) {
  lang = newLang;
  try { localStorage.setItem("lang", lang); } catch {}
  document.documentElement.lang = lang;
  document.title = lang === "fr" ? "EMG Studio – Analyse" : "EMG Studio – Analysis";
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll(".lang__btn").forEach(btn =>
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang))
  );
  cancelBtn.textContent = failed ? t("back") : t("cancel");
  updateLead();
  updateBarLabel();
  updateError();
  renderStages();
}

document.querySelectorAll(".lang__btn").forEach(btn =>
  btn.addEventListener("click", () => setLang(btn.dataset.lang))
);

cancelBtn.addEventListener("click", () => {
  cancelAnimationFrame(frameId);
  if (abortCtl) abortCtl.abort();
  window.location.href = PREV_PAGE;
});

/* ---------- Démarrage ---------- */
function readMethod() {
  try {
    const saved = localStorage.getItem(METHOD_KEY);
    return ["cnn", "ann", "knn"].includes(saved) ? saved : null;
  } catch { return null; }
}

async function init() {
  setLang(lang);

  method = readMethod();
  if (!method) { window.location.replace(PREV_PAGE); return; }

  let files;
  try {
    files = await loadFiles();
    if (!files || files.length === 0) { window.location.replace(IMPORT_PAGE); return; }
    fileTotal = files.length;
  } catch (err) {
    console.error(err);
    window.location.replace(IMPORT_PAGE);
    return;
  }

  updateLead();
  try { sessionStorage.removeItem(RESULT_KEY); } catch {}
  frameId = requestAnimationFrame(tick);
  runAnalysis(files);
}

init();
