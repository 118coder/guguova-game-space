#!/usr/bin/env python3
"""Upload the packaged release to GitHub.

Reads dist/release-manifest.json, creates the release for the current version
(or reuses it with --tag-only) and uploads every listed asset.

The token comes from the git credential manager, exactly like the manual
curl calls used before, so nothing extra needs configuring.

  python tools/publish-release.py
  python tools/publish-release.py --version 1.14.3 --tag-only
  python tools/publish-release.py --dry-run
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
REPO = "118coder/guguova-game-space"
API = "https://api.github.com"
UPLOADS = "https://uploads.github.com"


def version() -> str:
    return json.loads((ROOT / "version.json").read_text(encoding="utf-8"))["version"]


def token() -> str:
    out = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True, text=True, cwd=ROOT, timeout=30)
    if out.returncode != 0:
        raise SystemExit("git credential fill failed; sign in to GitHub first")
    match = re.search(r"^password=(.+)$", out.stdout, re.MULTILINE)
    if not match:
        raise SystemExit("no password/token in git credential output")
    return match.group(1).strip()


def request(method: str, url: str, auth: str, payload=None, content_type="application/json"):
    data = None
    if payload is not None:
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {auth}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            body = response.read().decode("utf-8")
            return response.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8")
        try:
            return error.code, json.loads(body)
        except Exception:
            return error.code, {"message": body[:400]}


def release_notes(ver: str, manifest: dict) -> str:
    lines = [f"## 下载", ""]
    single = next((p for p in manifest["packages"] if p["name"].endswith(".exe")), None)
    if single:
        lines += [
            f"**单文件版（推荐）** — `{single['name']}`"
            f"（{single['size'] / 1048576:.2f} MB），双击即可运行。",
            "已内嵌 14 套主题、前端资源与 Magpie 轻量引擎；首次运行会把它们解压到",
            f"`%LOCALAPPDATA%\\NOVA Game Space\\runtime\\{ver}`。",
            "",
        ]
    folders = [p for p in manifest["packages"] if p["name"].endswith(".zip")]
    if folders:
        lines += ["**文件夹版** — 想直接改主题 / 换引擎时使用：", ""]
        for entry in folders:
            lines.append(f"- `{entry['name']}`（{entry['size'] / 1048576:.2f} MB）")
        lines.append("")
    lines += [
        "## 系统要求",
        "",
        "- Windows 7 SP1 / 8.1 / 10 / 11（64 位）",
        "- .NET Framework 4.8（Win10 1903+ / 11 通常已内置）",
        "- Microsoft Edge WebView2 Runtime（Win10 / 11 通常已随 Edge 安装）",
        "",
        "## 校验",
        "",
        "```",
    ]
    for entry in manifest["packages"]:
        lines.append(f"{entry['sha256']}  {entry['name']}")
    lines += ["```", "", f"构建时间 {manifest.get('builtUtc', '')}"]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default="")
    parser.add_argument("--tag-only", action="store_true",
                        help="reuse the existing release/tag and only upload assets")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--repo", default=REPO)
    args = parser.parse_args()

    ver = args.version or version()
    manifest_path = DIST / "release-manifest.json"
    if not manifest_path.exists():
        print("dist/release-manifest.json missing; run tools/package-release.py", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("version") != ver:
        print(f"manifest is for {manifest.get('version')}, not {ver}", file=sys.stderr)
        return 1

    tag = f"v{ver}"
    if args.dry_run:
        print(f"[dry-run] would publish {len(manifest['packages'])} asset(s) as {tag}")
        for entry in manifest["packages"]:
            print(f"  {entry['name']}")
        return 0

    auth = token()
    status, existing = request("GET", f"{API}/repos/{args.repo}/releases/tags/{tag}", auth)
    release = existing if status == 200 else None

    if release is None:
        body = {
            "tag_name": tag,
            "name": f"GUGUOVA {ver}",
            "body": release_notes(ver, manifest),
            "draft": False,
            "prerelease": False,
        }
        status, created = request("POST", f"{API}/repos/{args.repo}/releases", auth, body)
        if status not in (200, 201):
            print(f"creating release failed ({status}): {created.get('message')}", file=sys.stderr)
            return 1
        release = created
        print(f"created release {tag}")
    else:
        print(f"reusing existing release {tag}")

    release_id = release["id"]
    uploaded = {asset["name"] for asset in release.get("assets", [])}

    failures = 0
    for entry in manifest["packages"]:
        name = entry["name"]
        path = DIST / name
        if not path.exists():
            print(f"  missing {name}", file=sys.stderr)
            failures += 1
            continue
        if name in uploaded:
            print(f"  skip {name} (already attached)")
            continue
        content_type = "application/octet-stream" if name.endswith(".exe") else "application/zip"
        url = f"{UPLOADS}/repos/{args.repo}/releases/{release_id}/assets?name={name}"
        status, result = request("POST", url, auth, path.read_bytes(), content_type)
        if status in (200, 201):
            print(f"  uploaded {name} ({entry['size'] / 1048576:.2f} MB)")
        else:
            print(f"  upload failed for {name} ({status}): {result.get('message')}", file=sys.stderr)
            failures += 1

    print(f"https://github.com/{args.repo}/releases/tag/{tag}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
