import Footer from "../Footer/Footer";
import DevelopmentBanner from "../DevelopmentBanner";
import "./AppShell.css";
import { useRuntime } from '../RuntimeEnvironment';

export default function PublicShell({ children }) {
  const runtime = useRuntime();
  return (
    <div className="bfcl-public-shell">
      <DevelopmentBanner />
      <a className="bfcl-skip-link" href="#main-content">Skip to main content</a>
      <div className="bfcl-public-brand"><strong>CLMS workspace</strong><span>{runtime.demo ? 'BFCL local development replica' : `BFCL ${runtime.mode} server`}</span></div>
      <main id="main-content" className="bfcl-public-content">{children}</main>
      <Footer />
    </div>
  );
}
