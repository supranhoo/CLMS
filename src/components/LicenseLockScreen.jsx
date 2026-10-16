import React from "react";
import "./LicenseLockScreen.css";

const LicenseLockScreen = ({ message }) => {
  return (
    <div className="license-lock-overlay">
      <div className="license-lock-card">
        <h2>Application Locked</h2>
        <p>{message}</p>
        <p className="contact">Please contact your system administrator.</p>
      </div>
    </div>
  );
};

export default LicenseLockScreen;
