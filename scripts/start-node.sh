#!/usr/bin/env bash
# Erigon v3 archive node manager
#
# Usage:
#   sudo bash scripts/start-node.sh            # Start node (or report if already running)
#   sudo bash scripts/start-node.sh --status    # Show node status
#   sudo bash scripts/start-node.sh --restart   # Kill and restart node
#   sudo bash scripts/start-node.sh --stop      # Stop the node

set -euo pipefail

ERIGON_BIN="/srv/ethnode/erigon/build/bin/erigon"
DATA_DIR="/srv/ethnode/erigon-data"
LOG_FILE="/srv/ethnode/erigon.log"
RPC_URL="http://127.0.0.1:8545"

check_rpc() {
    curl -s --max-time 3 -X POST "$RPC_URL" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        2>/dev/null | grep -q '"result"'
}

get_block() {
    curl -s --max-time 3 -X POST "$RPC_URL" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        | python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))" 2>/dev/null
}

show_status() {
    ERIGON_PID=$(pgrep -f "$ERIGON_BIN" 2>/dev/null | head -1 || true)
    if [ -z "$ERIGON_PID" ]; then
        echo "Erigon: NOT running"
        return 1
    fi
    if ! check_rpc; then
        echo "Erigon: process exists (PID $ERIGON_PID) but RPC not responding"
        return 1
    fi
    BLOCK=$(get_block)
    echo "Erigon: running (PID $ERIGON_PID)"
    echo "Block:  $BLOCK"

    # Check APIs
    TXPOOL=$(curl -s --max-time 3 -X POST "$RPC_URL" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"txpool_status","params":[],"id":1}' 2>/dev/null)
    if echo "$TXPOOL" | grep -q '"pending"'; then
        PENDING=$(echo "$TXPOOL" | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print('pending={} queued={}'.format(int(d['pending'],16), int(d['queued'],16)))" 2>/dev/null)
        echo "APIs:   eth,net,web3,debug,trace,txpool"
        echo "Txpool: $PENDING"
    else
        echo "APIs:   txpool NOT available"
    fi

    # Syncing status
    SYNC=$(curl -s --max-time 3 -X POST "$RPC_URL" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' 2>/dev/null)
    if echo "$SYNC" | grep -q '"result":false'; then
        echo "Sync:   fully synced"
    else
        echo "Sync:   syncing..."
    fi
    echo "Logs:   $LOG_FILE"
    return 0
}

kill_erigon() {
    ERIGON_PID=$(pgrep -f "$ERIGON_BIN" 2>/dev/null | head -1 || true)
    if [ -z "$ERIGON_PID" ]; then
        echo "No Erigon process found."
        return 0
    fi
    echo "Killing Erigon (PID $ERIGON_PID)..."
    kill "$ERIGON_PID" 2>/dev/null || true
    sleep 3
    if kill -0 "$ERIGON_PID" 2>/dev/null; then
        kill -9 "$ERIGON_PID" 2>/dev/null || true
        sleep 2
    fi
    echo "Erigon stopped."
}

start_erigon() {
    echo "Starting Erigon..."
    nohup "$ERIGON_BIN" \
        --datadir="$DATA_DIR" \
        --prune.mode=archive \
        --chain=mainnet \
        --http \
        --http.addr=0.0.0.0 \
        --http.api=eth,net,web3,debug,trace,txpool \
        --caplin.discovery.port=4002 \
        --caplin.discovery.tcpport=4003 \
        > "$LOG_FILE" 2>&1 &

    NEW_PID=$!
    echo "Erigon started (PID $NEW_PID), waiting for RPC..."

    for i in $(seq 1 30); do
        sleep 1
        if check_rpc; then
            BLOCK=$(get_block)
            echo "Node is up at block $BLOCK (${i}s)"
            echo "Logs: $LOG_FILE"
            return 0
        fi
        printf "."
    done

    echo ""
    echo "Warning: RPC not responding after 30s. Check logs: tail -50 $LOG_FILE"
    return 1
}

# ---- Main ----
CMD="${1:-start}"

case "$CMD" in
    --status|-s)
        show_status
        ;;
    --stop)
        kill_erigon
        ;;
    --restart|-r)
        kill_erigon
        start_erigon
        ;;
    start|*)
        # If already running and healthy, just report status
        ERIGON_PID=$(pgrep -f "$ERIGON_BIN" 2>/dev/null | head -1 || true)
        if [ -n "$ERIGON_PID" ] && check_rpc; then
            show_status
            exit 0
        fi
        # Kill broken process if exists
        if [ -n "$ERIGON_PID" ]; then
            echo "Erigon process found but RPC not responding. Killing..."
            kill_erigon
        fi
        start_erigon
        ;;
esac
