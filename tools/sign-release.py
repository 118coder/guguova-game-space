#!/usr/bin/env python3
"""Sign the release binaries with signtool, when a certificate is wired.

The SmartScreen "unknown publisher" warning only goes away with a code
signing certificate; this step keeps the release pipeline ready for one
without making it a requirement. Enable by exporting either:

  GUGUOVA_CERT_SHA1    thumbprint of a cert in the user cert store, or
  GUGUOVA_PFX_PATH / GUGUOVA_PFX_PASSWORD    a PFX file

Without either, the script exits 0 with a notice and the build stays
unsigned. Timestamping uses a public RFC 3161 TSA so signatures outlive
the certificate.
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TSA = "http://timestamp.digicert.com"


def find_signtool():
    found = subprocess.run(["where", "signtool"], capture_output=True, text=True)
    if found.returncode == 0 and found.stdout.strip():
        return found.stdout.strip().splitlines()[0]
    kits = Path(r"C:\Program Files (x86)\Windows Kits\10\bin")
    if kits.is_dir():
        versions = sorted((p for p in kits.iterdir() if p.name.startswith("10.")),
                          key=lambda p: p.name, reverse=True)
        for version in versions:
            candidate = version / "x64" / "signtool.exe"
            if candidate.exists():
                return str(candidate)
    return None


def targets(config: str):
    out = []
    legacy = ROOT / "legacy" / "bin" / config / "net48"
    if legacy.is_dir():
        out.extend(sorted(legacy.glob("*.exe")))
    modern = ROOT / "bin" / config / "net10.0-windows" / "win-x64"
    if modern.is_dir():
        out.extend(sorted(modern.glob("*.exe")))
    return out


def main() -> int:
    sha1 = os.environ.get("GUGUOVA_CERT_SHA1", "").strip()
    pfx = os.environ.get("GUGUOVA_PFX_PATH", "").strip()
    pfx_password = os.environ.get("GUGUOVA_PFX_PASSWORD", "")
    if not sha1 and not pfx:
        print("sign: skipped (no GUGUOVA_CERT_SHA1 / GUGUOVA_PFX_PATH)")
        return 0

    signtool = find_signtool()
    if not signtool:
        print("sign: FAILED - signtool not found (install the Windows SDK)")
        return 1

    files = targets(os.environ.get("GUGUOVA_CONFIG", "Release"))
    if not files:
        print("sign: FAILED - no built exe found to sign")
        return 1

    for file in files:
        command = [signtool, "sign", "/fd", "SHA256", "/tr", TSA, "/td", "SHA256"]
        if sha1:
            command += ["/sha1", sha1]
        else:
            command += ["/f", pfx]
            if pfx_password:
                command += ["/p", pfx_password]
        command.append(str(file))
        print(f"sign: {file.name}")
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            print(result.stdout[-800:])
            print(result.stderr[-800:])
            print(f"sign: FAILED - {file.name}")
            return 1
    print(f"sign: {len(files)} file(s) signed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
