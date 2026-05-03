# reserv — VPN Backup Service

A minimalist backup site for a VPN service. When the main server goes offline, users receive a temporary VLESS key issued via a **3x-ui / MHSanaei** panel. Keys are automatically revoked when the main server comes back online via an **Uptime Kuma** webhook.

## Features

- **One-click anonymous key issuance** – no authentication required for end users.
- **1.5 GiB traffic cap** per temporary key.
- **Auto-revoke on recovery** – Uptime Kuma webhook deletes all active keys from 3x-ui when the main server reports `UP`.
- **Admin panel** (`/admin`) – CRUD management for servers and 3x-ui panels, view/revoke issued keys.
- **No index / no cache** – all pages send `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
- **Secure secret storage** – 3x-ui passwords are stored AES-256-GCM encrypted in the database.
- **Docker Compose** deployment with PostgreSQL.

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/Noobxik/reserv.git
cd reserv
cp .env.example .env
```

Edit `.env`:

| Variable | Description | How to generate |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (set automatically by docker-compose) | — |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) for AES-256-GCM | `openssl rand -hex 32` |
| `JWT_SECRET` | Random string for signing admin session tokens | `openssl rand -base64 48` |
| `ADMIN_SECRET` | Plain-text password for the `/admin` panel | any secure string |
| `UPTIME_KUMA_SECRET` | Shared secret for the Uptime Kuma webhook | `openssl rand -hex 16` |
| `NEXT_PUBLIC_BASE_URL` | Public URL of this service | e.g. `https://backup.example.com` |

### 2. Start with Docker Compose

```bash
docker compose up -d --build
```

The service listens on port **3000** by default. Override with `PORT=8080` in `.env`.

### 3. Run database migrations (first run)

Migrations are applied automatically on container start. To run them manually:

```bash
docker compose exec web npx prisma migrate deploy
```

### 4. Configure servers and panels

1. Open `http://localhost:3000/admin`
2. Log in with your `ADMIN_SECRET` password.
3. **Panels tab** – add your 3x-ui panel URL, username and password.
4. **Servers tab** – add your main server(s) (type = `main`) and at least one reserve server (type = `reserve`) linked to a panel with the correct inbound ID.
   - Set the **Uptime Monitor ID** to the monitor name or numeric ID in Uptime Kuma.

### 5. Configure Uptime Kuma

In Uptime Kuma, add a **Webhook** notification to your monitor:

- **URL**: `https://backup.example.com/api/uptime-kuma/webhook?secret=YOUR_UPTIME_KUMA_SECRET`
- **Content type**: `application/json`
- **Method**: `POST`

> Uptime Kuma sends the webhook on both UP and DOWN events. The service only acts on UP events (revokes all keys).

---

## Pages

| Path | Description |
|---|---|
| `/` | Home – one-click temporary key issuance |
| `/status` | Server status overview |
| `/admin` | Admin panel (password protected) |

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/issue-temp-key` | Issue a temporary VLESS key (anonymous) |
| `GET` | `/api/status` | JSON server status list |
| `POST` | `/api/uptime-kuma/webhook?secret=…` | Uptime Kuma webhook receiver |
| `POST` | `/api/admin/auth` | Admin login |
| `DELETE` | `/api/admin/auth` | Admin logout |
| `GET/POST` | `/api/admin/servers` | List / create servers |
| `GET/PUT/DELETE` | `/api/admin/servers/:id` | Get / update / delete server |
| `GET/POST` | `/api/admin/panels` | List / create 3x-ui panels |
| `GET/PUT/DELETE` | `/api/admin/panels/:id` | Get / update / delete panel |
| `GET` | `/api/admin/keys` | List all issued keys |
| `DELETE` | `/api/admin/keys/:id` | Manually revoke a key |

---

## Development

```bash
npm install
cp .env.example .env   # fill in values
npx prisma generate
npx prisma db push     # or: npx prisma migrate dev
npm run dev
```

---

## Technology Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- **Prisma** ORM + **PostgreSQL**
- **3x-ui / MHSanaei** REST API for client management
- **Uptime Kuma** webhook for server monitoring
- **Docker Compose** for production deployment

---

## Security Notes

- 3x-ui passwords are encrypted with **AES-256-GCM** before storage.
- Admin session tokens are **JWT HS256** (24-hour expiry).
- Password comparison uses **constant-time** (`crypto.timingSafeEqual`).
- All pages send `X-Robots-Tag: noindex, nofollow` and `X-Frame-Options: DENY`.