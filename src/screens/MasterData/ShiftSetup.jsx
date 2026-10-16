import React, { useState } from "react";
import MasterDataManager from "./MasterDataManager";
import styles from "./MasterDataManager.module.css";
export default function ShiftSetup() {
  const [tab, setTab] = useState("shift-groups");
  return (
    <div>
      <nav className={styles.tabs}>
        <button
          className={tab === "shift-groups" ? styles.activeTab : ""}
          onClick={() => setTab("shift-groups")}
        >
          Shift Groups
        </button>
        <button
          className={tab === "shift-times" ? styles.activeTab : ""}
          onClick={() => setTab("shift-times")}
        >
          Shift Timings
        </button>
      </nav>
      <MasterDataManager master={tab} />
    </div>
  );
}
