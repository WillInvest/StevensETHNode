import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import Data from "./pages/Data";
import Browse from "./pages/Browse";
import Extraction from "./pages/Extraction";
import Mempool from "./pages/Mempool";
import Query from "./pages/Query";
import SCI from "./pages/SCI";
import Login from "./pages/Login";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not auth'd

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return null; // loading
  }

  if (user === null) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
        <Route path="/" element={<Home />} />
        <Route path="/data" element={<Data />} />
        <Route path="/browse/:schema/:table" element={<Browse />} />
        <Route path="/extraction" element={<Extraction />} />
        <Route path="/mempool" element={<Mempool />} />
        <Route path="/query" element={<Query />} />
        <Route path="/sci" element={<SCI />} />
      </Route>
    </Routes>
  );
}
