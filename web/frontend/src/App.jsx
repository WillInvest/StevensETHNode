import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import Data from "./pages/Data";
import Browse from "./pages/Browse";
import Extraction from "./pages/Extraction";
import Mempool from "./pages/Mempool";
import Query from "./pages/Query";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/data" element={<Data />} />
        <Route path="/browse/:schema/:table" element={<Browse />} />
        <Route path="/extraction" element={<Extraction />} />
        <Route path="/mempool" element={<Mempool />} />
        <Route path="/query" element={<Query />} />
      </Route>
    </Routes>
  );
}
