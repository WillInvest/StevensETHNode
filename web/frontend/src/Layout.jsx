import { Link, Outlet } from "react-router-dom";

const styles = {
  header: {
    background: "#1a1a2e",
    color: "#fff",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    gap: "32px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 700,
    margin: 0,
  },
  nav: {
    display: "flex",
    gap: "16px",
  },
  link: {
    color: "#a0a0c0",
    textDecoration: "none",
    fontSize: "14px",
  },
  main: {
    padding: "24px",
    maxWidth: "1200px",
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
};

export default function Layout() {
  return (
    <div>
      <header style={styles.header}>
        <h1 style={styles.title}>Stevens Blockchain Analytics</h1>
        <nav style={styles.nav}>
          <Link to="/" style={styles.link}>Home</Link>
          <Link to="/extraction" style={styles.link}>Extraction</Link>
        </nav>
      </header>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
