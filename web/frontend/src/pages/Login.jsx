import { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        setError(data.detail || "Login failed");
        return;
      }
      const user = await resp.json();
      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-primary)",
    }}>
      <div className="card fade-in-up" style={{ width: 360, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-block", width: 12, height: 12,
            borderRadius: 3, background: "var(--accent)",
            boxShadow: "0 0 12px var(--accent-glow)", marginBottom: 12,
          }} />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Stevens Blockchain</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{
              width: "100%", marginBottom: 12, padding: "10px 14px", fontSize: 14,
              background: "var(--bg-input)", color: "var(--text-primary)",
              border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%", marginBottom: 16, padding: "10px 14px", fontSize: 14,
              background: "var(--bg-input)", color: "var(--text-primary)",
              border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
            }}
          />
          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", padding: "10px 0" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
