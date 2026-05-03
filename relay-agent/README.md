# Fitro360 On-Prem Relay Agent

Most biometric readers (ZKTeco, ESSL, Realtime, Hikvision, Suprema, …) sit on
the gym's local network and cannot reach our cloud directly. This agent runs
on any always-on PC at the gym, polls the Fitro360 cloud for queued commands
(door-open, enrol, delete), executes them on the device over the LAN, and
acknowledges the result back to the cloud.

It is a small Node.js program with **zero npm dependencies** — easy to audit,
easy to package as a single binary, easy to run in Docker.

## Brand support status

| Brand                            | Open door | Enroll / delete | Notes                                            |
| -------------------------------- | --------- | --------------- | ------------------------------------------------ |
| `zkteco`, `essl`, `realtime`     | ✅        | ✅              | Production-ready (ADMS HTTP push)                |
| `hikvision`                      | ✅        | ✅              | Production-ready (ISAPI + Digest auth)           |
| `suprema`, `matrix`, `anviz`, `dahua`, `idemia`, `virdi`, `hid` | ⚠️ | ⚠️ | Fallback dispatcher — commands ack as **failed** until a brand-specific handler is added in `src/dispatchers/`. |

Validate any brand on at least one physical reader of that exact firmware
revision before relying on it for unattended access — ZKTeco/ESSL ADMS
command formatting in particular varies slightly between firmwares.

---

## 1. Get the device secret

1. Sign in to Fitro360 as gym owner / manager.
2. Go to **Devices**, click **Add device**, fill in brand, serial, and LAN
   address.
3. Copy the **secret** shown once on the success screen — you will paste it
   into `config.json` below. (It is never shown again; if lost, delete the
   device and add it back.)

## 2. Install

### Option A — Windows (recommended, single .exe)

The Windows release is a single self-contained `fitro360-relay.exe` —
**no Node.js install required** on the gym PC. The download includes a
one-click `install.bat` that runs the setup wizard and registers the
agent as a Windows boot service for you.

1. Download `fitro360-relay-windows-vX.Y.Z.zip` from your Fitro360
   dashboard → **Devices → Download relay agent**.
2. Unzip the folder anywhere (e.g. `C:\Fitro360`).
3. **Right-click `install.bat` → "Run as administrator"**.
4. Answer the wizard prompts (cloud URL, brand, serial, secret, device
   IP, admin user/password). The secret input is masked.
5. Done — the agent is running and will auto-start on every boot. The
   config lives at `C:\ProgramData\Fitro360\config.json`, locked down
   to Administrators / SYSTEM only.

To uninstall: right-click `uninstall.bat` → Run as administrator.

To re-run the wizard later (e.g. add another device):

```cmd
"C:\path\to\fitro360-relay.exe" --setup
```

To check status: `schtasks /Query /TN Fitro360Relay /V /FO LIST`

**Building the release zip** (only needed if you're producing a fresh
build for distribution — operators don't need this):

```bash
cd relay-agent
npm install -g @yao-pkg/pkg     # one-time, on the build machine
bash scripts/build-windows.sh
# → dist/fitro360-relay-windows-vX.Y.Z.zip
```

### Option B — Linux (Debian / Ubuntu)

```bash
sudo apt-get install -y nodejs       # Node.js 18+
cd /path/to/relay-agent
sudo bash scripts/install-linux.sh
sudo nano /etc/fitro360/config.json  # fill in cloudUrl + devices
sudo systemctl start fitro360-relay
sudo journalctl -u fitro360-relay -f
```

**Build a `.deb` for fleet rollout:**

```bash
cd relay-agent
bash packaging/build-deb.sh
sudo dpkg -i dist/fitro360-relay_1.0.0_all.deb
sudo nano /etc/fitro360/config.json
sudo systemctl start fitro360-relay
```

The `.deb` installs the agent under `/opt/fitro360-relay`, the systemd
unit under `/lib/systemd/system/fitro360-relay.service`, the config
example under `/etc/fitro360/`, and creates the `fitro360` system user.

You can also run the wizard on Linux:
`sudo /opt/fitro360-relay/src/index.js --setup`.

### Option C — Docker (any OS with Docker)

```bash
cd relay-agent
docker build -t fitro360/relay-agent .
mkdir -p /etc/fitro360
cp config.example.json /etc/fitro360/config.json
$EDITOR /etc/fitro360/config.json
docker run -d --name fitro360-relay --restart unless-stopped \
  --network host \
  -v /etc/fitro360:/etc/fitro360:ro \
  fitro360/relay-agent
docker logs -f fitro360-relay
```

`--network host` lets the container reach the LAN devices directly. On
Windows / Mac Docker Desktop, replace it with explicit `-p` mappings or run
the agent natively (Option A or B) instead.

## 3. What URL does the device point to?

**Nothing.** In relay mode the biometric device does not need to reach
the internet, and you do **not** need to configure a webhook URL on the
device for outbound traffic to the cloud. The relay agent itself makes
all cloud-bound calls (outbound HTTPS to your `cloudUrl`) and all
device-bound calls (LAN HTTP/HTTPS to `host:port`).

If you also want event-driven push (so members swiping in shows up
instantly rather than only when the cloud queues a command), point the
device's webhook at:

```
http://<gym-pc-lan-ip>:<port-the-relay-listens-on>/api/biometric/<brand>/webhook
```

— but this is optional and not required for the queued-command flow this
agent ships with.

## 4. Configure

`config.json`:

```json
{
  "cloudUrl": "https://app.fitro360.com",
  "pollIntervalMs": 5000,
  "logLevel": "info",
  "devices": [
    {
      "serial": "ZK-XXXX-1234",
      "secret": "the-secret-you-copied-from-the-devices-page",
      "brand": "zkteco",
      "host": "192.168.1.50",
      "port": 80,
      "username": "admin",
      "password": "device-admin-password"
    }
  ]
}
```

| Field            | Required | Notes                                                                |
| ---------------- | -------- | -------------------------------------------------------------------- |
| `cloudUrl`       | yes      | The Fitro360 base URL (e.g. `https://app.fitro360.com`).             |
| `pollIntervalMs` | no       | Default 5000. Minimum 1000.                                          |
| `logLevel`       | no       | `debug` \| `info` \| `warn` \| `error`. Default `info`.              |
| `devices[].serial` | yes    | Same value you entered when adding the device in the dashboard.      |
| `devices[].secret` | yes    | The one-time secret from the Devices page.                           |
| `devices[].brand`  | yes    | `zkteco`, `essl`, `realtime`, `hikvision`, `suprema`, …              |
| `devices[].host`   | yes    | LAN IP or DNS of the reader.                                         |
| `devices[].port`   | no      | Defaults: 80 (ZKTeco/ESSL HTTP), 443 (Hikvision HTTPS).              |
| `devices[].username` / `password` | no | **Device-local** admin / comm-key credentials. Required for Hikvision ISAPI Digest auth and for ZKTeco devices configured with a comm key. **Never reuse the cloud `secret` here** — they authenticate to two different systems and leaking the cloud secret on the LAN would let an attacker forge cloud polls/acks. |

You can list **multiple devices** in one `config.json` — each is polled
independently.

## 5. Verify it works

1. In the dashboard, open **Devices** → click **Test unlock** on your device.
2. Within `pollIntervalMs` you should see in the agent log:
   ```
   [ZK-XXXX-1234] received 1 command(s)
   [zkteco ZK-XXXX-1234] queued open (HTTP 200)
   [ZK-XXXX-1234] ack <id> done
   ```
3. The dashboard's command status flips to **completed**.

If you see `bad signature (wrong secret?)`, the `secret` in `config.json`
does not match the one stored in the cloud — re-add the device and copy
the new secret.

## 6. How it works (security model)

* The agent makes **outbound HTTPS** calls only — no inbound ports are
  opened on the gym network.
* Every request is signed with `HMAC-SHA256(secret, "<METHOD>:<URL_PATH>")`
  in the `X-Fitro360-Sig` header. The cloud verifies the signature with a
  constant-time compare; an attacker who knows a command id but not the
  secret cannot mark it done or forge polls.
* The secret is stored only in `config.json` (mode `0600`, owned by the
  `fitro360` system user on Linux).
* Commands are marked `picked_up` on the cloud as soon as the relay
  fetches them; if the agent crashes between fetch and ack, the
  command will sit in `picked_up` and **not** be auto-redelivered. The
  dashboard surfaces stuck commands so an operator can re-trigger
  them. (Automatic re-delivery after a stale-pickup timeout is on the
  backend roadmap.)
* `cloudUrl` must be `https://` in production — the agent refuses to
  start with a plaintext `http://` URL unless you explicitly opt in
  via `"allowInsecureCloudUrl": true` (intended for local dev only).
* **LAN TLS:** the Hikvision dispatcher tolerates self-signed certificates
  on the device (`rejectUnauthorized: false` on the local HTTPS call).
  Almost every shipped reader uses a self-signed cert; if your environment
  pins device certs, edit `src/dispatchers/hikvision.js` to flip this flag
  back on. The cloud-bound traffic is unaffected and always validates TLS.

## 7. Files in this folder

```
relay-agent/
├── README.md                 ← this file
├── package.json              ← zero runtime deps
├── config.example.json       ← copy to config.json and edit
├── Dockerfile                ← `docker build .` for a container image
├── scripts/
│   ├── install-linux.sh      ← root installer + systemd unit setup
│   ├── install-windows.ps1   ← elevated installer + Scheduled Task
│   └── fitro360-relay.service
└── src/
    ├── index.js              ← CLI entrypoint
    ├── config.js             ← config loader + validation
    ├── logger.js
    ├── poller.js             ← per-device poll loop
    ├── api.js                ← HMAC-signed cloud calls
    └── dispatchers/          ← per-brand local execution
        ├── zkteco.js         (zkteco / essl / realtime)
        ├── hikvision.js      (ISAPI + Digest auth)
        └── generic.js        (fallback for other brands)
```

## 8. Troubleshooting

| Symptom                                        | Fix                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `device not registered` on poll                 | Device wasn't created in the cloud, or `serial` mismatches. Re-add it.               |
| `bad signature (wrong secret?)`                 | `secret` in config doesn't match cloud. Re-add the device for a new secret.          |
| Agent runs but the door doesn't open            | Check the device log — `username`/`password` may be wrong, or the device is offline. |
| `device request timeout`                        | LAN routing issue between the agent host and the reader.                             |
| You changed config but nothing happened         | Restart: `sudo systemctl restart fitro360-relay` (Linux) / Task Scheduler (Windows). |
