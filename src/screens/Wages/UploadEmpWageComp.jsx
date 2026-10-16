// src/pages/UploadEmpWageComp.js
import React, { useEffect, useState } from "react";
import { Form, Button, Alert, OverlayTrigger, Tooltip } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "../../api/axios.js";
import styles from "./UploadEmpWageComp.module.css";
import { selectUser } from "../../features/userSlice";
import UploadWageComponents from "../../components/UploadEmpWageComp";

// --- helper to check menu-level permission (same pattern you use elsewhere)
const checkUserPermission = async (emp_id, activity_id) => {
  try {
    const { data } = await axios.post(
      "/api/assignRoles/getUserMenuActivityForSpecificMenu",
      { emp_id, activity_id },
      { headers: { "Cache-Control": "no-cache" } }
    );
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error("Permission check failed:", err);
    return false;
  }
};

const UploadEmpWageComp = () => {
  const [showUpload, setShowUpload] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;

  // check auth on mount
  useEffect(() => {
    (async () => {
      const ok = await checkUserPermission(emp_id, /*activity_id*/ 6);
      setHasPermission(ok);
    })();
  }, [emp_id]);

  if (!token)
    return (
      <div>
        <p>You must be logged-in to access this page.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );

  // tooltip explaining XLS headers
  const headerTip = (props) => (
    <Tooltip id="upload-tip" {...props}>
      Accepts <strong>.xlsx/.xls</strong> with headers:
      <br />
      EmployeeCode  Designation Department  BusinessUnit  Is_Active EmployeeType
       BillingCycle  eff_date  BasicRate DARate  JaggeryRate GrossRate ESIApply
       PFApply LWFApply  OTHALWRT  HRART Medical Allowance Conveyance Allowance
      TRALWRT UNALWRT OldHRA
    </Tooltip>
  );

  return (
    <div className={styles["container"]}>
      <h3>Upload Wage Components</h3>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <Form.Group className={styles["form-row"]}>
        <OverlayTrigger placement="top" overlay={headerTip}>
          <Button
            size="lg"
            className={styles["small-button"]}
            disabled={!hasPermission}
            onClick={() => setShowUpload(true)}
          >
            Upload Wage Components
          </Button>
        </OverlayTrigger>
      </Form.Group>

      {showUpload && (
        <UploadWageComponents
          created_by={emp_id}
          onClose={() => setShowUpload(false)}
          onSuccess={(msg) => {
            setSuccess(msg);
            setError("");
          }}
          onError={(msg) => {
            setError(msg);
            setSuccess("");
          }}
        />
      )}

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
    </div>
  );
};

export default UploadEmpWageComp;
