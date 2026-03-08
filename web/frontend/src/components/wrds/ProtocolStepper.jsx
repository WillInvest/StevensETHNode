/**
 * Top-level orchestrator for the 3-step WRDS selection flow:
 *   Step 1: Protocol grid
 *   Step 2: Version picker
 *   Step 3: Dataset list
 *   Step 4: Query form
 */

import { useState } from "react";
import { DATASET_REGISTRY } from "../../config/datasetRegistry.js";
import ProtocolGrid from "./ProtocolGrid.jsx";
import VersionPicker from "./VersionPicker.jsx";
import DatasetList from "./DatasetList.jsx";
import QueryForm from "./QueryForm.jsx";

export default function ProtocolStepper({ onOpenInSQLEditor }) {
  const [protocol, setProtocol] = useState(null);
  const [version, setVersion] = useState(null);
  const [dataset, setDataset] = useState(null);

  const reset = (to = 0) => {
    if (to <= 0) { setProtocol(null); setVersion(null); setDataset(null); }
    if (to <= 1) { setVersion(null); setDataset(null); }
    if (to <= 2) { setDataset(null); }
  };

  return (
    <div>
      {/* ── Breadcrumb ── */}
      <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, flexWrap: "wrap" }}>
        <button
          onClick={() => reset(0)}
          style={crumbStyle(!protocol)}
        >
          Protocols
        </button>
        {protocol && (
          <>
            <span style={{ color: "var(--text-tertiary)" }}>›</span>
            <button onClick={() => reset(1)} style={crumbStyle(!version)}>
              {protocol.label}
            </button>
          </>
        )}
        {version && (
          <>
            <span style={{ color: "var(--text-tertiary)" }}>›</span>
            <button onClick={() => reset(2)} style={crumbStyle(!dataset)}>
              {version.label}
            </button>
          </>
        )}
        {dataset && (
          <>
            <span style={{ color: "var(--text-tertiary)" }}>›</span>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{dataset.label}</span>
          </>
        )}
      </nav>

      {/* ── Steps ── */}
      {!protocol && (
        <ProtocolGrid protocols={DATASET_REGISTRY} onSelect={setProtocol} />
      )}
      {protocol && !version && (
        <VersionPicker protocol={protocol} onSelect={setVersion} />
      )}
      {version && !dataset && (
        <DatasetList version={version} onSelect={setDataset} />
      )}
      {dataset && (
        <QueryForm dataset={dataset} onOpenInSQLEditor={onOpenInSQLEditor} />
      )}
    </div>
  );
}

function crumbStyle(isActive) {
  return {
    background: "none",
    border: "none",
    padding: 0,
    cursor: isActive ? "default" : "pointer",
    color: isActive ? "var(--text)" : "var(--accent)",
    fontWeight: isActive ? 600 : 400,
    fontSize: "inherit",
    textDecoration: isActive ? "none" : "underline",
  };
}
