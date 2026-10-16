// src/pages/LeavePayrollPosting.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import Select from "react-select";
import axios from "../../api/axios.js";
import styles from "./Leave.module.css";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import { downloadWorkbook } from "../../utils/exportWorkbook.js";

const LeavePayrollPosting = () => {
  const [processMonths, setProcessMonths] = useState([]);
  const [contractors, setContractors] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState(null);

  const [rows, setRows] = useState([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [previewSnapshot, setPreviewSnapshot] = useState(null);
  const previewRevision = useRef(0);

  const user = useSelector(selectUser);
  const token = user?.token;
  const navigate = useNavigate();

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  const fetchMasters = async () => {
    try {
      const [pmRes, contractorRes] = await Promise.all([
        axios.post("/api/wages/getProcessMonth"),
        axios.get("/api/contractor/getAllContractors"),
      ]);

      setProcessMonths(
        (pmRes.data.data || pmRes.data || []).map((m) => ({
          value: m.pmonth?.substring(0, 10),
          label:
            m.period_name ||
            new Date(m.pmonth).toLocaleDateString("en-GB", {
              month: "short",
              year: "numeric",
            }),
        })),
      );

      setContractors(
        (contractorRes.data || []).map((c) => ({
          value: String(c.Contractor_ID).trim(),
          label: `${c.Contractor_Name} (${c.Contractor_ID})`,
        })),
      );
    } catch (e) {
      setError("Failed to load masters");
    }
  };

  const previewPosting = async () => {
    setError("");
    setSuccess("");

    if (!selectedMonth) return setError("Please select Process Month");
    if (!selectedContractor) return setError("Please select Contractor");

    try {
      const revision = ++previewRevision.current;
      const snapshot = { month: selectedMonth, contractor: selectedContractor, generatedAt: new Date().toISOString() };
      setRows([]);
      setPreviewSnapshot(null);
      const res = await axios.post("/api/leave/payroll-posting", {
        pmonth: selectedMonth.value,
        contractor_id: selectedContractor.value,
        mode: "PREVIEW",
      });
      if (revision !== previewRevision.current) return;
      setRows(res.data.data || []);
      setPreviewSnapshot(snapshot);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to preview posting data");
    }
  };

  const postPayrollLeave = async () => {
    setError("");
    setSuccess("");

    if (!selectedMonth) return setError("Please select Process Month");
    if (!selectedContractor) return setError("Please select Contractor");

    if (
      !window.confirm(
        `Existing PAYROLL leave transactions for ${selectedMonth.label} and contractor ${selectedContractor.label} will be deleted and reposted. Continue?`,
      )
    ) {
      return;
    }

    try {
      const res = await axios.post("/api/leave/payroll-posting", {
        pmonth: selectedMonth.value,
        contractor_id: selectedContractor.value,
        mode: "POST",
      });

      setSuccess(
        res.data?.data?.[0]?.posted_rows
          ? `Payroll leave posted successfully. Rows: ${res.data.data[0].posted_rows}`
          : "Payroll leave posted successfully",
      );

      previewPosting();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to post payroll leave");
    }
  };

  const exportXls = () => {
    setError("");
    setSuccess("");
    if (!previewSnapshot || !rows.length) return setError("Preview the selected month and contractor first. There are no preview rows to export.");
    if (previewSnapshot.month.value !== selectedMonth?.value || previewSnapshot.contractor.value !== selectedContractor?.value) {
      return setError("Filters have changed. Run Preview again before exporting.");
    }
    try {
      downloadWorkbook({
        title: "Payroll Leave Posting Preview",
        sheetName: "Posting Preview",
        columns: [
          { key: "employee_code", label: "Employee Code" },
          { key: "employee_name", label: "Employee Name" },
          { key: "contractor_name", label: "Contractor" },
          { key: "leave_type_code", label: "Leave Type" },
          { key: "trans_type", label: "Transaction Type" },
          { key: "effect", label: "Effect" },
          { key: "leave_days", label: "Leave Days" },
          { key: "remarks", label: "Remarks" },
        ],
        rows: rows.map((row) => ({ ...row, effect: row.trans_type === "CREDIT" ? "Credit" : "Debit", leave_days: Number(row.leave_days || 0) })),
        metadata: {
          "Process month": previewSnapshot.month.label,
          "Contractor": previewSnapshot.contractor.label,
          "Preview generated at (UTC)": previewSnapshot.generatedAt,
          "Posting status": "Preview only. This export does not post payroll leave or certify BFCL rules.",
        },
      }, `CLMS_Payroll_Leave_Preview_${previewSnapshot.month.value.substring(0, 7)}`);
      setSuccess(`Exported ${rows.length} payroll leave preview records.`);
    } catch (exportError) {
      setError(exportError.message || "Could not export the leave posting preview.");
    }
  };

  const summary = useMemo(() => {
    const availed = rows
      .filter((r) => r.trans_type === "AVAILED")
      .reduce((s, r) => s + Number(r.leave_days || 0), 0);

    const encashed = rows
      .filter((r) => r.trans_type === "ENCASHED")
      .reduce((s, r) => s + Number(r.leave_days || 0), 0);

    const credit = rows
      .filter((r) => r.trans_type === "CREDIT")
      .reduce((s, r) => s + Number(r.leave_days || 0), 0);

    return {
      availed,
      encashed,
      credit,
      net: credit - availed - encashed,
      records: rows.length,
    };
  }, [rows]);

  if (!token) {
    return (
      <div>
        <p>You must be logged in.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className={styles["requests-container"]}>
      <h5>Payroll Leave Posting</h5>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div
        className={styles["form-grid"]}
        style={{
          fontSize: "0.72rem",
          gridTemplateColumns: "repeat(3, 1fr)",
        }}
      >
        <Form.Group>
          <Form.Label>Process Month</Form.Label>
          <Select
            options={processMonths}
            value={selectedMonth}
            onChange={(o) => {
              previewRevision.current += 1;
              setPreviewSnapshot(null);
              setSelectedMonth(o);
              setRows([]);
            }}
            placeholder="Select active month"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Contractor</Form.Label>
          <Select
            options={contractors}
            value={selectedContractor}
            onChange={(o) => {
              previewRevision.current += 1;
              setPreviewSnapshot(null);
              setSelectedContractor(o);
              setRows([]);
            }}
            placeholder="Select contractor"
          />
        </Form.Group>

        <Form.Group className="d-flex align-items-end gap-2">
          <Button size="sm" onClick={previewPosting}>
            Preview
          </Button>

          <Button size="sm" variant="success" onClick={postPayrollLeave}>
            Post Payroll Leave
          </Button>

          <Button size="sm" variant="outline-secondary" onClick={exportXls}>
            Export XLSX
          </Button>
        </Form.Group>
      </div>

      <div className="d-flex gap-2 mt-3 mb-2" style={{ fontSize: "0.75rem" }}>
        <div className="border rounded p-2">
          Records: <b>{summary.records}</b>
        </div>
        <div className="border rounded p-2">
          Availed: <b>{summary.availed.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          Encashed: <b>{summary.encashed.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          Credit: <b>{summary.credit.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          Net Effect: <b>{summary.net.toFixed(2)}</b>
        </div>
      </div>

      <Table bordered size="sm">
        <thead>
          <tr>
            <th>Emp.Code</th>
            <th>Name</th>
            <th>Contractor</th>
            <th>Leave Type</th>
            <th>Trans Type</th>
            <th>Effect</th>
            <th>Days</th>
            <th>Remarks</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => {
            const effect = r.trans_type === "CREDIT" ? "Credit" : "Debit";

            return (
              <tr key={i}>
                <td>{r.employee_code}</td>
                <td>{r.employee_name}</td>
                <td>{r.contractor_name}</td>
                <td>{r.leave_type_code}</td>
                <td>{r.trans_type}</td>
                <td>{effect}</td>
                <td style={{ textAlign: "right" }}>
                  {Number(r.leave_days || 0).toFixed(2)}
                </td>
                <td>{r.remarks}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan="8" className="text-center text-muted">
                Select Process Month, Contractor and click Preview.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default LeavePayrollPosting;
