import Footer from "../Footer/Footer";
import DevelopmentBanner from "../DevelopmentBanner";
import "./AppShell.css";

export default function PublicShell({ children }) {
  return (
    <div className="bfcl-public-shell">
      <DevelopmentBanner />
      <a className="bfcl-skip-link" href="#main-content">Skip to main content</a>
      <div className="bfcl-public-brand"><strong>CLMS workspace</strong><span>BFCL local development replica</span></div>
      <main id="main-content" className="bfcl-public-content">{children}</main>
      <Footer />
    </div>
  );
}
