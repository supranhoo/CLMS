// src/screens/CLMS/ManageApprovedManpower.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import Select from "react-select";
import axios from "../../api/axios.js";
import styles from "./ApprovedManpower.module.css";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";

/**
 * ManageApprovedManpower
 * - Insert and Delete only for dbo.approved_manpower
 * - PK: contractor_id, dept_code, bu_code, emp_type
 * - Fields: approved_day, approved_night, eff_date (nullable)
 */
const ManageApprovedManpower = () => {
  const user = useSelector(selectUser);
  const token = user?.token;
  const navigate = useNavigate();

  // grid data
  const [rows, setRows] = useState([]);

  // masters
  const [contractors, setContractors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [empTypes, setEmpTypes] = useState([]);

  // add form
  const [newRow, setNewRow] = useState({
    contractor_id: "",
    dept_code: "",
    bu_code: "",
    emp_type: "SL",
    approved_day: 0,
    approved_night: 0,
    eff_date: "",
  });

  // filters
  const [filters, setFilters] = useState({
    contractor_id: "",
    dept_code: "",
    bu_code: "",
    emp_type: "",
    eff_date_from: "",
    eff_date_to: "",
  });

  // messages
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const dayRef = useRef(null);

  // endpoints (adjust if your routes differ)
  const API = {
    LIST: "/api/attendance/listApprovedManpower",        // POST: filters in body or query
    ADD: "/api/attendance/addApprovedManpower",          // POST
    DEL_POST: "/api/attendance/deleteApprovedManpower",  // POST
    CONTRACTORS: "/api/contractor/getAllContractors",
    DEPTS: "/api/entity/getAllDept",
    BUS: "/api/entity/getAllBU",
    EMP_TYPES: "/api/employee/getEmpType",
  };

  // axios config with token
  const cfg = useMemo(
    () => (token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    [token]
  );

  // ultra-compact react-select styles
  const selectXsStyles = useMemo(
    () => ({
      control: (base) => ({
        ...base,
        minHeight: 28,
        height: 28,
        borderColor: "#d1d5db",
        boxShadow: "none",
        fontSize: 12,
      }),
      valueContainer: (base) => ({
        ...base,
        height: 26,
        padding: "0 6px",
      }),
      indicatorsContainer: (base) => ({
        ...base,
        height: 26,
      }),
      input: (base) => ({ ...base, margin: 0, padding: 0 }),
      singleValue: (base) => ({ ...base, fontSize: 12 }),
      placeholder: (base) => ({ ...base, fontSize: 12, color: "#9ca3af" }),
      menu: (base) => ({ ...base, fontSize: 12, zIndex: 99999 }),
    }),
    []
  );

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toastOK = (m) => {
    setOkMsg(m);
    setTimeout(() => setOkMsg(""), 2000);
  };
  const toastERR = (m) => {
    setErrMsg(m);
    setTimeout(() => setErrMsg(""), 3000);
  };

  // build a payload with only non-empty filters
  const buildFilterPayload = () => {
    const src = filters || {};
    const out = {};
    if (src.contractor_id) out.contractor_id = src.contractor_id;
    if (src.dept_code) out.dept_code = src.dept_code;
    if (src.bu_code) out.bu_code = src.bu_code;
    if (src.emp_type) out.emp_type = src.emp_type;
    if (src.eff_date_from) out.eff_date_from = src.eff_date_from;
    if (src.eff_date_to) out.eff_date_to = src.eff_date_to;
    return out;
  };

  const fetchAll = async () => {
    await Promise.all([
      fetchRows({}), // initial: no filters (full list)
      fetchContractors(),
      fetchDepartments(),
      fetchBUs(),
      fetchEmpTypes(),
    ]);
  };

  // NOTE: we send filters both in body and as query params for compatibility
  const fetchRows = async (overridePayload = null) => {
    try {
      const payload = overridePayload ?? buildFilterPayload();
      const res = await axios.post(API.LIST, payload, { ...cfg, params: payload });
      setRows(res.data || []);
    } catch (e) {
      console.error("Fetch rows error:", e);
      toastERR("Failed to load approved manpower.");
    }
  };

  const fetchContractors = async () => {
    try {
      const res = await axios.get(API.CONTRACTORS, cfg);
      setContractors(
        (res.data || []).map((c) => ({ value: c.Contractor_ID, label: c.Contractor_Name }))
      );
    } catch (e) {
      console.error("Fetch contractors error:", e);
    }
  };
  const fetchDepartments = async () => {
    try {
      const res = await axios.post(API.DEPTS, {}, cfg);
      setDepartments(
        (res.data || []).map((d) => ({ value: d.dept_code, label: `${d.dept_code} — ${d.dept_name}` }))
      );
    } catch (e) {
      console.error("Fetch depts error:", e);
    }
  };
  const fetchBUs = async () => {
    try {
      const res = await axios.post(API.BUS, {}, cfg);
      setBusinessUnits(
        (res.data || []).map((b) => ({ value: b.bu_code, label: `${b.bu_code} — ${b.bu_name}` }))
      );
    } catch (e) {
      console.error("Fetch BUs error:", e);
    }
  };
  const fetchEmpTypes = async () => {
    try {
      const res = await axios.get(API.EMP_TYPES, cfg);
      console.log("emp types:",res);
      setEmpTypes(
        (res.data || []).map((t) => ({
          value: t.emp_type_code,
          label: `${t.emp_type_code} — ${t.emp_type_name || ""}`.trim(),
        }))
      );
    } catch (e) {
      console.error("Fetch emp types error:", e);
    }
  };

  // add form handlers
  const setField = (name, value) => setNewRow((s) => ({ ...s, [name]: value }));
  const onSelectChange = (opt, name) => setField(name, opt ? opt.value : "");
  const onNumberChange = (e) => {
    const { name, value } = e.target;
    setField(name, value === "" ? "" : Math.max(0, parseInt(value, 10) || 0));
  };
  const onDateChange = (e) => setField("eff_date", e.target.value);

  // filters handlers
  const setFilter = (name, value) => setFilters((s) => ({ ...s, [name]: value }));
  const onFilterSelectChange = (opt, name) => setFilter(name, opt ? opt.value : "");
  const onFilterDateChange = (e) => setFilter(e.target.name, e.target.value);
  const applyFilters = async () => { await fetchRows(); };
  const clearFilters = async () => {
    setFilters({
      contractor_id: "",
      dept_code: "",
      bu_code: "",
      emp_type: "",
      eff_date_from: "",
      eff_date_to: "",
    });
    await fetchRows({}); // empty -> full list
  };

  // add
  const handleAdd = async () => {
    const { contractor_id, dept_code, bu_code, emp_type } = newRow;
    if (!contractor_id || !dept_code || !bu_code || !emp_type) {
      toastERR("Contractor, Dept, BU, Emp Type are required.");
      return;
    }
    try {
      const payload = {
        contractor_id,
        dept_code,
        bu_code,
        emp_type,
        approved_day: newRow.approved_day === "" ? 0 : Number(newRow.approved_day || 0),
        approved_night: newRow.approved_night === "" ? 0 : Number(newRow.approved_night || 0),
        eff_date: newRow.eff_date || null,
      };
      const res = await axios.post(API.ADD, payload, cfg);
      if (res.status === 200 || res.status === 201) {
        toastOK("Added.");
        await fetchRows(); // refresh with current filters
        setNewRow((s) => ({ ...s, approved_day: 0, approved_night: 0, eff_date: "" }));
        dayRef.current?.focus();
      } else {
        toastERR("Add failed.");
      }
    } catch (e) {
      console.error("Add error:", e);
      toastERR(e.response?.data?.error || e.response?.data?.message || e.message || "Add failed.");
    }
  };

  // delete (POST)
  const handleDelete = async (r) => {
    const ok = window.confirm(
      `Delete: ${r.contractor_id} / ${r.dept_code} / ${r.bu_code} / ${r.emp_type} ?`
    );
    if (!ok) return;
    try {
      const res = await axios.post(
        API.DEL_POST,
        {
          contractor_id: r.contractor_id,
          dept_code: r.dept_code,
          bu_code: r.bu_code,
          emp_type: r.emp_type,
        },
        cfg
      );
      if (res.status === 200) {
        toastOK("Deleted.");
        // optimistic removal
        setRows((list) =>
          list.filter(
            (x) =>
              !(
                x.contractor_id === r.contractor_id &&
                x.dept_code === r.dept_code &&
                x.bu_code === r.bu_code &&
                x.emp_type === r.emp_type
              )
          )
        );
      } else {
        toastERR("Delete failed.");
      }
    } catch (e) {
      console.error("Delete error:", e);
      toastERR(e.response?.data?.error || e.response?.data?.message || e.message || "Delete failed.");
    }
  };

  const sel = (opts, val) => opts.find((o) => o.value === val) || null;

  if (!token) {
    return (
      <div className={styles.container}>
        <p className={styles.smallTxt}>You must be logged in to access this page.</p>
        <button className={styles.btnXs} onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Approved Manpower — Add / Delete</h3>

      {okMsg && <Alert variant="success" className={styles.alert}>{okMsg}</Alert>}
      {errMsg && <Alert variant="danger" className={styles.alert}>{errMsg}</Alert>}

      {/* FILTERS (2-row grid) */}
      <div className={styles.card}>
        <div className={`${styles.gridBar} ${styles.gridCols4}`}>
          <div className={styles.item}>
            <label className={styles.lbl}>Contractor</label>
            <Select
              options={contractors}
              value={sel(contractors, filters.contractor_id)}
              onChange={(opt) => onFilterSelectChange(opt, "contractor_id")}
              placeholder="All"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
          <div className={styles.item}>
            <label className={styles.lbl}>Department</label>
            <Select
              options={departments}
              value={sel(departments, filters.dept_code)}
              onChange={(opt) => onFilterSelectChange(opt, "dept_code")}
              placeholder="All"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
          <div className={styles.item}>
            <label className={styles.lbl}>Business Unit</label>
            <Select
              options={businessUnits}
              value={sel(businessUnits, filters.bu_code)}
              onChange={(opt) => onFilterSelectChange(opt, "bu_code")}
              placeholder="All"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
          <div className={styles.item}>
            <label className={styles.lbl}>Emp Type</label>
            <Select
              options={empTypes}
              value={sel(empTypes, filters.emp_type)}
              onChange={(opt) => onFilterSelectChange(opt, "emp_type")}
              placeholder="All"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>

          <div className={styles.itemNarrow}>
            <label className={styles.lbl}>From</label>
            <Form.Control
              type="date"
              name="eff_date_from"
              value={filters.eff_date_from}
              onChange={onFilterDateChange}
              className={styles.xsControl}
            />
          </div>
          <div className={styles.itemNarrow}>
            <label className={styles.lbl}>To</label>
            <Form.Control
              type="date"
              name="eff_date_to"
              value={filters.eff_date_to}
              onChange={onFilterDateChange}
              className={styles.xsControl}
            />
          </div>
          <div className={styles.itemBtns}>
            <Button size="sm" className={styles.btnXsPrimary} onClick={applyFilters}>
              Apply
            </Button>
            <Button size="sm" variant="secondary" className={styles.btnXs} onClick={clearFilters}>
              Clear
            </Button>
          </div>
          {/* spacer to keep 2 rows visually balanced */}
          <div className={styles.itemSpacer} />
        </div>
      </div>

      {/* ADD (2-row grid) */}
      <div className={styles.card}>
        <div className={`${styles.gridBar} ${styles.gridCols4}`}>
          <div className={styles.item}>
            <label className={styles.lbl}>Contractor</label>
            <Select
              options={contractors}
              value={sel(contractors, newRow.contractor_id)}
              onChange={(opt) => onSelectChange(opt, "contractor_id")}
              placeholder="Select"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
          <div className={styles.item}>
            <label className={styles.lbl}>Department</label>
            <Select
              options={departments}
              value={sel(departments, newRow.dept_code)}
              onChange={(opt) => onSelectChange(opt, "dept_code")}
              placeholder="Select"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
          <div className={styles.item}>
            <label className={styles.lbl}>Business Unit</label>
            <Select
              options={businessUnits}
              value={sel(businessUnits, newRow.bu_code)}
              onChange={(opt) => onSelectChange(opt, "bu_code")}
              placeholder="Select"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>
          <div className={styles.item}>
            <label className={styles.lbl}>Emp Type</label>
            <Select
              options={empTypes}
              value={sel(empTypes, newRow.emp_type)}
              onChange={(opt) => onSelectChange(opt, "emp_type")}
              placeholder="Select"
              classNamePrefix="rs"
              styles={selectXsStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>

          <div className={styles.itemNum}>
            <label className={styles.lbl}>Day</label>
            <Form.Control
              ref={dayRef}
              type="number"
              min={0}
              name="approved_day"
              value={newRow.approved_day}
              onChange={onNumberChange}
              className={styles.xsControl}
              placeholder="0"
            />
          </div>
          <div className={styles.itemNum}>
            <label className={styles.lbl}>Night</label>
            <Form.Control
              type="number"
              min={0}
              name="approved_night"
              value={newRow.approved_night}
              onChange={onNumberChange}
              className={styles.xsControl}
              placeholder="0"
            />
          </div>
          <div className={styles.itemNarrow}>
            <label className={styles.lbl}>Eff Date</label>
            <Form.Control
              type="date"
              value={newRow.eff_date}
              onChange={onDateChange}
              className={styles.xsControl}
            />
          </div>
          <div className={styles.itemBtns}>
            <Button size="sm" className={styles.btnXsPrimary} onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.gridWrap}>
        <Table bordered hover size="sm" className={styles.table}>
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Dept</th>
              <th>BU</th>
              <th>Emp Type</th>
              <th>Day</th>
              <th>Night</th>
              <th>Eff. Date</th>
              <th style={{ width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length ? (
              rows.map((r) => (
                <tr key={`${r.contractor_id}|${r.dept_code}|${r.bu_code}|${r.emp_type}`}>
                  <td>{r.contractor_id}</td>
                  <td>{r.dept_code}</td>
                  <td>{r.bu_code}</td>
                  <td>{r.emp_type}</td>
                  <td className="text-end">{r.approved_day}</td>
                  <td className="text-end">{r.approved_night}</td>
                  <td>{r.eff_date ? String(r.eff_date).substring(0, 10) : ""}</td>
                  <td>
                    <Button size="sm" variant="danger" className={styles.btnXs} onClick={() => handleDelete(r)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default ManageApprovedManpower;
