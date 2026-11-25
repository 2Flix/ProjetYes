const PREV_PAGE = "index.html";
const NEXT_PAGE = "visualisation.html";   // page 3 (à créer)
const METHOD_KEY = "method";               // choix lu par la page 3 : "cnn", "knn" ou "ann"

/* ---------- Traductions ---------- */
const I18N = {
  fr: {
    subtitle: "Projet 4031 · Reconnaissance des mouvements",
    channels: "EMG / 8 canaux",
    step1: "Import", step2: "Méthode", step3: "Visualisation",
    title: "Choisissez votre méthode de reconnaissance",
    cnnFull: "Convolutional Neural Network",
    cnnDesc: "Réseau de neurones qui repère automatiquement des motifs locaux dans le signal. Très précis pour les gestes complexes, mais plus lourd et gourmand en données.",
    cnnTag: "Conseillé pour : grand jeu de données et gestes complexes",
    knnFull: "K plus proches voisins",
    knnDesc: "Classe un geste en le comparant à ses voisins les plus proches. Simple et rapide, idéal avec peu de données.",
    knnTag: "Conseillé pour : faible jeu de données et gestes simples",
    annFull: "Artificial Neural Network",
    annDesc: "Réseau de neurones simple qui classe un geste à partir de caractéristiques du signal (RMS, MAV…). Bon compromis entre précision et rapidité.",
    annTag: "Conseillé pour : jeu de données moyen et gestes variés",
    back: "Retour",
    validate: "Valider",
    disclaimer: "Interface de recherche — pas un dispositif médical",
    fileCount: n => `${n} fichier${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}`,
  },
  en: {
    subtitle: "Project 4031 · Movement recognition",
    channels: "EMG / 8 channels",
    step1: "Import", step2: "Method", step3: "Visualization",
    title: "Choose your recognition method",
    cnnFull: "Convolutional Neural Network",
    cnnDesc: "Neural network that automatically spots local patterns in the signal. Very accurate for complex gestures, but heavier and data-hungry.",
    cnnTag: "Recommended for: large datasets and complex gestures",
    knnFull: "K-Nearest Neighbours",
    knnDesc: "Classifies a gesture by comparing it to its closest neighbours. Simple and fast, ideal with little data.",
    knnTag: "Recommended for: small datasets and simple gestures",
    annFull: "Artificial Neural Network",
    annDesc: "Simple neural network that classifies a gesture from signal features (RMS, MAV…). A good balance between accuracy and speed.",
    annTag: "Recommended for: medium datasets and varied gestures",
    back: "Back",
    validate: "Continue",
    disclaimer: "Research interface — not a medical device",
    fileCount: n => `${n} file${n > 1 ? "s" : ""} imported`,
  },
};

let lang = "fr";
try { lang = localStorage.getItem("lang") || "fr"; } catch {}

function t(key, ...args) {
  const value = I18N[lang][key];
  return typeof value === "function" ? value(...args) : value;
}

/* ---------- Éléments ---------- */
const radios = document.querySelectorAll(".method__input");
const validateBtn = document.getElementById("validateBtn");
const backBtn = document.getElementById("backBtn");
const fileCountEl = document.getElementById("fileCount");

let fileTotal = null;

function setLang(newLang) {
  lang = newLang;
  try { localStorage.setItem("lang", lang); } catch {}
  document.documentElement.lang = lang;
  document.title = lang === "fr" ? "EMG Studio – Méthode" : "EMG Studio – Method";
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll(".lang__btn").forEach(btn =>
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang))
  );
  if (fileTotal !== null) fileCountEl.textContent = t("fileCount", fileTotal);
}

/* ---------- Choix de la méthode ---------- */
function selectedMethod() {
  const checked = document.querySelector(".method__input:checked");
  return checked ? checked.value : null;
}

radios.forEach(r => r.addEventListener("change", () => {
  validateBtn.disabled = selectedMethod() === null;
}));

// Si l'utilisateur revient depuis la page 3, on retrouve son choix précédent
try {
  const saved = localStorage.getItem(METHOD_KEY);
  const radio = [...radios].find(r => r.value === saved);
  if (radio) { radio.checked = true; validateBtn.disabled = false; }
} catch {}

backBtn.addEventListener("click", () => { window.location.href = PREV_PAGE; });

validateBtn.addEventListener("click", () => {
  const method = selectedMethod();
  if (!method) return;
  try { localStorage.setItem(METHOD_KEY, method); } catch (err) { console.error(err); }
  window.location.href = NEXT_PAGE;
});

document.querySelectorAll(".lang__btn").forEach(btn =>
  btn.addEventListener("click", () => setLang(btn.dataset.lang))
);

/* ---------- Fichiers importés à la page 1 (IndexedDB) ---------- */
async function checkFiles() {
  try {
    const files = await loadFiles();
    if (!files || files.length === 0) {       // arrivée directe sans import : retour à la page 1
      window.location.replace(PREV_PAGE);
      return;
    }
    fileTotal = files.length;
    fileCountEl.textContent = t("fileCount", fileTotal);
  } catch (err) {
    console.error(err);
    window.location.replace(PREV_PAGE);
  }
}

setLang(lang);
checkFiles();
