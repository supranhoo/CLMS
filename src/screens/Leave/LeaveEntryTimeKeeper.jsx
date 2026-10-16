import React, { useState, useEffect, useRef } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import Select from "react-select";
import axios from "../../api/axios.js";
import styles from "./Leave.module.css";
import { isValidDate, toISODate } from "../../utils/dateUtils";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";

const LeaveEntryTimeKeeper = () => {
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leavePeriods, setLeavePeriods] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const empRef = useRef(null);

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    employee_code: "",
    request_date: "",
    leave_period_id: "",
    leave_type: "",
    leave_nature: "",
    from_date: "",
    to_date: "",
    total_days: "",
    reason: "",
  });

  /* -------------------- AUTO HIDE MSG -------------------- */
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  /* -------------------- INIT -------------------- */
  useEffect(() => {
    fetchEmployees();
    fetchLeavePeriods();
    fetchLeaveTypes();
    fetchRecentEntries();
    setToday();
  }, []);

  const setToday = () => {
    const d = new Date();
    setForm((f) => ({
      ...f,
      request_date: `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`,
    }));
  };

  /* -------------------- MASTER LOAD -------------------- */
  const fetchEmployees = async () => {
    const res = await axios.get("/api/employee/getAllEmployees");
    setEmployees(
      res.data.map((e) => ({
        value: e.Employee_Code,
        label: `${e.display_name} (${e.Employee_Code})`,
      }))
    );
  };

  const fetchLeavePeriods = async () => {
    const res = await axios.get("/api/leave/getActiveLeavePeriods");
    setLeavePeriods(
      res.data.map((p) => ({
        value: p.leave_period_id,
        label: p.period_name,
      }))
    );
  };

  const fetchLeaveTypes = async () => {
    const res = await axios.get("/api/leave/getLeaveTypes");
    setLeaveTypes(
      res.data.map((l) => ({
        value: l.leave_type_code,
        label: l.leave_type_name,
      }))
    );
  };

  const fetchRecentEntries = async () => {
    const res = await axios.get("/api/leave/getRecentLeaves");
    setEntries(res.data);
    console.log(res);
  };

  /* -------------------- HELPERS -------------------- */
  const smartDateInput = (value) => {
    const d = value.replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };

  const calcTotalDays = (from, to) => {
    if (!isValidDate(from) || !isValidDate(to)) return "";
    const f = new Date(toISODate(from));
    const t = new Date(toISODate(to));
    return Math.floor((t - f) / (1000 * 60 * 60 * 24)) + 1;
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  /* -------------------- HANDLERS -------------------- */
  const handleDateChange = (name, value) => {
    const newVal = smartDateInput(value);
    const updated = { ...form, [name]: newVal };

    if (name === "from_date" || name === "to_date") {
      updated.total_days = calcTotalDays(
        name === "from_date" ? newVal : form.from_date,
        name === "to_date" ? newVal : form.to_date
      );
    }
    setForm(updated);
  };

  const handleSelect = (opt, name) => {
    setForm({ ...form, [name]: opt ? opt.value : "" });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!form.employee_code || !form.leave_type || !form.leave_period_id) {
      return setError("Employee, Leave Period & Leave Type are mandatory");
    }

    if (
      !isValidDate(form.request_date) ||
      !isValidDate(form.from_date) ||
      !isValidDate(form.to_date)
    ) {
      return setError("Invalid date format (DD/MM/YYYY)");
    }

    const payload = {
      employee_code: form.employee_code,
      leave_period_id: form.leave_period_id,
      leave_type_code: form.leave_type,
      leave_nature: form.leave_nature,
      reason: form.reason,
      request_date: toISODate(form.request_date),
      from_date: toISODate(form.from_date),
      to_date: toISODate(form.to_date),
      total_days: Number(form.total_days),
      approved_by: emp_id,
    };

    try {
      await axios.post("/api/leave/addLeave", payload);
      setSuccess("Leave saved & approved successfully");
      fetchRecentEntries();
      setForm((f) => ({
        ...f,
        employee_code: "",
        leave_period_id: "",
        leave_type: "",
        leave_nature: "",
        from_date: "",
        to_date: "",
        total_days: "",
        reason: "",
      }));
      empRef.current?.focus();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to save leave entry");
    }
  };

  const handleDelete = async (leave_app_id) => {
    if (!window.confirm("Are you sure you want to delete this leave entry?")) {
      return;
    }

    try {
      await axios.post("/api/leave/deleteLeave", {
        leave_app_id: leave_app_id,
        emp_id: emp_id,
      });

      setSuccess("Leave entry deleted successfully");
      fetchRecentEntries();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to delete leave entry");
    }
  };

  /* -------------------- UI -------------------- */
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
      <h5>Leave Entry – Time Keeper</h5>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* ---------- FORM ---------- */}
      <div
        className={styles["form-grid"]}
        style={{
          fontSize: "0.72rem",
          gridTemplateColumns: "repeat(3, 1fr)",
        }}
      >
        <Form.Group>
          <Form.Label>Employee</Form.Label>
          <Select
            ref={empRef}
            options={employees}
            value={
              employees.find((e) => e.value === form.employee_code) || null
            }
            onChange={(o) => handleSelect(o, "employee_code")}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Request Date</Form.Label>
          <Form.Control
            value={form.request_date}
            onChange={(e) => handleDateChange("request_date", e.target.value)}
            placeholder="DD/MM/YYYY"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Leave Period</Form.Label>
          <Select
            options={leavePeriods}
            value={
              leavePeriods.find((p) => p.value === form.leave_period_id) || null
            }
            onChange={(o) => handleSelect(o, "leave_period_id")}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Leave Type</Form.Label>
          <Select
            options={leaveTypes}
            value={leaveTypes.find((l) => l.value === form.leave_type) || null}
            onChange={(o) => handleSelect(o, "leave_type")}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Leave Nature</Form.Label>
          <Select
            options={[
              { value: "PLANNED", label: "Planned" },
              { value: "UNPLANNED", label: "Unplanned" },
              { value: "UNINFORMED", label: "Uninformed" },
            ]}
            value={
              [
                { value: "PLANNED", label: "Planned" },
                { value: "UNPLANNED", label: "Unplanned" },
                { value: "UNINFORMED", label: "Uninformed" },
              ].find((n) => n.value === form.leave_nature) || null
            }
            onChange={(o) => handleSelect(o, "leave_nature")}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>From</Form.Label>
          <Form.Control
            value={form.from_date}
            onChange={(e) => handleDateChange("from_date", e.target.value)}
            placeholder="DD/MM/YYYY"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>To</Form.Label>
          <Form.Control
            value={form.to_date}
            onChange={(e) => handleDateChange("to_date", e.target.value)}
            placeholder="DD/MM/YYYY"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Total Days</Form.Label>
          <Form.Control
            value={form.total_days}
            onChange={(e) => setForm({ ...form, total_days: e.target.value })}
          />
        </Form.Group>

        <Form.Group style={{ gridColumn: "1 / -1" }}>
          <Form.Label>Reason</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            name="reason"
            value={form.reason}
            onChange={handleChange}
          />
        </Form.Group>

        <Button size="sm" onClick={handleSubmit}>
          Save & Approve
        </Button>
      </div>

      {/* ---------- GRID ---------- */}
      <hr />

      <Table bordered size="sm">
        <thead>
          <tr>
            <th>App Id</th>
            <th>Emp</th>
            <th>Period</th>
            <th>Type</th>
            <th>Nature</th>
            <th>From</th>
            <th>To</th>
            <th>Days</th>
            <th>Request Dt</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <td>{e.leave_app_id}</td>
              <td>{e.employee_code}</td>
              <td>{e.leave_period_id}</td>
              <td>{e.leave_type_code}</td>
              <td>{e.leave_nature}</td>
              <td>{formatDate(e.from_date)}</td>
              <td>{formatDate(e.to_date)}</td>
              <td>{e.total_days}</td>
              <td>{formatDate(e.request_date)}</td>
              <td style={{ color: "green" }}>Approved</td>
              <td className="text-center">
                <Button
                  size="sm"
                  variant="outline-danger"
                  style={{
                    padding: "2px 6px",
                    fontSize: "0.7rem",
                    lineHeight: "1",
                  }}
                  onClick={() => handleDelete(e.leave_app_id)}
                >
                  ✕
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default LeaveEntryTimeKeeper;
