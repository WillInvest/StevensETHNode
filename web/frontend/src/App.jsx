import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";

const Data = lazy(() => import("./pages/Data"));
const Browse = lazy(() => import("./pages/Browse"));
const Extraction = lazy(() => import("./pages/Extraction"));
const Mempool = lazy(() => import("./pages/Mempool"));
const Query = lazy(() => import("./pages/Query"));
const SCI = lazy(() => import("./pages/SCI"));
const FearIndex = lazy(() => import("./pages/FearIndex"));
const StressTest = lazy(() => import("./pages/StressTest"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const EthDistribution = lazy(() => import("./pages/EthDistribution"));

function PageLoader() {
  return (
    <div style={{ padding: 32 }}>
      <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 300, height: 14, marginBottom: 28 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[1,2,3].map((i) => (
          <div key={i} className="card-static" style={{ height: 100 }}>
            <div className="skeleton" style={{ width: 60, height: 10, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: 80, height: 28 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 32px rgba(99, 102, 241, 0.3)",
            animation: "pulse-glow 2s infinite",
          }}>
            <span style={{ fontSize: 18, color: "#fff", fontWeight: 700 }}>S</span>
          </div>
        </div>
      </div>
    );
  }

  if (user === null) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route path="/" element={<Home />} />
          <Route path="/data" element={<Data />} />
          <Route path="/browse/:schema/:table" element={<Browse />} />
          <Route path="/extraction" element={<Extraction />} />
          <Route path="/mempool" element={<Mempool />} />
          <Route path="/query" element={<Query />} />
          <Route path="/sci" element={<SCI />} />
          <Route path="/fear-index" element={<FearIndex />} />
          <Route path="/stress-test" element={<StressTest />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/eth-distribution" element={<EthDistribution />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
