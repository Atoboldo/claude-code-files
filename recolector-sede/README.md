# Recolector de estado de máquinas (sede sin MikroTik)

Para sedes donde **no se puede instalar un MikroTik ni abrir puertos** (por ejemplo
un hotel que sólo nos deja usar su red). Un mini-PC con Ubuntu, dentro de la red
dedicada de la sede, hace de puente: comprueba el estado de todas las Pis y **envía
los datos hacia fuera** al servidor central donde está el dashboard.

Todo el tráfico es **saliente** (POST HTTPS). No requiere abrir ningún puerto ni
tocar la configuración de red del hotel.

## Qué envía

Por cada máquina, en cada ciclo:

| Campo | Descripción |
|---|---|
| `id` | Identificador de la máquina |
| `ip` | IP local en la red de la sede |
| `online` | `true` si responde a ping, `false` si no |
| `last_seen` | Última vez que respondió (ISO 8601 UTC) |
| `offline_seconds` | Segundos que lleva fuera de línea (0 si online, `null` si nunca se vio) |
| `checked_at` | Momento del chequeo |

El payload que se manda al servidor:

```json
{
  "sede": "hotel-quinta-sede",
  "checked_at": "2026-07-22T09:00:00+00:00",
  "machines": [
    { "id": "...", "ip": "...", "online": true, "last_seen": "...", "offline_seconds": 0, "checked_at": "..." }
  ]
}
```

## Instalación en el mini-PC (Ubuntu)

```bash
# 1. Copiar la carpeta al equipo
sudo mkdir -p /opt/recolector-sede
sudo cp collector.py config.example.json requirements.txt /opt/recolector-sede/

# 2. Crear la configuración real
sudo cp /opt/recolector-sede/config.example.json /opt/recolector-sede/config.json
sudo nano /opt/recolector-sede/config.json   # poner endpoint, sede y la lista de máquinas

# 3. Entorno de Python
cd /opt/recolector-sede
sudo python3 -m venv venv
sudo ./venv/bin/pip install -r requirements.txt

# 4. Usuario de servicio (sin login)
sudo useradd -r -s /usr/sbin/nologin recolector || true
sudo chown -R recolector:recolector /opt/recolector-sede

# 5. Servicio systemd (arranca solo y se reinicia si falla)
sudo cp recolector.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now recolector

# Ver que está funcionando
systemctl status recolector
journalctl -u recolector -f
```

## Configuración (`config.json`)

- `sede`: nombre que identifica esta sede en el dashboard.
- `endpoint`: URL del servidor central que recibe los datos (**pendiente de rellenar**).
- `auth_token`: si el servidor pide token, se manda como `Authorization: Bearer ...`.
- `interval_seconds`: cada cuánto se comprueban las máquinas (por defecto 30 s).
- `machines`: lista de `{ "id": ..., "ip": ... }` con las Pis de la sede.

## Pendiente de confirmar

- **URL exacta del endpoint** del servidor central y si lleva token de autenticación.
- **Formato exacto** que espera el dashboard (ajustar el `payload` en `collector.py`
  si el servidor actual usa otros nombres de campo).
- **Lista real de máquinas** de esta sede (id + ip).
