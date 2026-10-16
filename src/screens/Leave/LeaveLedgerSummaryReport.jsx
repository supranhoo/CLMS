import React, { useEffect, useMemo, useState } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import Select from "react-select";
import axios from "../../api/axios.js";
import * as XLSX from "xlsx";
import styles from "./Leave.module.css";

const LeaveLedgerSummaryReport = () => {
  const [processMonths, setProcessMonths] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [fromMonth, setFromMonth] = useState(null);
  const [toMonth, setToMonth] = useState(null);
  const [contractor, setContractor] = useState(null);
  const [leaveType, setLeaveType] = useState(null);

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [pmRes, empRes, ltRes, contractorRes] = await Promise.all([
        axios.post("/api/wages/getAllProcessMonth"),
        axios.get("/api/employee/getAllEmployees"),
        axios.get("/api/leave/getLeaveTypes"),
        axios.get("/api/contractor/getAllContractors"),
      ]);

      setProcessMonths(
        (pmRes.data.data || pmRes.data || []).map((m) => ({
          value: m.pmonth?.substring(0, 10),
          label: m.period_name || m.pmonth?.substring(0, 7),
        })),
      );

      const contractorMap = {};
      (contractorRes.data || []).forEach((e) => {
        if (e.Contractor_ID) {
          contractorMap[e.Contractor_ID] = e.Contractor_Name || e.Contractor_ID;
        }
      });
      setContractors(
        Object.keys(contractorMap).map((k) => ({
          value: k,
          label: contractorMap[k],
        })),
      );

      setLeaveTypes(
        (ltRes.data || []).map((l) => ({
          value: l.leave_type_code,
          label: l.leave_type_name,
        })),
      );
    } catch {
      setError("Failed to load report masters");
    }
  };

  const viewReport = async () => {
    setError("");

    if (!fromMonth || !toMonth) {
      return setError("From Month and To Month are required");
    }

    try {
      const res = await axios.get("/api/leave/report/summary", {
        params: {
          from_month: fromMonth.value,
          to_month: toMonth.value,
          contractor_id: contractor?.value || "",
          leave_type_code: leaveType?.value || "",
        },
      });

      setRows(res.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load summary report");
    }
  };

  const exportXls = () => {
    const data = rows.map((r) => ({
      "Emp.Code": r.employee_code,
      "Employee Name": r.display_name,
      Contractor: r.contractor_name,
      "Leave Type": r.leave_type_code,
      "Opening Balance": r.op_balance,
      Credit: r.credit_days,
      Availed: r.availed_days,
      Encashed: r.encashed_days,
      Reversal: r.reversal_days,
      "Adjustment Credit": r.adj_cr_days,
      "Adjustment Debit": r.adj_dr_days,
      Lapsed: r.lapsed_days,
      "Carry Forward": r.carry_forward_days,
      "Closing Balance": r.closing_balance,
      "Last Transaction Date": r.last_trans_date,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Leave Summary");
    XLSX.writeFile(wb, "Leave_Ledger_Summary.xlsx");
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (a, r) => {
        a.op += Number(r.op_balance || 0);
        a.credit += Number(r.credit_days || 0);
        a.availed += Number(r.availed_days || 0);
        a.encashed += Number(r.encashed_days || 0);
        a.closing += Number(r.closing_balance || 0);
        return a;
      },
      { op: 0, credit: 0, availed: 0, encashed: 0, closing: 0 },
    );
  }, [rows]);

  return (
    <div className={styles["requests-container"]}>
      <h5>Leave Ledger Summary Report</h5>

      {error && <Alert variant="danger">{error}</Alert>}

      <div
        className={styles["form-grid"]}
        style={{ fontSize: "0.72rem", gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        <Form.Group>
          <Form.Label>From Month</Form.Label>
          <Select
            options={processMonths}
            value={fromMonth}
            onChange={setFromMonth}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>To Month</Form.Label>
          <Select
            options={processMonths}
            value={toMonth}
            onChange={setToMonth}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Contractor</Form.Label>
          <Select
            options={contractors}
            value={contractor}
            onChange={setContractor}
            isClearable
            placeholder="All"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Leave Type</Form.Label>
          <Select
            options={leaveTypes}
            value={leaveType}
            onChange={setLeaveType}
            isClearable
            placeholder="All"
          />
        </Form.Group>

        <Form.Group className="d-flex align-items-end gap-2">
          <Button size="sm" onClick={viewReport}>
            View
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={exportXls}>
            Download XLS
          </Button>
        </Form.Group>
      </div>

      <div className="d-flex gap-2 mt-3 mb-2" style={{ fontSize: "0.75rem" }}>
        <div className="border rounded p-2">
          Records: <b>{rows.length}</b>
        </div>
        <div className="border rounded p-2">
          Op.Bal: <b>{totals.op.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          Credit: <b>{totals.credit.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          Availed: <b>{totals.availed.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          Closing: <b>{totals.closing.toFixed(2)}</b>
        </div>
      </div>

      <Table bordered size="sm">
        <thead>
          <tr>
            <th>Emp.Code</th>
            <th>Name</th>
            <th>Contractor</th>
            <th>Leave Type</th>
            <th>Op.Bal</th>
            <th>Credit</th>
            <th>Availed</th>
            <th>Encash</th>
            <th>Reversal</th>
            <th>Adj Cr</th>
            <th>Adj Dr</th>
            <th>Lapsed</th>
            <th>Carry Fwd</th>
            <th>Closing</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.employee_code}</td>
              <td>{r.display_name}</td>
              <td>{r.contractor_name}</td>
              <td>{r.leave_type_code}</td>
              <td className="text-end">
                {Number(r.op_balance || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.credit_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.availed_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.encashed_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.reversal_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.adj_cr_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.adj_dr_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.lapsed_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.carry_forward_days || 0).toFixed(2)}
              </td>
              <td className="text-end">
                <b>{Number(r.closing_balance || 0).toFixed(2)}</b>
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan="14" className="text-center text-muted">
                Select filters and click View.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default LeaveLedgerSummaryReport;
