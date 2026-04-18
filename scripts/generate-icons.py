#!/usr/bin/env python3
from __future__ import annotations

import shutil
import struct
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "src" / "renderer" / "assets"
BUILD_DIR = ROOT / "build" / "icons"
ICONSET_DIR = BUILD_DIR / "passnest.iconset"
SVG_SOURCE = ASSET_DIR / "passnest-icon.svg"
PNG_SOURCE = ASSET_DIR / "passnest-icon.png"
ICNS_OUTPUT = BUILD_DIR / "passnest.icns"
ICO_OUTPUT = BUILD_DIR / "passnest.ico"

PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
ICONSET_FILES = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def render_png(size: int, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if SVG_SOURCE.exists():
        run(
            [
                "rsvg-convert",
                "-w",
                str(size),
                "-h",
                str(size),
                str(SVG_SOURCE),
                "-o",
                str(output_path),
            ]
        )
        return

    if PNG_SOURCE.exists():
        run(
            [
                "sips",
                "-z",
                str(size),
                str(size),
                str(PNG_SOURCE),
                "--out",
                str(output_path),
            ]
        )
        return

    raise FileNotFoundError("No source icon found in src/renderer/assets")


def resize_png(source_path: Path, size: int, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "sips",
            "-z",
            str(size),
            str(size),
            str(source_path),
            "--out",
            str(output_path),
        ]
    )


def write_ico(png_paths: list[Path], output_path: Path) -> None:
    images = [path.read_bytes() for path in png_paths]
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    directory = bytearray()
    offset = 6 + (16 * count)

    for png_path, image_bytes in zip(png_paths, images):
        size = int(png_path.stem.split("-")[-1])
        directory.extend(
            struct.pack(
                "<BBBBHHII",
                0 if size >= 256 else size,
                0 if size >= 256 else size,
                0,
                0,
                1,
                32,
                len(image_bytes),
                offset,
            )
        )
        offset += len(image_bytes)

    with output_path.open("wb") as handle:
        handle.write(header)
        handle.write(directory)
        for image_bytes in images:
            handle.write(image_bytes)


def write_icns(pngs_by_size: dict[int, Path], output_path: Path) -> None:
    type_codes = {
        16: "icp4",
        32: "icp5",
        64: "icp6",
        128: "ic07",
        256: "ic08",
        512: "ic09",
        1024: "ic10",
    }

    chunks: list[bytes] = []
    for size, type_code in type_codes.items():
        image_bytes = pngs_by_size[size].read_bytes()
        chunk_length = 8 + len(image_bytes)
        chunks.append(type_code.encode("ascii") + struct.pack(">I", chunk_length) + image_bytes)

    total_length = 8 + sum(len(chunk) for chunk in chunks)
    with output_path.open("wb") as handle:
        handle.write(b"icns")
        handle.write(struct.pack(">I", total_length))
        for chunk in chunks:
            handle.write(chunk)


def main() -> int:
    missing_tools = [
        tool
        for tool in ("rsvg-convert", "iconutil")
        if shutil.which(tool) is None
    ]
    if missing_tools:
        print(f"Missing required tools: {', '.join(missing_tools)}", file=sys.stderr)
        return 1

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    ensure_clean_dir(ICONSET_DIR)

    master_png = BUILD_DIR / "passnest-1024.png"
    render_png(1024, master_png)

    generated_pngs: dict[int, Path] = {1024: master_png}
    for size in PNG_SIZES:
        png_path = BUILD_DIR / f"passnest-{size}.png"
        if size == 1024:
            continue
        resize_png(master_png, size, png_path)
        generated_pngs[size] = png_path

    for filename, size in ICONSET_FILES.items():
        shutil.copyfile(generated_pngs[size], ICONSET_DIR / filename)

    try:
        run(["iconutil", "--convert", "icns", str(ICONSET_DIR), "--output", str(ICNS_OUTPUT)])
    except subprocess.CalledProcessError:
        write_icns(generated_pngs, ICNS_OUTPUT)

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    write_ico([generated_pngs[size] for size in ico_sizes], ICO_OUTPUT)

    print(f"Generated {ICNS_OUTPUT.relative_to(ROOT)}")
    print(f"Generated {ICO_OUTPUT.relative_to(ROOT)}")
    print(f"Generated raster sizes in {BUILD_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
