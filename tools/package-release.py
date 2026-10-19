#!/usr/bin/env python3
"""Package the offline release.

Default (recommended): the .NET Framework 4.8 legacy host, ~7 MB, Windows
7 SP1 / 8.1 / 10 / 11 x64, requiring .NET Framework 4.8 + WebView2.
Optional: a self-contained .NET 10 modern host (large) for machines without
.NET Framework 4.8; the pipeline can publish it with --modern.
"""
import argparse
import hashlib
import json
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
META = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
VERSION = META["version"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_tree(source: Path, destination: Path, skip_names=()):
    if not source.exists():
        raise SystemExit(f"missing build output: {source}")
    destination.mkdir(parents=True, exist_ok=True)
    for item in source.rglob("*"):
        if item.is_dir():
            continue
        rel = item.relative_to(source)
        if any(part in skip_names for part in rel.parts):
            continue
        if item.suffix.lower() in {".pdb"}:
            continue
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)


def write_legacy_readme(stage: Path):
    text = f"""NOVA Game Space {VERSION} · Legacy
========================================

离线单机启动器。游戏库、游玩记录、封面与备份全部保存在本机。

启动
  launch.cmd

系统
  Windows 7 SP1 / 8.1 / 10 / 11（64 位）
  这是 Legacy 宿主：.NET Framework 4.8 + WebView2。

依赖
  · .NET Framework 4.8
    Windows 10 1903+ / 11 通常已内置；Win7 SP1 / 8.1 需要安装。
  · Microsoft Edge WebView2 Runtime
    Windows 10 / 11 通常已随 Edge 安装；Win7 / 8.1 请使用 109 版。
    完全离线时，可把 109 固定运行时解压到：
      WebView2Runtime\\msedgewebview2.exe
  launch.cmd 会检查这两项，缺失时给出说明。

数据目录
  %LOCALAPPDATA%\\NOVA Game Space
  library.json / media / backups / webview2

迁移
  设置 → 数据与备份 → 导出 .nova-pack
  复制到另一台电脑后导入；游戏程序路径可在「游戏详情 → 管理 → 编辑」重新指定。

说明
  · 数据包不包含游戏本体与主题。
  · 主题在程序目录 themes\\；可单独复制。
  · 测试用假游戏默认隐藏；开发者使用 NOVA_DEV=1 或 Ctrl+Shift+D 查看。
  · 缓存默认在数据目录 webview2\\，可通过 NOVA_CACHE_ROOT 指向其他磁盘。

版本
  {VERSION} · {datetime.now(timezone.utc).strftime('%Y-%m-%d')}
"""
    (stage / "README.txt").write_text(text, encoding="utf-8")


def make_zip(stage: Path, output: Path):
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for item in stage.rglob("*"):
            if item.is_file():
                archive.write(item, item.relative_to(stage.parent))
    return output


def package_legacy(config: str):
    source = ROOT / "legacy" / "bin" / config / "net48"
    stage = DIST / f"NOVA-{VERSION}-legacy"
    if stage.exists():
        shutil.rmtree(stage)
    copy_tree(source, stage)
    shutil.copy2(ROOT / "tools" / "launch-legacy.cmd", stage / "launch.cmd")
    shutil.copy2(ROOT / "version.json", stage / "version.json")
    write_legacy_readme(stage)
    fixed = stage / "WebView2Runtime"
    fixed.mkdir(exist_ok=True)
    (fixed / "README.txt").write_text(
        "把 WebView2 109 固定运行时解压到这里，确保本目录包含 msedgewebview2.exe。\n"
        "如果系统已安装 WebView2 Runtime，则不需要这个目录。\n",
        encoding="utf-8")
    return stage


def package_modern(config: str, modern_dir: Path):
    stage = DIST / f"NOVA-{VERSION}-modern"
    if stage.exists():
        shutil.rmtree(stage)
    copy_tree(modern_dir, stage, skip_names={"docs"})
    (stage / "launch.cmd").write_text(
        "@echo off\r\nchcp 65001 >nul\r\ncd /d \"%~dp0\"\r\nstart \"\" NovaGameSpace.exe\r\n",
        encoding="utf-8")
    shutil.copy2(ROOT / "version.json", stage / "version.json")
    readme = f"""NOVA Game Space {VERSION} · Modern
====================================

自包含 .NET 10 版本（体积较大，无需安装 .NET）。
需要 Microsoft Edge WebView2 Runtime（Win10/11 通常已随 Edge 安装）。
启动：launch.cmd

数据和迁移方式与 Legacy 版相同：
  %LOCALAPPDATA%\\NOVA Game Space
  设置 → 数据与备份 → 导出/导入 .nova-pack
"""
    (stage / "README.txt").write_text(readme, encoding="utf-8")
    return stage


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="Release")
    parser.add_argument("--modern-dir", default="")
    parser.add_argument("--no-zip", action="store_true")
    args = parser.parse_args()

    DIST.mkdir(exist_ok=True)
    packages = []

    legacy = package_legacy(args.config)
    if not args.no_zip:
        packages.append(make_zip(legacy, DIST / f"{legacy.name}.zip"))
    else:
        packages.append(legacy)

    if args.modern_dir:
        modern = package_modern(args.config, Path(args.modern_dir))
        if not args.no_zip:
            packages.append(make_zip(modern, DIST / f"{modern.name}.zip"))
        else:
            packages.append(modern)

    manifest = {
        "version": VERSION,
        "builtUtc": datetime.now(timezone.utc).isoformat(),
        "packages": [
            {
                "name": path.name,
                "size": path.stat().st_size,
                "sha256": sha256(path) if path.is_file() else None,
            }
            for path in packages
        ],
    }
    (DIST / "release-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for path in packages:
        print(f"{path.name}: {path.stat().st_size / 1024 / 1024:.2f} MB")
    print(f"manifest: {DIST / 'release-manifest.json'}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:
        print(f"package failed: {error}", file=sys.stderr)
        raise
