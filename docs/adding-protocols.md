# Adding New Protocols

This guide explains how to add a new protocol to the indexing pipeline.

## Steps

### 1. Add Shovel Integration

Edit `shovel/config.json` and add a new entry to the `integrations` array:

```json
{
  "name": "protocol_event_name",
  "enabled": true,
  "sources": [{"name": "mainnet", "start": START_BLOCK}],
  "table": {
    "name": "protocol_event_name",
    "columns": [
      {"name": "log_addr", "type": "bytea"},
      {"name": "your_field", "type": "numeric"}
    ]
  },
  "block": [
    {"name": "chain_id", "column": "chain_id"},
    {"name": "block_num", "column": "block_num"},
    {"name": "tx_hash", "column": "tx_hash"}
  ],
  "event": {
    "name": "EventName",
    "type": "event EventName(address indexed param1, uint256 param2)",
    "inputs": [
      {"name": "param1", "column": "your_field"}
    ],
    "sources": [
      {"address": ["0xCONTRACT_ADDRESS"]}
    ]
  }
}
```

### 2. Create Schema Documentation

Create `db/schema/NN_protocol.sql` with the table definition and indexes:

```sql
CREATE TABLE IF NOT EXISTS protocol_event_name (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    your_field  NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_protocol_event_block ON protocol_event_name (block_num);
```

### 3. Add Meta Protocol Entry

Add to `db/schema/00_init.sql`:

```sql
INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('protocol', 'Protocol description', START_BLOCK)
ON CONFLICT (name) DO NOTHING;
```

### 4. Add Backfill Commands

Add Cryo extraction commands to `scripts/backfill.sh`:

```bash
echo "=== Extracting Protocol events ==="
cryo logs --rpc "$RPC_URL" \
  --contract 0xCONTRACT \
  --topic0 0xEVENT_TOPIC \
  --blocks START:latest \
  --chunk-size 10000 \
  --output-dir "$DATA_DIR/protocol_event"
```

### 5. Restart Shovel

```bash
sudo systemctl restart stevens-shovel
```

Shovel will automatically create the new table and begin indexing from the start block.

## Finding Event Topics

Use `cast` (Foundry) to compute event topic hashes:

```bash
cast sig-event "Transfer(address indexed,address indexed,uint256)"
# 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

Or check Etherscan's "Events" tab for the contract.
