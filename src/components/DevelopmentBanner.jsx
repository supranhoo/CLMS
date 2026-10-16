import React from "react";
import "./DevelopmentBanner.css";

export default function DevelopmentBanner() {
  return (
    <aside className="development-replica-banner" aria-label="Development environment">
      <strong>DEVELOPMENT REPLICA</strong>
      <span>Synthetic sample data · Local feature development</span>
      <a href="/dashboard">Dashboard</a>
      <a href="/development/features">State profiles &amp; feature status</a>
    </aside>
  );
}
