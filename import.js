const MAX_FILES = 6;
const NEXT_PAGE = "methode.html";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileListEl = document.getElementById("fileList");
const messageEl = document.getElementById("message");
const validateBtn = document.getElementById("validateBtn");

let files = [];

function showMessage(text = "") {
  messageEl.textContent = text;
}

function isTxt(file) {
  return file.name.toLowerCase().endsWith(".txt");
}

function isDuplicate(file) {
  return files.some(f => f.name === file.name && f.size === file.size);
}

function addFiles(fileList) {
  const errors = [];
  for (const file of fileList) {
    if (!isTxt(file)) { errors.push(`« ${file.name} » n'est pas un fichier .txt.`); continue; }
    if (isDuplicate(file)) continue;
    if (files.length >= MAX_FILES) { errors.push(`Maximum ${MAX_FILES} fichiers.`); break; }
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
  fileListEl.replaceChildren(...files.map((file, i) => {
    const li = document.createElement("li");
    li.className = "file-list__item";

    const name = document.createElement("span");
    name.textContent = file.name;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "file-list__remove";
    btn.setAttribute("aria-label", `Retirer ${file.name}`);
    btn.textContent = "×";
    btn.addEventListener("click", e => { e.stopPropagation(); removeFile(i); });

    li.append(name, btn);
    return li;
  }));
  validateBtn.disabled = files.length === 0;
}

/* ---------- Événements ---------- */
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach(type =>
  dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.add("is-dragover"); })
);
["dragleave", "drop"].forEach(type =>
  dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.remove("is-dragover"); })
);
dropzone.addEventListener("drop", e => addFiles(e.dataTransfer.files));

validateBtn.addEventListener("click", async () => {
  validateBtn.disabled = true;
  try {
    await saveFiles(files);
    window.location.href = NEXT_PAGE;
  } catch (err) {
    console.error(err);
    showMessage("Impossible de lire les fichiers. Réessayez.");
    validateBtn.disabled = false;
  }
});

render();
