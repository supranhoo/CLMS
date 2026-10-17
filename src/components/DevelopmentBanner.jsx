import React from "react";
import "./DevelopmentBanner.css";
import { useRuntime } from './RuntimeEnvironment';

export default function DevelopmentBanner() {
  const runtime = useRuntime();
  if (!runtime.demo) return <aside className="development-replica-banner" aria-label="Server environment"><strong>{runtime.mode.toUpperCase()} · SERVER CORE</strong><span>Database-backed records · attendance, leave and payroll migration pending</span></aside>;
  return (
    <aside className="development-replica-banner" aria-label="Development environment">
      <strong>DEVELOPMENT REPLICA</strong>
      <span>Synthetic sample data · Local feature development</span>
      <a href="/dashboard">Dashboard</a>
      <a href="/development/features">State profiles &amp; feature status</a>
    </aside>
  );
}
