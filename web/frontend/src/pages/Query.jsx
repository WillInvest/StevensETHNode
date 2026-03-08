import { useState, useRef, useEffect } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";
import { renderCell } from "../cellRenderer";
import QueryChart from "../components/QueryChart";
import SavedQueries from "../components/SavedQueries";
import ProtocolStepper from "../components/wrds/ProtocolStepper.jsx";

const DEFAULT_SQL = "SELECT * FROM uniswap_v3_mints ORDER BY block_num DESC LIMIT 20";

export default function Query() {
  const [activeTab, setActiveTab] = useState("wrds");
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const loadSavedQuery = (sqlText) => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: sqlText },
      });
    }
  };

  const saved = SavedQueries({ onSelect: loadSavedQuery });

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const state = EditorState.create({
        doc: DEFAULT_SQL,
        extensions: [
          basicSetup,
          sql(),
          oneDark,
          EditorView.theme({
            "&": { fontSize: "13px", maxHeight: "300px" },
            ".cm-scroller": { overflow: "auto" },
            ".cm-content": { fontFamily: "var(--font-mono)" },
          }),
          keymap.of([{
            key: "Ctrl-Enter",
            run: () => { document.getElementById("run-query-btn")?.click(); return true; },
          }]),
        ],
      });
      viewRef.current = new EditorView({ state, parent: editorRef.current });
    }
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  const exportResult = (format) => {
    const sqlText = viewRef.current?.state.doc.toString() || "";
    if (!sqlText.trim()) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/export/query";
    form.target = "_blank";
    // Use fetch for POST export
    fetch("/api/export/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: sqlText, format }),
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `query_result.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const runQuery = async () => {
    const sqlText = viewRef.current?.state.doc.toString() || "";
    if (!sqlText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlText, limit: 1000 }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || "Query failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openInSQLEditor = (sqlText) => {
    setActiveTab("sql");
    if (viewRef.current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: sqlText },
      });
    }
  };

  return (
    <div className="fade-in-up">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Query</h2>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
        {[
          { id: "wrds", label: "Form Query" },
          { id: "sql", label: "SQL Editor" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              padding: "8px 18px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--text)" : "var(--text-secondary)",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── WRDS Form tab ── */}
      {activeTab === "wrds" && (
        <ProtocolStepper onOpenInSQLEditor={openInSQLEditor} />
      )}

      {/* ── SQL Editor tab ── */}
      {activeTab === "sql" && (
        <>
          <saved.SavePanel />
          <saved.SaveForm currentSql={viewRef.current?.state.doc.toString() || ""} />

          <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
            <div ref={editorRef} />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <button
              id="run-query-btn"
              className="btn btn-primary"
              onClick={runQuery}
              disabled={loading}
            >
              {loading ? "Running..." : "Execute (Ctrl+Enter)"}
            </button>
            {result && (
              <>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {result.row_count} rows in {result.elapsed_seconds}s
                </span>
                <button
                  className={`btn ${showChart ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setShowChart(!showChart)}
                >
                  {showChart ? "Hide Chart" : "Visualize"}
                </button>
                <button className="btn btn-ghost" onClick={() => exportResult("csv")}>CSV</button>
                <button className="btn btn-ghost" onClick={() => exportResult("json")}>JSON</button>
                <button className="btn btn-ghost" onClick={() => saved.setShowSave(true)}>Save</button>
              </>
            )}
          </div>

          {error && (
            <div className="card" style={{ borderColor: "var(--red)", marginBottom: 16 }}>
              <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>
            </div>
          )}

          {showChart && result && result.rows.length > 0 && (
            <QueryChart columns={result.columns} rows={result.rows} />
          )}

          {result && result.rows.length > 0 && (
            <div style={{
              overflowX: "auto",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
            }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {result.columns.map((col) => (
                        <td key={col} title={String(row[col] ?? "")}>
                          {renderCell(col, row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
