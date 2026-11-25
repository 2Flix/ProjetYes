const PREV_PAGE = "methode.html";
const IMPORT_PAGE = "index.html";
const NEXT_PAGE = "visualisation.html";
const METHOD_KEY = "method";               // écrit par methode.js : "cnn", "knn" ou "ann"
const REDIRECT_DELAY = 700;                // ms entre 100 % et l'ouverture des résultats

// Durée simulée par méthode (ms) — à remplacer par la vraie progression du calcul
const DURATIONS = { knn: 4000, ann: 6000, cnn: 9000 };

// Étapes affichées : "until" = pourcentage à partir duquel l'étape est terminée
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
    disclaimer: "Interface de recherche — pas un dispositif médical",
    lead: (method, n) => `Méthode ${method} · ${n} fichier${n > 1 ? "s" : ""}`,
    stageRead: "Lecture des fichiers",
    stagePrep: "Prétraitement du signal",
    stageFeatures: "Extraction des caractéristiques",
    stageModel: "Classification des gestes",
    stageResults: "Préparation des résultats",
  },
  en: {
    subtitle: "Project 4031 · Movement recognition",
    channels: "EMG / 8 channels",
    step1: "Import", step2: "Method", step3: "Visualization",
    title: "Analysis in progress",
    barLabel: "Analysing signals",
    done: "Analysis complete",
    cancel: "Cancel",
    disclaimer: "Research interface — not a medical device",
    lead: (method, n) => `${method} method · ${n} file${n > 1 ? "s" : ""}`,
    stageRead: "Reading files",
    stagePrep: "Preprocessing the signal",
    stageFeatures: "Extracting features",
    stageModel: "Classifying gestures",
    stageResults: "Preparing results",
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
const barLabelEl = document.getElementById("barLabel");
const percentEl = document.getElementById("percent");
const progressEl = document.getElementById("progress");
const barEl = document.getElementById("progressBar");
const stagesEl = document.getElementById("stages");
const cancelBtn = document.getElementById("cancelBtn");

let method = null;
let fileTotal = null;
let progress = 0;
let finished = false;
let frameId = null;

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
  const current = currentStageIndex(progress);
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

/* ---------- Progression ---------- */
let lastStage = -1;

// Point d'entrée unique : appelle setProgress(0–100) avec la vraie progression du calcul
function setProgress(pct) {
  progress = Math.min(100, Math.max(0, pct));
  barEl.style.width = `${progress}%`;
  progressEl.setAttribute("aria-valuenow", String(Math.round(progress)));
  percentEl.textContent = `${Math.round(progress)} %`;

  const stage = currentStageIndex(progress);
  if (stage !== lastStage) { lastStage = stage; renderStages(); }

  if (progress >= 100) finish();
}

function runSimulation(duration) {
  const start = performance.now();
  const frame = now => {
    setProgress(((now - start) / duration) * 100);
    if (!finished) frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
}

function finish() {
  if (finished) return;
  finished = true;
  cancelAnimationFrame(frameId);
  updateBarLabel();
  cancelBtn.disabled = true;
  setTimeout(() => { window.location.href = NEXT_PAGE; }, REDIRECT_DELAY);
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
  updateLead();
  updateBarLabel();
  renderStages();
}

document.querySelectorAll(".lang__btn").forEach(btn =>
  btn.addEventListener("click", () => setLang(btn.dataset.lang))
);

cancelBtn.addEventListener("click", () => {
  cancelAnimationFrame(frameId);
  window.location.href = PREV_PAGE;
});

/* ---------- Démarrage ---------- */
function readMethod() {
  try {
    const saved = localStorage.getItem(METHOD_KEY);
    return saved in DURATIONS ? saved : null;
  } catch { return null; }
}

async function init() {
  setLang(lang);

  method = readMethod();
  if (!method) { window.location.replace(PREV_PAGE); return; }

  try {
    const files = await loadFiles();
    if (!files || files.length === 0) { window.location.replace(IMPORT_PAGE); return; }
    fileTotal = files.length;
  } catch (err) {
    console.error(err);
    window.location.replace(IMPORT_PAGE);
    return;
  }

  updateLead();
  runSimulation(DURATIONS[method]);
}

init();
