const MAX_FILES = 6;
const NEXT_PAGE = "methode.html";

/* ---------- Traductions ---------- */
const I18N = {
  fr: {
    subtitle: "Projet 4031 · Reconnaissance des mouvements",
    channels: "EMG / 8 canaux",
    step1: "Import", step2: "Méthode", step3: "Visualisation",
    eyebrow: "01 / Acquisition",
    title: "Importez vos signaux EMG",
    lead: "Déposez jusqu’à six fichiers segmentés, un mouvement par fichier.",
    dropTitle: "Glissez-déposez vos fichiers ici",
    dropSub: "ou cliquez pour parcourir vos fichiers",
    dropHint: "TXT · 8 canaux EMG · 6 fichiers maximum",
    examples: "Charger 6 exemples",
    validate: "Valider",
    disclaimer: "Interface de recherche — pas un dispositif médical",
    count: n => `${n} / ${MAX_FILES} fichiers`,
    notTxt: name => `« ${name} » n’est pas un fichier .txt.`,
    max: `Maximum ${MAX_FILES} fichiers.`,
    readError: "Impossible de lire les fichiers. Réessayez.",
    remove: name => `Retirer ${name}`,
  },
  en: {
    subtitle: "Project 4031 · Movement recognition",
    channels: "EMG / 8 channels",
    step1: "Import", step2: "Method", step3: "Visualization",
    eyebrow: "01 / Acquisition",
    title: "Import your EMG signals",
    lead: "Drop up to six segmented files, one movement per file.",
    dropTitle: "Drag and drop your files here",
    dropSub: "or click to browse your files",
    dropHint: "TXT · 8 EMG channels · 6 files maximum",
    examples: "Load 6 examples",
    validate: "Continue",
    disclaimer: "Research interface — not a medical device",
    count: n => `${n} / ${MAX_FILES} files`,
    notTxt: name => `“${name}” is not a .txt file.`,
    max: `Maximum ${MAX_FILES} files.`,
    readError: "Unable to read the files. Please try again.",
    remove: name => `Remove ${name}`,
  },
};

let lang = "fr";
try { lang = localStorage.getItem("lang") || "fr"; } catch {}

function t(key, ...args) {
  const value = I18N[lang][key];
  return typeof value === "function" ? value(...args) : value;
}

function setLang(newLang) {
  lang = newLang;
  try { localStorage.setItem("lang", lang); } catch {}
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll(".lang__btn").forEach(btn =>
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang))
  );
  dropzone.setAttribute("aria-label", `${t("dropTitle")} (${t("dropHint")})`);
  showMessage();
  render();
}

/* ---------- Éléments ---------- */
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileListEl = document.getElementById("fileList");
const counterEl = document.getElementById("counter");
const messageEl = document.getElementById("message");
const validateBtn = document.getElementById("validateBtn");
const exampleBtn = document.getElementById("exampleBtn");

let files = [];

/* ---------- Gestion des fichiers ---------- */
function showMessage(text = "") { messageEl.textContent = text; }
function isTxt(file) { return file.name.toLowerCase().endsWith(".txt"); }
function isDuplicate(file) { return files.some(f => f.name === file.name && f.size === file.size); }

function addFiles(fileList) {
  const errors = [];
  for (const file of fileList) {
    if (!isTxt(file)) { errors.push(t("notTxt", file.name)); continue; }
    if (isDuplicate(file)) continue;
    if (files.length >= MAX_FILES) { errors.push(t("max")); break; }
    files.push(file);
  }
  showMessage(errors.join(" "));
  render();
}

function removeFile(index) {
  files.splice(index, 1);
  showMessage();
  render();
}

function render() {
  counterEl.textContent = t("count", files.length);
  fileListEl.replaceChildren(...files.map((file, i) => {
    const li = document.createElement("li");
    li.className = "file-list__item";

    const name = document.createElement("span");
    name.textContent = file.name;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "file-list__remove";
    btn.setAttribute("aria-label", t("remove", file.name));
    btn.textContent = "×";
    btn.addEventListener("click", () => removeFile(i));

    li.append(name, btn);
    return li;
  }));
  validateBtn.disabled = files.length === 0;
}

/* ---------- Exemples synthétiques (8 canaux, un mouvement par fichier) ---------- */
const EXAMPLE_MOVEMENTS = ["poing", "main-ouverte", "flexion", "extension", "pince", "rotation"];
const EXAMPLE_SAMPLES = 600;
const EXAMPLE_CHANNELS = 8;

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeExampleFile(index) {
  const rand = seededRandom(index + 1);
  const rows = [];
  for (let n = 0; n < EXAMPLE_SAMPLES; n++) {
    const burst = n > 150 && n < 450 ? Math.sin((Math.PI * (n - 150)) / 300) : 0;
    const row = [];
    for (let ch = 0; ch < EXAMPLE_CHANNELS; ch++) {
      const gain = 0.2 + 0.8 * Math.abs(Math.sin((ch + 1) * (index + 1)));
      const noise = (rand() - 0.5) * 0.05;
      row.push((burst * gain * (rand() * 2 - 1) + noise).toFixed(5));
    }
    rows.push(row.join("\t"));
  }
  return new File([rows.join("\n")], `exemple_${EXAMPLE_MOVEMENTS[index]}.txt`, { type: "text/plain" });
}

/* ---------- Événements ---------- */
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });

["dragenter", "dragover"].forEach(type =>
  dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.add("is-dragover"); })
);
["dragleave", "drop"].forEach(type =>
  dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.remove("is-dragover"); })
);
dropzone.addEventListener("drop", e => addFiles(e.dataTransfer.files));

exampleBtn.addEventListener("click", () => {
  files = EXAMPLE_MOVEMENTS.map((_, i) => makeExampleFile(i));
  showMessage();
  render();
});

document.querySelectorAll(".lang__btn").forEach(btn =>
  btn.addEventListener("click", () => setLang(btn.dataset.lang))
);

validateBtn.addEventListener("click", async () => {
  validateBtn.disabled = true;
  try {
    await saveFiles(files);
    window.location.href = NEXT_PAGE;
  } catch (err) {
    console.error(err);
    showMessage(t("readError"));
    validateBtn.disabled = false;
  }
});

setLang(lang);