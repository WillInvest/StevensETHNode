"""
Bridge Net Flow Indicator

Tracks deposit/withdrawal events on canonical L2 bridges.
Net capital leaving L2s to L1 = risk-off signal (capital seeking safety).
Net capital entering L2s = risk-on / normal activity.

Arbitrum Gateway: 0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a
Optimism Portal: 0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1
"""

import psycopg2
from typing import Optional


def get_bridge_net_flows(
    db_url: str = "postgresql://ethnode:changeme@localhost:5432/ethnode",
    hours: int = 24,
) -> dict:
    """
    Compute 24h net bridge flows from indexed bridge events.

    Uses Shovel-indexed bridge deposit and withdrawal events in the
    PostgreSQL database.

    Returns:
    - net_flow_eth: Positive = capital leaving L2 to L1 (risk-off)
    - arbitrum_flow: Net flow for Arbitrum
    - optimism_flow: Net flow for Optimism
    - signal: -1 to +1 (positive = risk-off)
    """
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        flows = {}

        # Query bridge events from indexed tables
        # Tables: arb_gateway_deposits, arb_gateway_withdrawals,
        #         op_portal_deposits, op_portal_withdrawals
        bridge_tables = {
            "arbitrum": {
                "deposits": "arb_gateway_deposits",
                "withdrawals": "arb_gateway_withdrawals",
            },
            "optimism": {
                "deposits": "op_portal_deposits",
                "withdrawals": "op_portal_withdrawals",
            },
        }

        for bridge, tables in bridge_tables.items():
            deposits_eth = 0.0
            withdrawals_eth = 0.0

            for direction, table in tables.items():
                try:
                    # Check if table exists
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_name = %s
                        )
                    """, (table,))
                    exists = cur.fetchone()[0]

                    if exists:
                        # Sum ETH value in recent blocks
                        # Approximate hours to blocks: ~300 blocks/hour
                        blocks_lookback = hours * 300
                        cur.execute(f"""
                            SELECT COALESCE(SUM(
                                CASE
                                    WHEN ig_value IS NOT NULL THEN ig_value::numeric / 1e18
                                    ELSE 0
                                END
                            ), 0)
                            FROM {table}
                            WHERE block_num > (
                                SELECT COALESCE(MAX(block_num), 0) - %s FROM {table}
                            )
                        """, (blocks_lookback,))

                        val = float(cur.fetchone()[0])
                        if direction == "deposits":
                            deposits_eth = val
                        else:
                            withdrawals_eth = val
                except Exception:
                    continue

            # Net flow: withdrawals - deposits (positive = capital leaving L2)
            net = withdrawals_eth - deposits_eth
            flows[bridge] = {
                "deposits_eth": round(deposits_eth, 4),
                "withdrawals_eth": round(withdrawals_eth, 4),
                "net_eth": round(net, 4),
            }

        cur.close()
        conn.close()

        total_net = sum(f["net_eth"] for f in flows.values())

        # Signal: normalize to -1 to +1
        # > 1000 ETH net outflow in 24h = strong risk-off signal
        signal = max(-1.0, min(1.0, total_net / 1000))

        return {
            "net_flow_eth": round(total_net, 4),
            "bridges": flows,
            "signal": round(signal, 4),
            "hours": hours,
            "interpretation": (
                "Risk-off: capital flowing L2→L1" if total_net > 100
                else "Risk-on: capital flowing L1→L2" if total_net < -100
                else "Neutral bridge flows"
            ),
        }

    except Exception as e:
        return {
            "net_flow_eth": 0.0,
            "bridges": {},
            "signal": 0.0,
            "hours": hours,
            "error": str(e),
        }
