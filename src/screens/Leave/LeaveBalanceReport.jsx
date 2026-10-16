import React, { useEffect, useMemo, useState } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import Select from "react-select";
import axios from "../../api/axios.js";
import * as XLSX from "xlsx";
import styles from "./Leave.module.css";
import { apiErrorMessage } from "../../utils/apiError";

const LeaveBalanceReport = () => {
  const [processMonths, setProcessMonths] = useState([]);
  const [contractors, setContractors] = useState([]);

  const [asOnMonth, setAsOnMonth] = useState(null);
  const [contractor, setContractor] = useState(null);
  const [balanceFilter, setBalanceFilter] = useState({
    value: "ALL",
    label: "All",
  });

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const balanceOptions = [
    { value: "ALL", label: "All" },
    { value: "POSITIVE", label: "Positive Balance" },
    { value: "ZERO", label: "Zero Balance" },
    { value: "NEGATIVE", label: "Negative Balance" },
  ];

  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [pmRes, empRes, contractorRes] = await Promise.all([
        axios.post("/api/wages/getAllProcessMonth"),
        axios.get("/api/employee/getAllEmployees"),
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
    } catch {
      setError("Failed to load report masters");
    }
  };

  const viewReport = async () => {
    setError("");

    if (!asOnMonth) return setError("As On Month is required");

    try {
      const res = await axios.get("/api/leave/report/balance", {
        params: {
          as_on_month: asOnMonth.value,
          contractor_id: contractor?.value || "",
        },
      });

      setRows(res.data.data || []);
    } catch (e) {
      setError(apiErrorMessage(e, "Failed to load balance report"));
    }
  };

  const filteredRows = useMemo(() => {
    if (balanceFilter.value === "ALL") return rows;

    return rows.filter((r) => {
      const bal = Number(r.total_balance || 0);
      if (balanceFilter.value === "POSITIVE") return bal > 0;
      if (balanceFilter.value === "ZERO") return bal === 0;
      if (balanceFilter.value === "NEGATIVE") return bal < 0;
      return true;
    });
  }, [rows, balanceFilter]);

  const exportXls = () => {
    const data = filteredRows.map((r) => ({
      Contractor: r.contractor_name,
      "Emp.Code": r.employee_code,
      "Employee Name": r.display_name,
      "CL Balance": r.cl_balance,
      "EL Balance": r.el_balance,
      "SL Balance": r.sl_balance,
      "Total Balance": r.total_balance,
      "Last Transaction Date": r.last_trans_date,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Leave Balance");
    XLSX.writeFile(wb, "Leave_Balance_Report.xlsx");
  };

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (a, r) => {
        a.cl += Number(r.cl_balance || 0);
        a.el += Number(r.el_balance || 0);
        a.sl += Number(r.sl_balance || 0);
        a.total += Number(r.total_balance || 0);
        return a;
      },
      { cl: 0, el: 0, sl: 0, total: 0 },
    );
  }, [filteredRows]);

  return (
    <div className={styles["requests-container"]}>
      <h5>Leave Balance Report</h5>

      {error && <Alert variant="danger">{error}</Alert>}

      <div
        className={styles["form-grid"]}
        style={{ fontSize: "0.72rem", gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        <Form.Group>
          <Form.Label>As On Month</Form.Label>
          <Select
            options={processMonths}
            value={asOnMonth}
            onChange={setAsOnMonth}
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
          <Form.Label>Balance Filter</Form.Label>
          <Select
            options={balanceOptions}
            value={balanceFilter}
            onChange={setBalanceFilter}
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
          Records: <b>{filteredRows.length}</b>
        </div>
        <div className="border rounded p-2">
          CL: <b>{totals.cl.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          EL: <b>{totals.el.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          SL: <b>{totals.sl.toFixed(2)}</b>
        </div>
        <div className="border rounded p-2">
          Total: <b>{totals.total.toFixed(2)}</b>
        </div>
      </div>

      <Table bordered size="sm">
        <thead>
          <tr>
            <th>Contractor</th>
            <th>Emp.Code</th>
            <th>Name</th>
            <th>CL Balance</th>
            <th>EL Balance</th>
            <th>SL Balance</th>
            <th>Total Balance</th>
            <th>Last Transaction</th>
          </tr>
        </thead>

        <tbody>
          {filteredRows.map((r, i) => (
            <tr key={i}>
              <td>{r.contractor_name}</td>
              <td>{r.employee_code}</td>
              <td>{r.display_name}</td>
              <td className="text-end">
                {Number(r.cl_balance || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.el_balance || 0).toFixed(2)}
              </td>
              <td className="text-end">
                {Number(r.sl_balance || 0).toFixed(2)}
              </td>
              <td className="text-end">
                <b>{Number(r.total_balance || 0).toFixed(2)}</b>
              </td>
              <td>
                {r.last_trans_date
                  ? new Date(r.last_trans_date).toLocaleString()
                  : ""}
              </td>
            </tr>
          ))}

          {filteredRows.length === 0 && (
            <tr>
              <td colSpan="8" className="text-center text-muted">
                Select filters and click View.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default LeaveBalanceReport;
