import { useEffect, useMemo, useState } from "react";
import { FaArrowRight, FaCalendarCheck, FaClipboardList, FaCogs, FaFileAlt, FaUsers, FaWallet } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../api/axios.js";
import { selectUser } from "../../features/userSlice";
import { useNavigation } from "../../components/layout/AppShell";
import "./Dashboard.css";

const TASKS = [
  { label: "Manage workers", description: "Review worker records, assignments and approvals.", path: "/manageEmployees", icon: FaUsers },
  { label: "Review attendance", description: "Open the attendance calendar and recorded local inputs.", path: "/manageAttendance", icon: FaCalendarCheck },
  { label: "Enter wage inputs", description: "Maintain earnings, deductions and arrears for the selected period.", path: "/wageEarnings", icon: FaWallet },
  { label: "Review leave", description: "Inspect saved leave ledger data and available previews.", path: "/leave-ledger-entry", icon: FaClipboardList },
];

const ICONS = [FaCogs, FaUsers, FaCalendarCheck, FaWallet, FaClipboardList, FaFileAlt];

export default function Dashboard() {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const { groups, items, loading: menuLoading } = useNavigation();
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    if (!user?.token) navigate("/login");
  }, [navigate, user?.token]);

  useEffect(() => {
    if (!user?.token) return undefined;
    let active = true;
    api.get("/api/dev/features")
      .then((response) => { if (active) setFeatures(response.data?.data || []); })
      .catch(() => { if (active) setFeatures([]); });
    return () => { active = false; };
  }, [user?.token]);

  const permitted = useMemo(() => new Set(items.map((item) => item.menu_url.toLowerCase())), [items]);
  const taskCards = TASKS.filter((task) => permitted.has(task.path.toLowerCase()));
  const completeCount = features.filter((feature) => feature.status === "complete").length;
  const gatedCount = features.filter((feature) => feature.status !== "complete").length;

  return (
    <div className="bfcl-dashboard">
      <section className="bfcl-dashboard-heading">
        <div>
          <div className="bfcl-eyebrow">BFCL PEOPLE OPERATIONS</div>
          <h1>Welcome back, {user?.Name || "Demo Developer"}</h1>
          <p>Use this local workspace to manage synthetic records and review feature readiness.</p>
        </div>
        <div className="bfcl-dashboard-actions">
          <Link className="bfcl-button bfcl-button-primary" to="/development/features">View feature status <FaArrowRight aria-hidden="true" /></Link>
        </div>
      </section>

      <div className="bfcl-dashboard-notice" role="note">
        <span className="bfcl-notice-icon">i</span>
        <div><strong>Local synthetic workspace</strong><span>Records are fictional and saved only in this development replica. Payroll calculations and statutory formats require verified BFCL rules.</span></div>
      </div>

      <section className="bfcl-dashboard-layout" aria-label="Workspace summary">
        <div className="bfcl-dashboard-main">
          <div className="bfcl-section-heading"><div><h2>Start with a task</h2><p>Common actions for the current local workspace</p></div></div>
          <div className="bfcl-task-grid">
            {taskCards.map((task) => { const Icon = task.icon; return <Link to={task.path} key={task.path} className="bfcl-task-card"><span className="bfcl-task-icon"><Icon aria-hidden="true" /></span><span><strong>{task.label}</strong><small>{task.description}</small></span><FaArrowRight className="bfcl-task-arrow" aria-hidden="true" /></Link>; })}
            {!taskCards.length && <div className="bfcl-empty-card">{menuLoading ? "Loading permitted tasks…" : "No permitted tasks are available for this account."}</div>}
          </div>
          <div className="bfcl-panel bfcl-module-panel">
            <div className="bfcl-panel-heading"><div><h2>Modules</h2><p>Every permitted destination remains available through the navigation rail.</p></div><span className="bfcl-status-pill">{items.length} screens</span></div>
            <div className="bfcl-module-grid">{groups.map((group, index) => { const Icon = ICONS[index % ICONS.length]; const links = (group.children || []).filter((item) => item.menu_url); return <div className="bfcl-module-card" key={group.menu_id}><div className="bfcl-module-title"><span className="bfcl-module-icon"><Icon aria-hidden="true" /></span><strong>{group.menu_name}</strong></div><div className="bfcl-module-links">{links.slice(0, 4).map((item) => <Link key={item.menu_id} to={item.menu_url}>{item.menu_name}</Link>)}{links.length > 4 && <span className="bfcl-module-more">+{links.length - 4} more in navigation</span>}</div></div>; })}</div>
          </div>
        </div>

        <aside className="bfcl-dashboard-side">
          <div className="bfcl-panel bfcl-summary-panel"><div className="bfcl-panel-heading"><div><h2>Workspace status</h2><p>Current local capability view</p></div></div><dl className="bfcl-summary-list"><div><dt>Environment</dt><dd><span className="bfcl-status-pill bfcl-status-info">Local replica</span></dd></div><div><dt>State profile</dt><dd>Jharkhand draft</dd></div><div><dt>Available areas</dt><dd>{completeCount || "—"}</dd></div><div><dt>Gated areas</dt><dd>{gatedCount || "—"}</dd></div></dl><Link className="bfcl-panel-link" to="/development/features">Open capability details <FaArrowRight aria-hidden="true" /></Link></div>
          <div className="bfcl-panel bfcl-recent-panel"><div className="bfcl-panel-heading"><div><h2>What needs rules</h2><p>Keep these boundaries visible while developing.</p></div></div><ul className="bfcl-boundary-list"><li><span className="bfcl-boundary-dot bfcl-dot-warning" />Payroll and wage calculation</li><li><span className="bfcl-boundary-dot bfcl-dot-warning" />Paid attendance and overtime</li><li><span className="bfcl-boundary-dot bfcl-dot-warning" />Approved statutory layouts</li><li><span className="bfcl-boundary-dot bfcl-dot-muted" />Biometric device integration</li></ul><Link className="bfcl-panel-link" to="/development/features">Review pending intake <FaArrowRight aria-hidden="true" /></Link></div>
        </aside>
      </section>
    </div>
  );
}
