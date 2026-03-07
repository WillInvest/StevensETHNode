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
      position: "relative",
    }}>
      {/* Background glow effects */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(ellipse 60% 40% at 50% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 30% 70%, rgba(52, 211, 153, 0.04) 0%, transparent 60%)
        `,
        pointerEvents: "none",
      }} />

      <div className="fade-in-up" style={{
        width: 380,
        position: "relative",
        zIndex: 1,
      }}>
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 32px rgba(99, 102, 241, 0.25), 0 8px 24px rgba(0,0,0,0.3)",
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 22, color: "#fff", fontWeight: 700 }}>S</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Stevens Blockchain
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            On-chain analytics platform
          </p>
        </div>

        {/* Login card */}
        <div className="card-static" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 6,
              }}>
                Username
              </label>
              <input
                type="text"
                className="input"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 6,
              }}>
                Password
              </label>
              <input
                type="password"
                className="input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div style={{
                background: "var(--red-bg)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                marginBottom: 16,
                fontSize: 13,
                color: "var(--red)",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px 0",
                fontSize: 14,
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 20,
        }}>
          Ethereum Mainnet · Erigon Archive Node
        </p>
      </div>
    </div>
  );
}
