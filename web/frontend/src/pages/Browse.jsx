import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { renderCell } from "../cellRenderer";

const PAGE_SIZE = 50;

export default function Browse() {
  const { schema, table } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const sortBy = searchParams.get("sort_by") || "block";
  const sortDir = searchParams.get("sort_dir") || "desc";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (sortBy) {
      params.set("sort_by", sortBy);
      params.set("sort_dir", sortDir);
    }
    fetch(`/api/browse/${schema}/${table}?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schema, table, offset, sortBy, sortDir]);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      next.set(k, v);
    }
    setSearchParams(next);
  };

  const handleSort = (colName) => {
    let newDir = "desc";
    if (sortBy === colName) {
      newDir = sortDir === "desc" ? "asc" : "desc";
    }
    updateParams({ sort_by: colName, sort_dir: newDir, offset: "0" });
  };

  const goPrev = () => updateParams({ offset: String(Math.max(0, offset - PAGE_SIZE)) });
  const goNext = () => updateParams({ offset: String(offset + PAGE_SIZE) });

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="fade-in-up">
      <Link to="/data" style={{ fontSize: 13, marginBottom: 16, display: "inline-block" }}>
        &larr; Back to Data Explorer
      </Link>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>{schema}.</span>{table}
      </h2>

      {loading && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</p>
      )}
      {error && (
        <p style={{ color: "var(--red)", fontSize: 13 }}>Error: {error}</p>
      )}

      {data && (
        <>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
            <span className="num">{data.total.toLocaleString()}</span> rows
            {" \u00b7 "}
            showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, data.total)}
            {sortBy && (
              <> &middot; sorted by <span style={{ color: "var(--text-accent)" }}>{sortBy}</span> {sortDir}</>
            )}
          </p>

          <div style={{
            overflowX: "auto",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}>
            <table className="data-table">
              <thead>
                <tr>
                  {data.columns.map((col) => {
                    const isSorted = sortBy === col.name;
                    return (
                      <th
                        key={col.name}
                        onClick={() => handleSort(col.name)}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: isSorted ? "var(--text-accent)" : undefined,
                        }}>
                          {col.name}
                          {isSorted && (
                            <span style={{ fontSize: 10 }}>
                              {sortDir === "desc" ? "\u25BC" : "\u25B2"}
                            </span>
                          )}
                        </span>
                        <span style={{
                          display: "block",
                          fontWeight: 400,
                          fontSize: 10,
                          color: "var(--text-muted)",
                          textTransform: "none",
                          letterSpacing: 0,
                        }}>
                          {col.type}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i}>
                    {data.columns.map((col) => (
                      <td key={col.name} title={String(row[col.name] ?? "")}>
                        {renderCell(col.name, row[col.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            display: "flex",
            gap: 12,
            marginTop: 16,
            alignItems: "center",
          }}>
            <button
              className="btn btn-ghost"
              onClick={goPrev}
              disabled={offset === 0}
            >
              Previous
            </button>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-ghost"
              onClick={goNext}
              disabled={offset + PAGE_SIZE >= data.total}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
