import { useState, useRef, useEffect } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";
import { renderCell } from "../cellRenderer";

const DEFAULT_SQL = "SELECT * FROM uniswap_v3_swaps ORDER BY block_num DESC LIMIT 20";

export default function Query() {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="fade-in-up">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>SQL Query</h2>

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
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {result.row_count} rows in {result.elapsed_seconds}s
          </span>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--red)", marginBottom: 16 }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>
        </div>
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
    </div>
  );
}
