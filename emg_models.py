"""Architectures PyTorch (copiées telles quelles du notebook)."""
import torch.nn as nn

from emg_data import NUM_CLASSES


class CompactCNN(nn.Module):
    def __init__(self, num_channels=8, window_size=150, num_classes=NUM_CLASSES):
        super().__init__()
        self.input_dropout = nn.Dropout1d(p=0.1)

        self.conv1 = nn.Conv1d(num_channels, 32, kernel_size=5, stride=1, padding=2)
        self.bn1 = nn.BatchNorm1d(32)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(2)   # 75

        self.conv2 = nn.Conv1d(32, 64, kernel_size=5, stride=1, padding=2)
        self.bn2 = nn.BatchNorm1d(64)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool1d(2)   # 37

        self.conv3 = nn.Conv1d(64, 128, kernel_size=3, stride=1, padding=1)
        self.bn3 = nn.BatchNorm1d(128)
        self.relu3 = nn.ReLU()
        self.pool3 = nn.MaxPool1d(2)   # 18

        self.dropout = nn.Dropout(p=0.6)
        self.fc1 = nn.Linear(128 * 18, 256)
        self.relu_fc = nn.ReLU()
        self.fc2 = nn.Linear(256, num_classes)

    def forward(self, x):
        x = self.input_dropout(x)
        x = self.pool1(self.relu1(self.bn1(self.conv1(x))))
        x = self.pool2(self.relu2(self.bn2(self.conv2(x))))
        x = self.pool3(self.relu3(self.bn3(self.conv3(x))))
        x = x.view(x.size(0), -1)
        x = self.dropout(x)
        x = self.relu_fc(self.fc1(x))
        return self.fc2(x)


class RealTimeANN(nn.Module):
    def __init__(self, input_size=32, num_classes=NUM_CLASSES):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_size, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(64, num_classes),
        )

    def forward(self, x):
        return self.network(x)


def build_model(method):
    if method == "cnn":
        return CompactCNN()
    if method == "ann":
        return RealTimeANN()
    raise ValueError(method)
