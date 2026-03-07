# Deployment Guide

## Prerequisites

- Ubuntu 22.04+ or similar Linux
- PostgreSQL 14+
- Python 3.10+
- Node.js 18+
- Erigon v3 archive node (synced)

## Quick Deploy

```bash
# Run the automated setup
bash deploy/setup.sh
```

This will:
1. Build the frontend
2. Install Python dependencies
3. Install systemd services
4. Configure nginx
5. Start all services

## Manual Setup

### 1. Database

```bash
sudo -u postgres createuser ethnode -P
sudo -u postgres createdb ethnode -O ethnode
psql -U ethnode -d ethnode -f db/schema/00_init.sql
psql -U ethnode -d ethnode -f db/schema/01_uniswap_v3.sql
# ... other schema files
```

### 2. Backend

```bash
pip3 install -r requirements.txt
export ETHNODE_DATABASE_URL="postgres://ethnode:yourpassword@localhost:5432/ethnode"
export JWT_SECRET="your-production-secret"
uvicorn web.app:app --host 127.0.0.1 --port 8000
```

### 3. Frontend

```bash
cd web/frontend
npm ci
npx vite build
```

### 4. nginx

Copy `deploy/nginx.conf` to `/etc/nginx/sites-available/stevens-blockchain` and create a symlink:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/stevens-blockchain
sudo ln -s /etc/nginx/sites-available/stevens-blockchain /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Systemd

```bash
sudo cp deploy/stevens-api.service /etc/systemd/system/
sudo cp deploy/stevens-shovel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stevens-api
sudo systemctl enable --now stevens-shovel
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ETHNODE_DATABASE_URL` | `postgres://ethnode:ethnode@localhost:5432/ethnode` | PostgreSQL connection string |
| `JWT_SECRET` | `stevens-blockchain-dev-secret...` | JWT signing secret (change in production!) |
| `ERIGON_RPC_URL` | `http://127.0.0.1:8545` | Erigon JSON-RPC endpoint |

## Health Check

```bash
bash scripts/health_check.sh
```

## Monitoring

The monitoring dashboard at `/monitoring` shows:
- Database size and table sizes
- Erigon node health and sync status
- Indexer lag (blocks behind chain head)
