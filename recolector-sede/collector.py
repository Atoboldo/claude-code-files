#!/usr/bin/env python3
"""
Recolector de estado de maquinas para una sede.

Instalado en un mini-PC (Ubuntu) dentro de la red dedicada del hotel.
Cada intervalo hace ping a cada Pi de la lista y envia al servidor central
(donde vive el dashboard) el estado: id, ip, online, ultimo visto y tiempo
fuera de linea.

Solo hace conexiones SALIENTES (POST HTTPS). No abre ningun puerto.
"""

import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# --- Configuracion (se puede sobreescribir con variables de entorno) ---
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get("COLLECTOR_CONFIG", BASE_DIR / "config.json"))
STATE_PATH = Path(os.environ.get("COLLECTOR_STATE", BASE_DIR / "state.json"))


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    # Valores por defecto
    cfg.setdefault("interval_seconds", 30)
    cfg.setdefault("ping_timeout_seconds", 1)
    cfg.setdefault("sede", "sede-desconocida")
    cfg.setdefault("verify_tls", True)
    return cfg


def load_state():
    if STATE_PATH.exists():
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state):
    tmp = STATE_PATH.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    tmp.replace(STATE_PATH)


def is_online(ip, timeout_seconds):
    """Devuelve True si la maquina responde a un ping. Sin necesidad de root."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", str(timeout_seconds), ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return result.returncode == 0
    except Exception:
        return False


def check_all(cfg, state):
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    report = []

    for machine in cfg["machines"]:
        mid = machine["id"]
        ip = machine["ip"]
        online = is_online(ip, cfg["ping_timeout_seconds"])

        m_state = state.get(mid, {})
        last_seen = m_state.get("last_seen")

        if online:
            last_seen = now_iso
            offline_seconds = 0
        else:
            if last_seen:
                delta = now - datetime.fromisoformat(last_seen)
                offline_seconds = int(delta.total_seconds())
            else:
                # Nunca la hemos visto online
                offline_seconds = None

        state[mid] = {"last_seen": last_seen}

        report.append(
            {
                "id": mid,
                "ip": ip,
                "online": online,
                "last_seen": last_seen,
                "offline_seconds": offline_seconds,
                "checked_at": now_iso,
            }
        )

    return report


def send(cfg, report):
    payload = {
        "sede": cfg["sede"],
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "machines": report,
    }
    headers = {"Content-Type": "application/json"}
    token = cfg.get("auth_token")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    resp = requests.post(
        cfg["endpoint"],
        json=payload,
        headers=headers,
        timeout=15,
        verify=cfg["verify_tls"],
    )
    resp.raise_for_status()


def main():
    cfg = load_config()
    state = load_state()
    print(f"[recolector] sede={cfg['sede']} maquinas={len(cfg['machines'])} "
          f"intervalo={cfg['interval_seconds']}s endpoint={cfg['endpoint']}")

    while True:
        try:
            report = check_all(cfg, state)
            save_state(state)
            send(cfg, report)
            online = sum(1 for m in report if m["online"])
            print(f"[{datetime.now().isoformat(timespec='seconds')}] "
                  f"enviado: {online}/{len(report)} online")
        except Exception as e:
            print(f"[error] {e}")
        time.sleep(cfg["interval_seconds"])


if __name__ == "__main__":
    main()
