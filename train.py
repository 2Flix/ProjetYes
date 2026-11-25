"""Entraîne le CNN ou l'ANN et sauvegarde les poids dans models/.

    python train.py cnn --data chemin/vers/EMG-Data-Gesture-VFinal
    python train.py ann --data chemin/vers/EMG-Data-Gesture-VFinal

Hyperparamètres identiques au notebook Colab.
"""
import argparse
import copy
import glob
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset, SubsetRandomSampler

from emg_data import make_windows, parse_emg, standardize, to_model_input
from emg_models import build_model

CONFIG = {
    "cnn": dict(batch=64, wd=1e-3, sched_patience=2, stop_patience=5, epochs=30),
    "ann": dict(batch=64, wd=1e-4, sched_patience=3, stop_patience=6, epochs=40),
}
MODELS_DIR = Path(__file__).parent / "models"


class WindowDataset(Dataset):
    def __init__(self, paths, method):
        Xs, ys = [], []
        for path in paths:
            try:
                signal, labels = parse_emg(Path(path).read_text())
                if labels is None:
                    print(f"Ignoré (pas de colonne class) : {path}")
                    continue
                X, y = make_windows(standardize(signal), labels)
                if len(X):
                    Xs.append(to_model_input(X, method))
                    ys.append(y)
            except Exception as e:
                print(f"Erreur lors du traitement du fichier {path}: {e}")
        self.X = torch.tensor(np.concatenate(Xs), dtype=torch.float32)
        self.y = torch.tensor(np.concatenate(ys), dtype=torch.long)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, i):
        return self.X[i], self.y[i]


def run_epoch(model, loader, criterion, device, optimizer=None):
    training = optimizer is not None
    model.train(training)
    loss_sum, correct, total = 0.0, 0, 0
    with torch.set_grad_enabled(training):
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            if training:
                optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            if training:
                loss.backward()
                optimizer.step()
            loss_sum += loss.item() * x.size(0)
            correct += out.argmax(1).eq(y).sum().item()
            total += y.size(0)
    return loss_sum / total, 100.0 * correct / total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("method", choices=["cnn", "ann"])
    parser.add_argument("--data", required=True, help="dossier contenant les fichiers segmented_data")
    args = parser.parse_args()
    cfg = CONFIG[args.method]

    paths = [p for p in glob.glob(f"{args.data}/**/*.txt", recursive=True) if "segmented_data" in p]
    print(f"Nombre de fichiers trouvés : {len(paths)}")
    dataset = WindowDataset(paths, args.method)

    idx = list(range(len(dataset)))
    train_val, test = train_test_split(idx, test_size=0.20, random_state=42)
    train, val = train_test_split(train_val, test_size=0.25, random_state=42)
    print(f"Fenêtres : total={len(dataset)} train={len(train)} val={len(val)} test={len(test)}")

    mk = lambda ids: DataLoader(dataset, batch_size=cfg["batch"], sampler=SubsetRandomSampler(ids))
    train_loader, val_loader, test_loader = mk(train), mk(val), mk(test)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(args.method).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=cfg["wd"])
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=cfg["sched_patience"])

    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}
    best_loss, best_wts, bad = float("inf"), copy.deepcopy(model.state_dict()), 0

    for epoch in range(cfg["epochs"]):
        tl, ta = run_epoch(model, train_loader, criterion, device, optimizer)
        vl, va = run_epoch(model, val_loader, criterion, device)
        scheduler.step(vl)
        for k, v in zip(history, (tl, ta, vl, va)):
            history[k].append(v)
        print(f"Epoch {epoch + 1:02d}/{cfg['epochs']} | Train {tl:.4f} / {ta:.2f}% | Val {vl:.4f} / {va:.2f}%")
        if vl < best_loss:
            best_loss, best_wts, bad = vl, copy.deepcopy(model.state_dict()), 0
        else:
            bad += 1
            if bad >= cfg["stop_patience"]:
                print(f"-> Early stopping à l'époque {epoch + 1}")
                break

    model.load_state_dict(best_wts)
    test_loss, test_acc = run_epoch(model, test_loader, criterion, device)
    print(f"Test loss {test_loss:.4f} - précision {test_acc:.2f}%")

    MODELS_DIR.mkdir(exist_ok=True)
    torch.save({k: v.cpu() for k, v in best_wts.items()}, MODELS_DIR / f"{args.method}.pt")
    (MODELS_DIR / f"{args.method}_metrics.json").write_text(json.dumps(
        {"method": args.method, "test_loss": test_loss, "test_acc": test_acc, "history": history}))
    print(f"Modèle enregistré dans models/{args.method}.pt")


if __name__ == "__main__":
    main()
