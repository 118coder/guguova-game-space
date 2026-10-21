#!/usr/bin/env python3
"""Smoke-test the one-file release the way a player meets it.

Copies ONLY the single exe into an empty folder, points it at a throwaway data
root, launches it, and checks that:

  * a window + CDP endpoint come up from that empty folder
  * the embedded themes and web assets were extracted and are serving
  * the embedded Magpie engine was extracted and is resolvable as "bundled"
  * no image is broken

This is the regression test for the packaging itself, not for the UI.

  python tools/smoke-single.py
  python tools/smoke-single.py --exe dist/GUGUOVA-1.14.1-single.exe --port 9811
  python tools/smoke-single.py --keep     # keep the temp folder for inspection
"""
import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def version() -> str:
    return json.loads((ROOT / "version.json").read_text(encoding="utf-8"))["version"]


def wait_for_cdp(port: int, deadline: float) -> bool:
    url = f"http://127.0.0.1:{port}/json/version"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def cdp_eval_node(port: int, expression: str):
    """Fallback that reuses the repo's ws dependency through node."""
    script = f"""
const http = require('http');
const WebSocket = require('ws');
const port = {port};
const expression = {json.dumps(expression)};
function get(p) {{ return new Promise((res, rej) => http.get({{host:'127.0.0.1',port,path:p}},(r)=>{{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}}).on('error',rej)); }}
(async () => {{
  const targets = await get('/json/list');
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const cbs = new Map();
  ws.on('message', raw => {{ const m = JSON.parse(raw); if (m.id && cbs.has(m.id)) {{ cbs.get(m.id)(m); cbs.delete(m.id); }} }});
  const send = (method, params={{}}) => new Promise(r => {{ const i = ++id; cbs.set(i, r); ws.send(JSON.stringify({{id:i,method,params}})); }});
  await new Promise(r => ws.on('open', r));
  await send('Runtime.enable');
  const res = await send('Runtime.evaluate', {{ expression: `(async () => {{ ${{expression}} }})()`, awaitPromise: true, returnByValue: true }});
  console.log(JSON.stringify(res.result && res.result.result ? res.result.result.value : null));
  ws.close();
}})().catch(e => {{ console.error(String(e)); process.exit(1); }});
"""
    output = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True,
                            text=True, timeout=90)
    if output.returncode != 0:
        raise RuntimeError(output.stderr.strip() or "node cdp eval failed")
    return json.loads(output.stdout.strip() or "null")


def kill_stray_launchers():
    """A leftover launcher owns the single-instance lock and would receive this
    run's activation instead of showing our test window (measured as "only 1
    theme loaded"). Only processes started from a temp/single-exe path are
    touched, never the player's installed copy."""
    try:
        out = subprocess.run(["wmic", "process", "where",
                              "(name like '%GUGUOVA%')", "get", "ProcessId,ExecutablePath"],
                             capture_output=True, text=True, timeout=20).stdout
    except Exception:
        return
    for line in out.splitlines():
        if "GUGUOVA" not in line:
            continue
        parts = line.strip().rsplit(None, 1)
        if len(parts) != 2 or not parts[1].isdigit():
            continue
        path, pid = parts[0], parts[1]
        lowered = path.lower()
        if "guguova-single-" in lowered or lowered.endswith("-single.exe"):
            subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True)


def free_port(start: int) -> int:
    for port in range(start, start + 40):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("no free port")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", default="")
    parser.add_argument("--port", type=int, default=9800)
    parser.add_argument("--timeout", type=float, default=90)
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()

    exe = Path(args.exe) if args.exe else DIST / f"GUGUOVA-{version()}-single.exe"
    if not exe.is_absolute():
        exe = (ROOT / exe).resolve()
    if not exe.exists():
        print(f"missing single exe: {exe}", file=sys.stderr)
        return 1

    workdir = Path(tempfile.mkdtemp(prefix="guguova-single-"))
    data_root = workdir / "data"
    launch_dir = workdir / "app"
    launch_dir.mkdir()
    target = launch_dir / "GUGUOVA.exe"
    shutil.copy2(exe, target)

    kill_stray_launchers()
    port = free_port(args.port)
    env = dict(os.environ)
    env["NOVA_CDP_PORT"] = str(port)
    env["NOVA_DATA_ROOT"] = str(data_root)
    env.pop("NOVA_DEV", None)

    print(f"launching {target.name} from an empty folder (CDP {port})")
    process = subprocess.Popen([str(target)], cwd=str(launch_dir), env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    failures = []
    try:
        if not wait_for_cdp(port, time.time() + args.timeout):
            failures.append("the launcher never exposed CDP — it did not start cleanly")
        else:
            payload = cdp_eval_node(port, """
                const status = await window.nova.call('magpieStatus');
                const themes = (window.NovaTheme.themes || []).length;
                const broken = [...document.images]
                  .filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute('src'))
                  .length;
                const sheets = [...document.querySelectorAll('link[rel=stylesheet]')]
                  .filter((link) => link.getAttribute('href') && !link.sheet).length;
                return { bundled: status.bundled, engine: status.exePath,
                         available: status.available, themes, broken, badSheets: sheets };
            """)
            print("  " + json.dumps(payload, ensure_ascii=False))
            # 14 = 13 folder themes + the built-in "nova" theme, which lives in
            # the binary and never lands on disk.
            if payload.get("themes", 0) < 14:
                failures.append(f"only {payload.get('themes')} themes loaded (expected 14)")
            if payload.get("broken"):
                failures.append(f"{payload['broken']} broken image(s)")
            if payload.get("badSheets"):
                failures.append(f"{payload['badSheets']} stylesheet(s) failed to load")
            if not payload.get("available"):
                failures.append("engine not resolvable")
            elif not payload.get("bundled"):
                failures.append("engine resolved to an external Magpie instead of the embedded one")

        runtime = data_root / "runtime"
        extracted = list(runtime.glob("*/engine/magpie/Magpie.exe")) if runtime.exists() else []
        if not extracted:
            failures.append("embedded engine was not extracted under NOVA_DATA_ROOT")
        else:
            print(f"  extracted engine: {extracted[0]}")
        themes_dir = data_root / "themes"
        theme_count = len([p for p in themes_dir.iterdir() if p.is_dir()]) if themes_dir.exists() else 0
        if theme_count < 13:
            failures.append(f"only {theme_count} themes seeded into the data root (expected 13 folders)")
    finally:
        try:
            process.terminate()
            process.wait(timeout=15)
        except Exception:
            try:
                process.kill()
            except Exception:
                pass
        if args.keep:
            print(f"kept: {workdir}")
        else:
            shutil.rmtree(workdir, ignore_errors=True)

    if failures:
        print(f"\n✗ single-exe smoke test failed ({len(failures)}):")
        for failure in failures:
            print("  - " + failure)
        return 1
    print("\n✓ single exe starts from an empty folder with embedded themes + engine")
    return 0


if __name__ == "__main__":
    sys.exit(main())
