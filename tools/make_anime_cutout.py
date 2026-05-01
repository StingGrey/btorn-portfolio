from __future__ import annotations

import hashlib
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter


PROVIDER_ALIASES = {
    "auto": None,
    "cuda": "CUDAExecutionProvider",
    "dml": "DmlExecutionProvider",
    "cpu": "CPUExecutionProvider",
}
PROVIDER_PRIORITY = (
    "CUDAExecutionProvider",
    "DmlExecutionProvider",
    "CPUExecutionProvider",
)

MODELS = {
    "isnet-anime": {
        "url": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx",
        "hash": "md5:6f184e756bb3bd901c8849220a83e38e",
        "size": (1024, 1024),
        "mean": (0.485, 0.456, 0.406),
        "std": (1.0, 1.0, 1.0),
        "sigmoid": False,
    },
    "u2net_human_seg": {
        "url": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx",
        "hash": "md5:c09ddc2e0104f800e3e1bb4652583d1f",
        "size": (320, 320),
        "mean": (0.485, 0.456, 0.406),
        "std": (0.229, 0.224, 0.225),
        "sigmoid": False,
    },
    "birefnet-portrait": {
        "url": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-portrait-epoch_150.onnx",
        "hash": "md5:c3a64a6abf20250d090cd055f12a3b67",
        "size": (1024, 1024),
        "mean": (0.485, 0.456, 0.406),
        "std": (0.229, 0.224, 0.225),
        "sigmoid": True,
    },
    "bria-rmbg": {
        "url": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/bria-rmbg-2.0.onnx",
        "hash": "sha256:5b486f08200f513f460da46dd701db5fbb47d79b4be4b708a19444bcd4e79958",
        "size": (1024, 1024),
        "mean": (0.485, 0.456, 0.406),
        "std": (0.229, 0.224, 0.225),
        "sigmoid": False,
    },
}


def ensure_model(model_name: str) -> Path:
    config = MODELS[model_name]
    home = Path(os.environ.get("U2NET_HOME", Path.home() / ".u2net"))
    home.mkdir(parents=True, exist_ok=True)
    model = home / f"{model_name}.onnx"
    algo, expected = config["hash"].split(":", 1)
    if model.exists() and digest(model, algo) == expected:
        return model

    print(f"Downloading anime cutout model to {model}...")
    urllib.request.urlretrieve(config["url"], model)
    actual = digest(model, algo)
    if actual != expected:
        raise RuntimeError(f"Model checksum mismatch: {actual}")
    return model


def digest(path: Path, algo: str) -> str:
    h = hashlib.new(algo)
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def predict_mask(session: ort.InferenceSession, img: Image.Image, model_name: str) -> Image.Image:
    config = MODELS[model_name]
    width, height = config["size"]
    resized = img.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
    arr = np.asarray(resized).astype(np.float32)
    arr = arr / max(float(np.max(arr)), 1e-6)

    normalized = np.zeros((height, width, 3), dtype=np.float32)
    mean = config["mean"]
    std = config["std"]
    normalized[:, :, 0] = (arr[:, :, 0] - mean[0]) / std[0]
    normalized[:, :, 1] = (arr[:, :, 1] - mean[1]) / std[1]
    normalized[:, :, 2] = (arr[:, :, 2] - mean[2]) / std[2]
    tensor = np.expand_dims(normalized.transpose((2, 0, 1)), 0).astype(np.float32)

    input_name = session.get_inputs()[0].name
    pred = session.run(None, {input_name: tensor})[0][:, 0, :, :]
    if config["sigmoid"]:
        pred = 1 / (1 + np.exp(-pred))
    pred = np.squeeze(pred)
    pred = (pred - np.min(pred)) / max(float(np.max(pred) - np.min(pred)), 1e-6)

    mask = Image.fromarray((pred * 255).astype("uint8"), mode="L")
    mask = mask.resize(img.size, Image.Resampling.LANCZOS)
    mask = mask.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(0.45))
    return mask


def crop_to_alpha(img: Image.Image, padding: int = 28) -> Image.Image:
    alpha = np.asarray(img.getchannel("A"))
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0 or len(ys) == 0:
        return img

    left = max(int(xs.min()) - padding, 0)
    top = max(int(ys.min()) - padding, 0)
    right = min(int(xs.max()) + padding, img.width)
    bottom = min(int(ys.max()) + padding, img.height)
    return img.crop((left, top, right, bottom))


def select_providers(provider_mode: str) -> list[str]:
    if provider_mode not in PROVIDER_ALIASES:
        choices = ", ".join(PROVIDER_ALIASES)
        raise ValueError(f"Unknown provider: {provider_mode}. Choices: {choices}")

    available = set(ort.get_available_providers())
    requested = PROVIDER_ALIASES[provider_mode]
    if requested:
        if requested not in available:
            available_text = ", ".join(ort.get_available_providers())
            raise RuntimeError(
                f"{requested} is not available. Installed providers: {available_text}"
            )
        if requested == "CPUExecutionProvider":
            return [requested]
        return [requested, "CPUExecutionProvider"]

    providers = [provider for provider in PROVIDER_PRIORITY if provider in available]
    if not providers:
        raise RuntimeError("No ONNX Runtime execution provider is available.")
    return providers


def main() -> int:
    if len(sys.argv) not in (3, 4, 5, 6):
        print("Usage: python tools/make_anime_cutout.py <input> <output> [model] [--provider auto|cuda|dml|cpu]")
        print("Models: " + ", ".join(MODELS))
        return 2

    args = sys.argv[1:]
    provider_mode = os.environ.get("CUTOUT_PROVIDER", "auto").lower()
    if "--provider" in args:
        index = args.index("--provider")
        if index == len(args) - 1:
            raise ValueError("--provider requires a value: auto, cuda, dml, or cpu")
        provider_mode = args[index + 1].lower()
        del args[index:index + 2]

    if len(args) not in (2, 3):
        print("Usage: python tools/make_anime_cutout.py <input> <output> [model] [--provider auto|cuda|dml|cpu]")
        print("Models: " + ", ".join(MODELS))
        return 2

    input_path = Path(args[0])
    output_path = Path(args[1])
    model_name = args[2] if len(args) == 3 else "isnet-anime"
    if model_name not in MODELS:
        raise ValueError(f"Unknown model: {model_name}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    source = Image.open(input_path).convert("RGBA")
    model = ensure_model(model_name)
    providers = select_providers(provider_mode)
    print(f"Using ONNX Runtime providers: {', '.join(providers)}")
    session = ort.InferenceSession(str(model), providers=providers)
    mask = predict_mask(session, source, model_name)

    cutout = source.copy()
    cutout.putalpha(mask)
    cutout = crop_to_alpha(cutout)
    cutout.save(output_path)
    print(f"Saved cutout: {output_path} ({cutout.width}x{cutout.height}) using {model_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
