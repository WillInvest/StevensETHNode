import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { renderCell } from "../cellRenderer";

/* ── Table categorization for the public schema ── */
const PUBLIC_CATEGORIES = [
  { label: "Protocol Data", match: t => /^(aave_v3|compound_v3|curve_|lido_|erc20_|arb_|base_|op_)/.test(t) },
  { label: "Uniswap V3 Events", match: t => /^uniswap_v3_(mints|burns)$/.test(t) },
  { label: "Liquidity Snapshots", match: t => /^uniswap_v3_(tick_snapshots|snapshot_jobs)$/.test(t) },
  { label: "Hyperliquid", match: t => /^hl_/.test(t) },
  { label: "Internal", match: t => /^(_users|_saved|test_)/.test(t), hidden: true },
];

const SCHEMA_COLORS = {
  uniswap_v3: "#818cf8",  // indigo
  public: "#34d399",      // emerald
  shovel: "#6b7280",      // gray
};

function SchemaSection({ schema, tables, expanded, onToggle, onSort, sortBy, sortDir, preview, previewLoading }) {
  const color = SCHEMA_COLORS[schema] || "var(--text-muted)";
  const totalRows = tables.reduce((s, t) => s + (t.row_count || 0), 0);

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Schema header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
        padding: "0 4px",
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: color, flexShrink: 0,
          boxShadow: `0 0 8px ${color}40`,
        }} />
        <span className="mono" style={{
          fontSize: 13, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em",
          color: "var(--text-secondary)",
        }}>
          {schema}
        </span>
        <span style={{
          flex: 1, height: 1,
          background: "var(--border-subtle)",
        }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {tables.length} table{tables.length !== 1 ? "s" : ""}
          {" \u00b7 "}
          {totalRows.toLocaleString()} rows
        </span>
      </div>

      {/* Table cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tables.map(t => (
          <TableCard
            key={`${t.schema}.${t.table}`}
            t={t}
            isExpanded={expanded === `${t.schema}.${t.table}`}
            onToggle={() => onToggle(t.schema, t.table)}
            onSort={onSort}
            sortBy={sortBy}
            sortDir={sortDir}
            preview={expanded === `${t.schema}.${t.table}` ? preview : null}
            previewLoading={expanded === `${t.schema}.${t.table}` ? previewLoading : false}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryGroup({ label, tables, expanded, onToggle, onSort, sortBy, sortDir, preview, previewLoading }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "0 8px",
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tables.map(t => (
          <TableCard
            key={`${t.schema}.${t.table}`}
            t={t}
            isExpanded={expanded === `${t.schema}.${t.table}`}
            onToggle={() => onToggle(t.schema, t.table)}
            onSort={onSort}
            sortBy={sortBy}
            sortDir={sortDir}
            preview={expanded === `${t.schema}.${t.table}` ? preview : null}
            previewLoading={expanded === `${t.schema}.${t.table}` ? previewLoading : false}
          />
        ))}
      </div>
    </div>
  );
}

function TableCard({ t, isExpanded, onToggle, onSort, sortBy, sortDir, preview, previewLoading }) {
  const isEmpty = !t.row_count;
  return (
    <div
      className="card"
      style={{
        ...(isExpanded ? { borderColor: "var(--border-accent)" } : {}),
        ...(isEmpty && !isExpanded ? { opacity: 0.55 } : {}),
      }}
    >
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 24, borderRadius: "var(--radius-sm)",
            background: isExpanded ? "var(--accent-glow)" : "rgba(255,255,255,0.04)",
            color: isExpanded ? "var(--text-accent)" : "var(--text-muted)",
            fontSize: 12,
            transition: "all var(--transition-fast)",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            &#9654;
          </span>
          <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>
            {t.table}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="num" style={{ fontSize: 13 }}>
            {t.row_count != null ? t.row_count.toLocaleString() : "\u2014"} rows
          </span>
          <Link
            to={`/browse/${t.schema}/${t.table}`}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 12px" }}
            onClick={e => e.stopPropagation()}
          >
            Full view
          </Link>
        </div>
      </div>

      {/* Expanded preview */}
      {isExpanded && (
        <div style={{ marginTop: 16 }} className="fade-in">
          {previewLoading && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading preview...</p>
          )}
          {preview?.error && (
            <p style={{ color: "var(--red)", fontSize: 13 }}>Error: {preview.error}</p>
          )}
          {preview && !preview.error && (
            <div style={{ overflowX: "auto", borderRadius: "var(--radius-sm)" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>#</th>
                    {preview.columns.map(col => {
                      const isSorted = sortBy === col.name;
                      return (
                        <th
                          key={col.name}
                          onClick={() => onSort(col.name)}
                          style={{ cursor: "pointer", userSelect: "none" }}
                        >
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
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
                            display: "block", fontWeight: 400, fontSize: 10,
                            color: "var(--text-muted)",
                            textTransform: "none", letterSpacing: 0,
                          }}>
                            {col.type}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      <td style={{
                        textAlign: "center", color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)", fontSize: 11,
                      }}>
                        {i + 1}
                      </td>
                      {preview.columns.map(col => (
                        <td key={col.name} title={String(row[col.name] ?? "")}>
                          {renderCell(col.name, row[col.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginTop: 12,
                fontSize: 12, color: "var(--text-muted)",
              }}>
                <span>
                  Showing {Math.min(20, preview.rows.length)} of{" "}
                  {preview.total.toLocaleString()} rows
                  {sortBy && (
                    <> &middot; sorted by <span style={{ color: "var(--text-accent)" }}>{sortBy}</span> {sortDir}</>
                  )}
                </span>
                <Link
                  to={`/browse/${t.schema}/${t.table}${sortBy ? `?sort_by=${sortBy}&sort_dir=${sortDir}` : ""}`}
                  style={{ fontSize: 12 }}
                >
                  Browse all rows &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Data() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [showInternal, setShowInternal] = useState(false);

  useEffect(() => {
    fetch("/api/tables")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => setTables(data.tables))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchPreview = (schema, table, sort, dir) => {
    setPreviewLoading(true);
    setPreview(null);
    const params = new URLSearchParams({ limit: "20", offset: "0" });
    if (sort) {
      params.set("sort_by", sort);
      params.set("sort_dir", dir);
    }
    fetch(`/api/browse/${schema}/${table}?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setPreview)
      .catch(e => setPreview({ error: e.message }))
      .finally(() => setPreviewLoading(false));
  };

  const toggleTable = (schema, table) => {
    const key = `${schema}.${table}`;
    if (expanded === key) {
      setExpanded(null);
      setPreview(null);
      setSortBy(null);
      setSortDir("desc");
      return;
    }
    setExpanded(key);
    setSortBy(null);
    setSortDir("desc");
    fetchPreview(schema, table, null, "desc");
  };

  const handleSort = (colName) => {
    if (!expanded) return;
    const [schema, table] = expanded.split(".");
    let newDir = "desc";
    if (sortBy === colName) newDir = sortDir === "desc" ? "asc" : "desc";
    setSortBy(colName);
    setSortDir(newDir);
    fetchPreview(schema, table, colName, newDir);
  };

  /* ── Grouped + filtered table structure ── */
  const { schemas, totalRows, totalTables, schemaCount } = useMemo(() => {
    const q = search.toLowerCase().trim();

    // Filter by search
    const filtered = q
      ? tables.filter(t => t.table.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q))
      : tables;

    // Group by schema
    const bySchema = {};
    for (const t of filtered) {
      (bySchema[t.schema] ||= []).push(t);
    }

    // Hide shovel by default
    if (!showInternal) delete bySchema.shovel;

    // For public schema, sub-categorize
    const result = {};
    const schemaOrder = ["uniswap_v3", "public", "shovel"];
    const sortedSchemas = Object.keys(bySchema).sort((a, b) => {
      const ai = schemaOrder.indexOf(a);
      const bi = schemaOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    for (const schema of sortedSchemas) {
      const schemaTables = bySchema[schema];
      if (schema === "public") {
        // Sub-group into categories
        const categories = [];
        const used = new Set();
        for (const cat of PUBLIC_CATEGORIES) {
          if (cat.hidden && !showInternal) continue;
          const matched = schemaTables.filter(t => cat.match(t.table));
          if (matched.length > 0) {
            categories.push({ label: cat.label, tables: matched });
            matched.forEach(t => used.add(t.table));
          }
        }
        // Uncategorized tables
        const remaining = schemaTables.filter(t => !used.has(t.table));
        if (remaining.length > 0) {
          // Check if any are internal
          const internalMatch = t => /^(_users|_saved|test_)/.test(t.table);
          const nonInternal = remaining.filter(t => !internalMatch(t));
          const internal = remaining.filter(t => internalMatch(t));
          if (nonInternal.length > 0) categories.unshift({ label: "General", tables: nonInternal });
          if (internal.length > 0 && showInternal) categories.push({ label: "Internal", tables: internal });
        }
        result[schema] = { tables: schemaTables, categories };
      } else {
        result[schema] = { tables: schemaTables, categories: null };
      }
    }

    const allFiltered = Object.values(bySchema).flat();
    return {
      schemas: result,
      totalRows: allFiltered.reduce((s, t) => s + (t.row_count || 0), 0),
      totalTables: allFiltered.length,
      schemaCount: Object.keys(result).length,
    };
  }, [tables, search, showInternal]);

  return (
    <div className="fade-in-up">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          Data Explorer
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {loading ? "Loading..." : (
            <>
              <span className="num">{schemaCount}</span> schema{schemaCount !== 1 ? "s" : ""}
              {" \u00b7 "}
              <span className="num">{totalTables}</span> tables
              {" \u00b7 "}
              <span className="num">{totalRows.toLocaleString()}</span> total rows
            </>
          )}
        </p>
      </div>

      {error && (
        <div style={{ color: "var(--red)", marginBottom: 16 }}>Error: {error}</div>
      )}

      {/* Search + toggle bar */}
      {!loading && !error && (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            marginBottom: 24,
          }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
              <span style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-muted)", fontSize: 14, pointerEvents: "none",
              }}>
                &#x1F50D;
              </span>
              <input
                className="input"
                placeholder="Search tables..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
            <label style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, color: "var(--text-secondary)",
              cursor: "pointer", userSelect: "none",
            }}>
              <input
                type="checkbox"
                checked={showInternal}
                onChange={e => setShowInternal(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              Show internal
            </label>
          </div>

          {/* Schema sections */}
          {Object.entries(schemas).map(([schema, { tables: schemaTables, categories }]) => {
            if (categories) {
              // Public schema with sub-groups
              return (
                <div key={schema} style={{ marginBottom: 28 }}>
                  {/* Schema header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    marginBottom: 16, padding: "0 4px",
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: SCHEMA_COLORS[schema] || "var(--text-muted)",
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${(SCHEMA_COLORS[schema] || "#666")}40`,
                    }} />
                    <span className="mono" style={{
                      fontSize: 13, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      color: "var(--text-secondary)",
                    }}>
                      {schema}
                    </span>
                    <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {schemaTables.length} table{schemaTables.length !== 1 ? "s" : ""}
                      {" \u00b7 "}
                      {schemaTables.reduce((s, t) => s + (t.row_count || 0), 0).toLocaleString()} rows
                    </span>
                  </div>

                  {categories.map(cat => (
                    <CategoryGroup
                      key={cat.label}
                      label={cat.label}
                      tables={cat.tables}
                      expanded={expanded}
                      onToggle={toggleTable}
                      onSort={handleSort}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      preview={preview}
                      previewLoading={previewLoading}
                    />
                  ))}
                </div>
              );
            }

            // Non-public schema (uniswap_v3, shovel, etc.)
            return (
              <SchemaSection
                key={schema}
                schema={schema}
                tables={schemaTables}
                expanded={expanded}
                onToggle={toggleTable}
                onSort={handleSort}
                sortBy={sortBy}
                sortDir={sortDir}
                preview={preview}
                previewLoading={previewLoading}
              />
            );
          })}

          {/* Empty search state */}
          {totalTables === 0 && search && (
            <div className="empty-state">
              <div className="empty-icon">&#x1F50D;</div>
              <div className="empty-text">No tables matching "{search}"</div>
              <div className="empty-sub">Try a different search term</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
