# Stevens Blockchain Analytics — Documentation

Welcome to the documentation for Stevens Blockchain Analytics, an on-chain data analytics platform built on a fully-synced Erigon v3 archive node.

## Contents

- [Architecture](architecture.md) — System design and data flow
- [API Reference](api-reference.md) — All REST and SSE endpoints
- [Deployment](deployment.md) — Production setup with nginx and systemd
- [Adding Protocols](adding-protocols.md) — How to index new smart contracts
- [SCI Methodology](sci-methodology.md) — Stevens Crypto Index scoring

## Quick Start

```bash
# Start the backend API
uvicorn web.app:app --host 0.0.0.0 --port 8000 --reload

# Start the frontend dev server
cd web/frontend && npm run dev -- --host 0.0.0.0

# Run the Shovel indexer
./shovel -config shovel/config.json

# Run tests
pytest tests/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Node | Erigon v3.4.0-dev (mainnet archive) |
| Extraction | Cryo (Paradigm) for bulk, Shovel (indexsupply) for real-time |
| Database | PostgreSQL 14 |
| Backend | FastAPI (Python) |
| Frontend | React 18 + Vite + Recharts + CodeMirror |
| Auth | JWT (cookie-based) |
| Deployment | nginx + systemd |
