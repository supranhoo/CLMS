"""Recover CLMS first-party reference sources from a production source map.

Usage (destination must be empty):
  python tools/recover-frontend.py --build ../build --output C:/temp/clms-reference

This is a source-recovery utility, not a deployment or database migration.
It reads only the build asset manifest, explicitly identified source maps,
the two public branding images, and favicon.ico. It never reads environment
files, backend executables, passwords, keys, license files, logs or live data.
The running replica also includes hand-written development guards and mock
API integration; review those changes before replacing any application file.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil


IMPORT = re.compile(r'''((?:from\s+|import\s*)["'])([^"']+)(["'])''')
LOCAL_ORIGIN = re.compile(
    r"https?://(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?"
)


def inside(base, value):
    target = (base / value.lstrip("/")).resolve()
    if not target.is_relative_to(base.resolve()):
        raise ValueError(f"Asset path escapes the build directory: {value}")
    return target


def recover(build, output):
    build = build.resolve()
    output = output.resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output must be an empty directory; existing work will not be overwritten.")
    output.mkdir(parents=True, exist_ok=True)
    src = output / "src"
    src.mkdir()
    assets = json.loads((build / "asset-manifest.json").read_text(encoding="utf-8"))["files"]
    counts, provenance = {}, []

    for key, kind in [("main.js", "javascript"), ("main.css", "css")]:
        source_map = inside(build, assets[key] + ".map")
        data = json.loads(source_map.read_text(encoding="utf-8"))
        count = 0
        for name, content in zip(data["sources"], data["sourcesContent"]):
            if not content or name.startswith(("../", "webpack:")) or "node_modules" in name:
                continue
            if not name.endswith((".js", ".jsx", ".css", ".json", ".svg")):
                continue
            destination = inside(src, name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            content = content.replace("\r\n", "\n").replace("\r", "")
            # Remove private-network origins from executable code and comments.
            content = LOCAL_ORIGIN.sub("", content)
            destination.write_text(content, encoding="utf-8")
            count += 1
        counts[kind] = count
        provenance.append({
            "path": str(source_map.relative_to(build)).replace("\\", "/"),
            "sha256": hashlib.sha256(source_map.read_bytes()).hexdigest(),
        })

    # CRA allowed JSX in .js; Vite handles JSX through the normal .jsx extension.
    renamed = {}
    for path in list(src.rglob("*.js")):
        if re.search(r"<(?:[A-Za-z][\w.:]*[\s/>]|>)", path.read_text(encoding="utf-8")):
            destination = path.with_suffix(".jsx")
            path.rename(destination)
            renamed[path.resolve()] = destination.resolve()

    for path in list(src.rglob("*.js")) + list(src.rglob("*.jsx")):
        def rewrite(match):
            reference = match.group(2)
            if reference.startswith(".") and reference.endswith(".js"):
                if (path.parent / reference).resolve() in renamed:
                    reference = reference[:-3] + ".jsx"
            if reference == "react-bootstrap/esm/Container":
                reference = "react-bootstrap/Container"
            if reference == "axios" and path != src / "api/axios.js":
                reference = os.path.relpath(src / "api/axios.js", path.parent).replace("\\", "/")
                if not reference.startswith("."):
                    reference = "./" + reference
            return match.group(1) + reference + match.group(3)
        path.write_text(IMPORT.sub(rewrite, path.read_text(encoding="utf-8")), encoding="utf-8")

    (src / "assets").mkdir(exist_ok=True)
    for manifest_key, name in [
        ("static/media/grouplogo.png", "grouplogo.png"),
        ("static/media/background.png", "background.png"),
    ]:
        shutil.copyfile(inside(build, assets[manifest_key]), src / "assets" / name)
    (output / "public").mkdir()
    shutil.copyfile(build / "favicon.ico", output / "public/favicon.ico")
    report = {
        "source": "CLMS production build first-party embedded source content",
        "counts": counts,
        "jsxModulesRenamed": len(renamed),
        "sourceMaps": provenance,
        "privateNetworkOriginsRemoved": True,
        "notRecovered": ["backend implementation", "database schema", "database records", "empty or omitted stylesheets"],
    }
    (output / "recovery-manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    recover(args.build, args.output)
