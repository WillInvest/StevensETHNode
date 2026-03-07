import { useState, useEffect } from "react";

export default function SavedQueries({ onSelect }) {
  const [queries, setQueries] = useState([]);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = () => {
    fetch("/api/queries")
      .then((r) => r.json())
      .then(setQueries)
      .catch(() => {});
  };

  useEffect(load, []);

  const saveQuery = async (sqlText) => {
    if (!name.trim()) return;
    await fetch("/api/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, sql_text: sqlText }),
    });
    setName("");
    setDescription("");
    setShowSave(false);
    load();
  };

  const deleteQuery = async (id) => {
    await fetch(`/api/queries/${id}`, { method: "DELETE" });
    load();
  };

  return {
    queries,
    showSave,
    setShowSave,
    name,
    setName,
    description,
    setDescription,
    saveQuery,
    deleteQuery,
    SavePanel: () => (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Saved Queries
        </div>
        {queries.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No saved queries yet.</p>
        )}
        {queries.map((q) => (
          <div
            key={q.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <button
              className="btn btn-ghost"
              style={{ flex: 1, textAlign: "left", padding: "4px 8px", fontSize: 12 }}
              onClick={() => onSelect(q.sql_text)}
              title={q.description || q.sql_text}
            >
              {q.name}
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: "2px 6px", fontSize: 11, color: "var(--red)" }}
              onClick={() => deleteQuery(q.id)}
            >
              x
            </button>
          </div>
        ))}
      </div>
    ),
    SaveForm: ({ currentSql }) => showSave ? (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Save Current Query</div>
        <input
          placeholder="Query name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%", marginBottom: 8, padding: "6px 10px", fontSize: 13,
            background: "var(--bg-input)", color: "var(--text-primary)",
            border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
          }}
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{
            width: "100%", marginBottom: 8, padding: "6px 10px", fontSize: 13,
            background: "var(--bg-input)", color: "var(--text-primary)",
            border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => saveQuery(currentSql)}>
            Save
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowSave(false)}>
            Cancel
          </button>
        </div>
      </div>
    ) : null,
  };
}
