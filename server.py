"""Sert les pages du site ET l'API d'analyse.

    python server.py          ->  s'ouvre sur http://localhost:5000

POST /api/analyze  (multipart : method = cnn | ann, files = fichiers .txt)
Réponse en flux NDJSON, une ligne JSON par événement :
    {"type":"progress","value":0-100}
    {"type":"result","data":{...}}
    {"type":"error","code":"...","detail":"..."}
"""
import json
import threading
import time
import webbrowser
from pathlib import Path

import numpy as np
import torch
from flask import Flask, Response, request, send_from_directory, stream_with_context

from emg_data import (CLASS_NAMES, NUM_CLASSES, STEP, WINDOW, make_windows,
                      parse_emg, standardize, to_model_input)
from emg_models import build_model

ROOT = Path(__file__).parent
MODELS_DIR = ROOT / "models"
MAX_FILES = 6
PUBLIC_EXT = {".html", ".css", ".js"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

_models = {}


class AnalysisError(Exception):
    def __init__(self, code, detail=""):
        super().__init__(code)
        self.code, self.detail = code, detail


def get_model(method):
    if method not in ("cnn", "ann"):
        raise AnalysisError("unknown_method", method)
    if method not in _models:
        path = MODELS_DIR / f"{method}.pt"
        if not path.exists():
            raise AnalysisError("model_missing", method)
        model = build_model(method)
        model.load_state_dict(torch.load(path, map_location="cpu"))
        model.eval()
        _models[method] = model
    return _models[method]


def load_metrics(method):
    path = MODELS_DIR / f"{method}_metrics.json"
    if not path.exists():
        return None
    m = json.loads(path.read_text())
    return {"test_acc": m.get("test_acc"), "test_loss": m.get("test_loss"), "history": m.get("history")}


def event(**kw):
    return json.dumps(kw) + "\n"


def progress(value):
    return event(type="progress", value=round(value, 1))


def analyze(method, files):
    t0 = time.time()
    n = len(files)
    yield progress(0)
    model = get_model(method)

    # 1. Lecture (0 → 15 %)
    parsed = []
    for i, (name, text) in enumerate(files):
        try:
            parsed.append(parse_emg(text))
        except Exception as e:
            raise AnalysisError("bad_file", f"{name} : {e}")
        yield progress(15 * (i + 1) / n)

    # 2. Prétraitement : standardisation par fichier + fenêtres (15 → 35 %)
    windows = []
    for i, ((signal, labels), (name, _)) in enumerate(zip(parsed, files)):
        X, y = make_windows(standardize(signal), labels)
        if len(X) == 0:
            raise AnalysisError("too_short", f"{name} (≥ {WINDOW + 1} échantillons requis)")
        windows.append((X, y))
        yield progress(15 + 20 * (i + 1) / n)

    # 3. Caractéristiques / mise en forme des tenseurs (35 → 55 %)
    inputs = []
    for i, (X, _) in enumerate(windows):
        inputs.append(to_model_input(X, method))
        yield progress(35 + 20 * (i + 1) / n)

    # 4. Classification (55 → 90 %)
    results = []
    for i, ((name, _), x, (_, y)) in enumerate(zip(files, inputs, windows)):
        probs = []
        with torch.no_grad():
            for start in range(0, len(x), 256):
                logits = model(torch.from_numpy(x[start:start + 256]))
                probs.append(torch.softmax(logits, dim=1).numpy())
        probs = np.concatenate(probs)
        preds = probs.argmax(axis=1)
        counts = np.bincount(preds, minlength=NUM_CLASSES)

        item = {
            "name": name,
            "nWindows": int(len(preds)),
            "predictions": preds.tolist(),
            "counts": counts.tolist(),
            "meanProba": probs.mean(axis=0).round(4).tolist(),
            "dominant": int(counts.argmax()),
        }
        if y is not None:
            item["trueLabels"] = y.tolist()
            item["accuracy"] = round(float((preds == y).mean()) * 100, 2)
        results.append(item)
        yield progress(55 + 35 * (i + 1) / n)

    # 5. Résultats (90 → 100 %)
    yield progress(95)
    data = {
        "method": method,
        "classNames": CLASS_NAMES,
        "window": WINDOW,
        "step": STEP,
        "files": results,
        "metrics": load_metrics(method),
        "elapsed": round(time.time() - t0, 2),
    }
    yield event(type="result", data=data)
    yield progress(100)


@app.post("/api/analyze")
def api_analyze():
    method = request.form.get("method", "")
    files = [(f.filename, f.read().decode("utf-8", errors="replace"))
             for f in request.files.getlist("files")][:MAX_FILES]

    def stream():
        try:
            if not files:
                raise AnalysisError("no_files")
            yield from analyze(method, files)
        except AnalysisError as e:
            yield event(type="error", code=e.code, detail=e.detail)
        except Exception as e:
            app.logger.exception("analyse échouée")
            yield event(type="error", code="server", detail=str(e))

    return Response(stream_with_context(stream()), mimetype="application/x-ndjson",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:name>")
def static_files(name):
    if Path(name).suffix.lower() not in PUBLIC_EXT:   # n'expose ni les .py ni les modèles
        return ("Not found", 404)
    return send_from_directory(ROOT, name)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, threaded=True)