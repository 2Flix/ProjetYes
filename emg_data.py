"""Lecture des fichiers EMG et préparation des fenêtres (partagé entre train.py et server.py).

Aucune dépendance à PyTorch ici : uniquement numpy / pandas.
Tout est identique au notebook (fenêtre 150, pas 50, StandardScaler par fichier).
"""
import io

import numpy as np
import pandas as pd

CHANNEL_COLS = [f"channel{i}" for i in range(1, 9)]
WINDOW = 150
STEP = 50
LABEL_OFFSET = 2          # le notebook fait df['class'] - 2
NUM_CLASSES = 5

# À adapter avec les vrais noms de tes 5 gestes (classes 2 à 6 du dataset)
CLASS_NAMES = [f"Geste {i + 1}" for i in range(NUM_CLASSES)]


def parse_emg(text):
    """Retourne (signal [N, 8], labels [N] ou None).

    Deux formats acceptés :
      - dataset d'origine : en-tête channel1..channel8 + colonne 'class'
      - brut : 8 colonnes numériques sans en-tête (ex. les fichiers d'exemple du site)
    """
    if not text.strip():
        raise ValueError("fichier vide")

    first_line = text.lstrip().splitlines()[0].lower()
    has_header = "channel" in first_line
    df = pd.read_csv(io.StringIO(text), sep=r"\s+",
                     header=0 if has_header else None, engine="python")

    if has_header:
        missing = [c for c in CHANNEL_COLS if c not in df.columns]
        if missing:
            raise ValueError(f"colonnes manquantes : {', '.join(missing)}")
        signal = df[CHANNEL_COLS].to_numpy(dtype=float)
        labels = None
        if "class" in df.columns:
            labels = df["class"].to_numpy(dtype=float).astype(int) - LABEL_OFFSET
    else:
        if df.shape[1] < len(CHANNEL_COLS):
            raise ValueError(f"{df.shape[1]} colonnes trouvées, 8 attendues")
        signal = df.iloc[:, :len(CHANNEL_COLS)].to_numpy(dtype=float)
        labels = None

    return signal, labels


def standardize(signal):
    """Équivalent de StandardScaler().fit_transform appliqué à un fichier."""
    mean = signal.mean(axis=0)
    std = signal.std(axis=0)
    std[std == 0] = 1.0
    return (signal - mean) / std


def make_windows(signal, labels=None, window=WINDOW, step=STEP):
    """Fenêtres glissantes : X [n, window, 8], y [n] (label du dernier échantillon) ou None."""
    starts = range(0, len(signal) - window, step)
    X = np.array([signal[i:i + window] for i in starts], dtype=np.float32)
    y = None
    if labels is not None:
        y = np.array([labels[i + window - 1] for i in starts], dtype=np.int64)
    return X, y


def extract_emg_features(window):
    """32 caractéristiques (MAV, RMS, ZC, variance × 8 canaux) — copie exacte du notebook ANN."""
    feats = []
    for col in range(window.shape[1]):
        ch = window[:, col]
        mav = np.mean(np.abs(ch))
        rms = np.sqrt(np.mean(ch ** 2))
        zc = len(np.nonzero(np.diff(np.sign(ch)))[0]) / len(ch)
        var = np.var(ch)
        feats.extend([mav, rms, zc, var])
    return np.array(feats)


def to_model_input(X, method):
    """CNN : (n, 8, 150).  ANN : (n, 32)."""
    if method == "cnn":
        return np.ascontiguousarray(X.transpose(0, 2, 1), dtype=np.float32)
    if method == "ann":
        return np.array([extract_emg_features(w) for w in X], dtype=np.float32)
    raise ValueError(method)
