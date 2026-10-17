import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FaBars, FaChevronDown, FaChevronRight, FaSearch, FaTimes } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/grouplogo.png";
import api from "../../api/axios";
import Footer from "../Footer/Footer";
import { logoutUser, selectUser } from "../../features/userSlice";
import { flattenMenu, normalizePath, organizeMenu, routeLabel, routeMatches } from "./navigation";
import "./AppShell.css";

const ICONS = ["◈", "▦", "◌", "₹", "▱", "⚙", "✓", "▤", "◴"];
const NavigationContext = createContext({ groups: [], items: [], loading: false, error: null });

export function useNavigation() {
  return useContext(NavigationContext);
}

function useMenuData(user) {
  const [state, setState] = useState({ rows: [], loading: Boolean(user?.token), error: null });

  useEffect(() => {
    let active = true;
    if (!user?.token || !user?.emp_id) {
      setState({ rows: [], loading: false, error: null });
      return () => { active = false; };
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    api.post("/api/menu/getMenuUserData", { emp_id: user.emp_id })
      .then((response) => {
        if (active) setState({ rows: response.data || [], loading: false, error: null });
      })
      .catch(() => {
        if (active) setState({ rows: [], loading: false, error: "Navigation could not be loaded." });
      });
    return () => { active = false; };
  }, [user?.token, user?.emp_id]);

  return state;
}

function ShellNavigation({ groups, onNavigate, onClose, mobile }) {
  const location = useLocation();
  const activeGroup = groups.find((group) => (group.children || []).some((item) => routeMatches(location.pathname, item.menu_url)));
  const [expanded, setExpanded] = useState(() => new Set(activeGroup ? [String(activeGroup.menu_id)] : []));

  useEffect(() => {
    if (activeGroup) setExpanded((current) => new Set(current).add(String(activeGroup.menu_id)));
  }, [activeGroup?.menu_id]);

  return (
    <nav className="bfcl-nav" aria-label="Workspace navigation">
      <div className="bfcl-nav-label">WORKSPACE</div>
      <Link aria-current={location.pathname.toLowerCase() === "/dashboard" ? "page" : undefined} className={`bfcl-nav-item ${location.pathname.toLowerCase() === "/dashboard" ? "is-active" : ""}`} to="/dashboard" onClick={onClose}>
        <span className="bfcl-nav-icon">⌂</span><span>Dashboard</span>
      </Link>
      {groups.map((group, index) => {
        const groupId = String(group.menu_id);
        const isOpen = expanded.has(groupId);
        const hasActiveChild = (group.children || []).some((item) => routeMatches(location.pathname, item.menu_url));
        return (
          <div className="bfcl-nav-group" key={groupId}>
            <button
              type="button"
              className={`bfcl-nav-group-button ${hasActiveChild ? "has-active" : ""}`}
              aria-expanded={isOpen}
              onClick={() => setExpanded((current) => {
                const next = new Set(current);
                if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
                return next;
              })}
            >
              <span className="bfcl-nav-icon">{ICONS[index % ICONS.length]}</span>
              <span>{group.menu_name}</span>
              <FaChevronDown className={`bfcl-nav-chevron ${isOpen ? "is-open" : ""}`} aria-hidden="true" />
            </button>
            {isOpen && (
              <div className="bfcl-nav-children">
                {(group.children || []).filter((item) => item.menu_url).map((item) => (
                  <Link key={item.menu_id} aria-current={routeMatches(location.pathname, item.menu_url) ? "page" : undefined} to={item.menu_url} onClick={onClose} className={`bfcl-nav-child ${routeMatches(location.pathname, item.menu_url) ? "is-active" : ""}`}>
                    <span>{item.menu_name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {mobile && <div className="bfcl-nav-note">Local synthetic data only. Payroll and statutory calculations remain gated by verified BFCL rules.</div>}
    </nav>
  );
}

function SearchBox({ items, onNavigate }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const matches = query.trim().length < 2 ? [] : items.filter((item) => item.menu_name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);
  const selectResult = (item) => {
    if (!item) return;
    setQuery("");
    setActiveIndex(-1);
    navigate(item.menu_url);
    onNavigate();
  };
  return (
    <div className="bfcl-screen-search">
      <FaSearch aria-hidden="true" />
      <input
        aria-label="Search screens"
        aria-controls="bfcl-search-results"
        aria-activedescendant={activeIndex >= 0 ? `bfcl-search-result-${matches[activeIndex]?.menu_id}` : undefined}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, matches.length - 1)); }
          if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
          if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); selectResult(matches[activeIndex]); }
          if (event.key === "Escape") { setQuery(""); setActiveIndex(-1); }
        }}
        placeholder="Search screens"
      />
      {query.trim().length >= 2 && (
        <div className="bfcl-search-results" id="bfcl-search-results" role="listbox" aria-label="Screen search results">
          {matches.length ? matches.map((item, index) => <Link role="option" id={`bfcl-search-result-${item.menu_id}`} aria-selected={index === activeIndex} key={`${item.menu_id}-${item.menu_url}`} to={item.menu_url} onClick={(event) => { event.preventDefault(); selectResult(item); }}>{item.menu_name}<span>{routeLabel(item.menu_url)}</span></Link>) : <p>No permitted screens match “{query}”.</p>}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const menu = useMenuData(user);
  const groups = useMemo(() => organizeMenu(menu.rows), [menu.rows]);
  const items = useMemo(() => flattenMenu(groups), [groups]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  const signOut = () => { dispatch(logoutUser()); navigate("/"); };
  const currentItem = items.find((item) => routeMatches(location.pathname, item.menu_url));
  const currentGroup = groups.find((group) => (group.children || []).some((item) => item.menu_id === currentItem?.menu_id));
  const initials = String(user?.Name || user?.emp_id || "D").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const navigationContext = useMemo(() => ({ groups, items, loading: menu.loading, error: menu.error }), [groups, items, menu.loading, menu.error]);
  return (
    <NavigationContext.Provider value={navigationContext}>
      <div className="bfcl-shell">
      <a className="bfcl-skip-link" href="#main-content">Skip to main content</a>
      <aside className={`bfcl-sidebar ${drawerOpen ? "is-open" : ""}`} aria-label="CLMS workspace navigation">
        <div className="bfcl-brand">
          <div className="bfcl-brand-mark"><img src={logo} alt="BFCL" /></div>
          <div className="bfcl-product-name">CLMS workspace</div>
          <div className="bfcl-product-sub">People, attendance &amp; wages</div>
          <button ref={closeButtonRef} type="button" className="bfcl-drawer-close" onClick={closeDrawer} aria-label="Close navigation"><FaTimes /></button>
        </div>
        <ShellNavigation groups={groups} onClose={closeDrawer} mobile={drawerOpen} />
        <div className="bfcl-sidebar-footer"><strong>LOCAL REPLICA</strong><span>Fictional data · BFCL rules pending</span><Link to="/development/features" onClick={closeDrawer}>View feature status <FaChevronRight aria-hidden="true" /></Link></div>
      </aside>
      {drawerOpen && <button type="button" className="bfcl-drawer-backdrop" aria-label="Close navigation" onClick={closeDrawer} />}
      <div className="bfcl-workspace">
        <header className="bfcl-topbar">
          <button type="button" className="bfcl-icon-button bfcl-mobile-only" aria-label="Open navigation" aria-expanded={drawerOpen} onClick={() => { previousFocusRef.current = document.activeElement; setDrawerOpen(true); }}><FaBars /></button>
          <div className="bfcl-breadcrumb"><span>{currentGroup?.menu_name || "Workspace"}</span><FaChevronRight aria-hidden="true" /><strong>{currentItem?.menu_name || (location.pathname.toLowerCase() === "/dashboard" ? "Dashboard" : routeLabel(location.pathname))}</strong></div>
          <div className="bfcl-topbar-spacer" />
          <SearchBox items={items} onNavigate={() => setUserOpen(false)} />
          <div className="bfcl-user-area">
            <button type="button" className="bfcl-user-button" aria-expanded={userOpen} onClick={() => setUserOpen((open) => !open)}><span className="bfcl-avatar">{initials}</span><span className="bfcl-user-label">{user?.Name || "Demo user"}</span><FaChevronDown aria-hidden="true" /></button>
            {userOpen && <div className="bfcl-user-menu" role="menu"><strong>{user?.Name || "Demo Developer"}</strong><span>{user?.role || "LOCAL_DEMO_ADMIN"}</span><button type="button" role="menuitem" onClick={() => navigate("/change-password")}>Change password</button><button type="button" role="menuitem" onClick={signOut}>Sign out</button></div>}
          </div>
        </header>
        <div className="bfcl-context-strip"><span className="bfcl-context-dot" aria-hidden="true" /> <strong>Development replica</strong><span>Synthetic local data · no production connection</span><Link to="/development/features">State profiles &amp; feature status</Link></div>
        <main id="main-content" className="bfcl-content">{children}</main>
        <Footer />
      </div>
      </div>
    </NavigationContext.Provider>
  );
}
