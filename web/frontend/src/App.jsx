import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import Browse from "./pages/Browse";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/browse/:schema/:table" element={<Browse />} />
      </Route>
    </Routes>
  );
}
