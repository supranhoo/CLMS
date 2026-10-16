import React, { useEffect, useMemo, useRef, useState } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import Select from "react-select";
import axios from "../../api/axios.js";
import styles from "./Leave.module.css";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import { downloadWorkbook } from "../../utils/exportWorkbook.js";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_SIZE = 10;
const MENU_URL = "/menu"; // change if your menu route is different

const LeaveLedgerEntry = () => {
  const [rows, setRows] = useState([]);
  const [processMonths, setProcessMonths] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [transTypes, setTransTypes] = useState([]);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [entryMode, setEntryMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [searchText, setSearchText] = useState("");
  const [pageNo, setPageNo] = useState(1);

  const user = useSelector(selectUser);
  const token = user?.token;
  const emp_id = user?.emp_id;
  const navigate = useNavigate();
  const empRef = useRef(null);
  const queryRevision = useRef(0);
  const [querySnapshot, setQuerySnapshot] = useState(null);

  const selectPortalStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
  };

  const [filter, setFilter] = useState({
    pmonth: "",
    contractor_id: "",
    leave_type_code: "",
  });

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  useEffect(() => {
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      const [pmRes, empRes, leaveRes, transRes, contractorRes] =
        await Promise.all([
          axios.post("/api/wages/getAllProcessMonth"),
          axios.get("/api/employee/getAllEmployees"),
          axios.get("/api/leave/getLeaveTypes"),
          axios.get("/api/leave/getTransTypes"),
          axios.get("/api/contractor/getAllContractors"),
        ]);

      setProcessMonths(
        (pmRes.data.data || pmRes.data || []).map((m) => ({
          value: m.pmonth?.substring(0, 10),
          label: m.period_name || m.pmonth?.substring(0, 7),
        })),
      );

      const empList = (empRes.data || []).map((e) => ({
        value: e.Employee_Code,
        label: `${e.display_name} (${e.Employee_Code})`,
        contractor_id: String(e.contractor_id || "").trim(),
        employee_name: e.display_name,
      }));
      setEmployees(empList);

      const contractorMap = {};
      (contractorRes.data || []).forEach((e) => {
        if (e.Contractor_ID) {
          contractorMap[String(e.Contractor_ID).trim()] =
            e.Contractor_Name || e.Contractor_ID;
        }
      });

      setContractors(
        Object.keys(contractorMap).map((k) => ({
          value: k,
          label: contractorMap[k],
        })),
      );

      setLeaveTypes(
        (leaveRes.data || []).map((l) => ({
          value: l.leave_type_code,
          label: l.leave_type_name,
        })),
      );

      setTransTypes(
        (transRes.data.data || transRes.data || []).map((t) => ({
          value: t.trans_type,
          label: `${t.trans_name} (${t.balance_effect})`,
          balance_effect: t.balance_effect,
        })),
      );
    } catch (e) {
      setError("Failed to load masters: " + apiErrorMessage(e));
    }
  };

  const handleFilterSelect = (opt, name) => {
    if (
      rows.some((row) => row.is_new || row.is_dirty) &&
      !window.confirm("Discard unsaved ledger changes?")
    ) {
      return;
    }
    queryRevision.current += 1;
    setQuerySnapshot(null);
    setFilter({ ...filter, [name]: opt ? opt.value : "" });
    setRows([]);
    setEntryMode(false);
    setSearchText("");
    setPageNo(1);
  };

  const makeNewRow = () => ({
    trans_id: null,
    employee_code: "",
    employee_name: "",
    leave_type_code: filter.leave_type_code,
    pmonth: filter.pmonth,
    trans_type: "",
    balance_effect: "",
    leave_days: "",
    ref_type: "MANUAL",
    remarks: "",
    created_by: emp_id,
    is_new: true,
    selected: false,
  });

  // Resolves true when the server answered; keepRows are unsaved rows to append after the refresh
  const queryData = async (keepRows) => {
    const kept = Array.isArray(keepRows) ? keepRows : [];
    setError("");
    setSuccess("");

    if (!filter.pmonth || !filter.leave_type_code) {
      setError("Process Month and Leave Type are mandatory");
      return false;
    }

    try {
      const revision = ++queryRevision.current;
      const snapshot = { ...filter };
      const res = await axios.get("/api/leave/query", {
        params: {
          pmonth: filter.pmonth,
          contractor_id: filter.contractor_id || "",
          leave_type_code: filter.leave_type_code,
        },
      });
      if (revision !== queryRevision.current) return false;
      setRows([...(res.data.data || []), ...kept]);
      setQuerySnapshot(snapshot);
      setEntryMode(kept.length > 0);
      setSearchText("");
      setPageNo(1);
      return true;
    } catch (e) {
      setError(apiErrorMessage(e, "Failed to query leave ledger"));
      return false;
    }
  };

  const addRow = () => {
    setError("");
    setSuccess("");

    if (!filter.pmonth || !filter.leave_type_code) {
      return setError("Select Process Month and Leave Type before adding row");
    }

    if (!entryMode) {
      setRows((prev) => [...prev, makeNewRow()]);
      setEntryMode(true);
      setSearchText("");
      setPageNo(Math.ceil((rows.length + 1) / PAGE_SIZE));
    } else {
      setRows((prev) => [...prev, makeNewRow()]);
      setPageNo(Math.ceil((rows.length + 1) / PAGE_SIZE));
    }

    setTimeout(() => empRef.current?.focus(), 100);
  };

  const updateRow = (index, field, value) => {
    const copy = [...rows];
    copy[index] = { ...copy[index], is_dirty: true };
    copy[index][field] = value;

    if (field === "employee_code") {
      const emp = employees.find((x) => String(x.value) === String(value));
      copy[index].employee_name = emp?.employee_name || "";
    }

    if (field === "trans_type") {
      const t = transTypes.find((x) => String(x.value) === String(value));
      copy[index].balance_effect = t?.balance_effect || "";
    }

    setRows(copy);
  };

  const saveChanges = async () => {
    setError("");
    setSuccess("");

    if (savingRef.current) return;

    const saveRows = rows.filter(
      (r) => (r.ref_type === "MANUAL" || r.is_new) && (r.is_new || r.is_dirty),
    );

    if (!saveRows.length) return setError("No new or edited rows to save");

    for (const r of saveRows) {
      if (!r.employee_code || !r.trans_type || !r.leave_days) {
        return setError(
          "Emp.Code, Transaction Type and Leave Days are mandatory",
        );
      }

      if (Number(r.leave_days) <= 0) {
        return setError("Leave Days must be greater than zero");
      }
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await axios.post("/api/leave/save-bulk", { rows: saveRows });
      if (await queryData()) setSuccess("Leave ledger saved successfully");
    } catch (e) {
      setError(apiErrorMessage(e, "Failed to save leave ledger"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const toggleSelect = (index) => {
    const copy = [...rows];
    copy[index].selected = !copy[index].selected;
    setRows(copy);
  };

  const deleteSelected = async () => {
    const savedIds = rows
      .filter((r) => r.selected && r.trans_id && r.ref_type === "MANUAL")
      .map((r) => r.trans_id);

    const hasUnsavedSelected = rows.some((r) => r.selected && !r.trans_id);

    if (!savedIds.length && !hasUnsavedSelected) {
      return setError("Select manual rows to delete");
    }

    if (!window.confirm("Delete selected leave ledger entries?")) return;

    try {
      if (savedIds.length) {
        await axios.post("/api/leave/delete", { trans_ids: savedIds });
      }

      if (savedIds.length) {
        // The server changed: re-query so deleted trans_ids are never re-sent, keeping other unsaved new rows
        const keep = rows.filter((r) => r.is_new && !r.selected);
        if (await queryData(keep)) setSuccess("Selected rows deleted successfully");
      } else {
        setRows((prev) => prev.filter((r) => !(r.selected && !r.trans_id)));
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Failed to delete rows"));
    }
  };

  const cancelEntry = () => {
    navigate(MENU_URL);
  };

  const exportXls = () => {
    setError("");
    setSuccess("");
    if (rows.some((row) => row.is_new || row.is_dirty)) {
      return setError("Save or query again to discard unsaved ledger changes before exporting.");
    }
    if (!querySnapshot || !searchedRows.length) return setError("Query the ledger and ensure there are matching records before exporting.");
    try {
      downloadWorkbook({
        title: "Leave Ledger Entry / Adjustment",
        sheetName: "Leave Ledger",
        columns: [
          { key: "trans_id", label: "Transaction ID" },
          { key: "employee_code", label: "Employee Code" },
          { key: "employee_name", label: "Employee Name" },
          { key: "trans_type", label: "Transaction Type" },
          { key: "balance_effect", label: "Effect" },
          { key: "leave_days", label: "Leave Days" },
          { key: "remarks", label: "Remarks" },
          { key: "ref_type", label: "Reference Type" },
          { key: "created_by", label: "Created By" },
          { key: "created_date", label: "Created Date" },
        ],
        rows: searchedRows.map((row) => ({ ...row, leave_days: Number(row.leave_days || 0) })),
        metadata: {
          "Process month": querySnapshot.pmonth,
          "Contractor": contractors.find((item) => item.value === querySnapshot.contractor_id)?.label || "All contractors",
          "Leave type": leaveTypes.find((item) => item.value === querySnapshot.leave_type_code)?.label || querySnapshot.leave_type_code,
          "Employee search": searchText || "None",
          "Saved state": "Saved queried ledger rows; no unsaved edits",
        },
      }, `CLMS_Leave_Ledger_${querySnapshot.pmonth.substring(0, 7)}`);
      setSuccess(`Exported ${searchedRows.length} saved ledger records across all matching pages.`);
    } catch (exportError) {
      setError(exportError.message || "Could not export the leave ledger.");
    }
  };

  const filteredEmployees = filter.contractor_id
    ? employees.filter(
        (e) =>
          String(e.contractor_id || "").trim() ===
          String(filter.contractor_id || "").trim(),
      )
    : employees;

  const searchedRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const code = String(r.employee_code || "").toLowerCase();
      const name = String(r.employee_name || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [rows, searchText]);

  const totalPages = Math.max(1, Math.ceil(searchedRows.length / PAGE_SIZE));

  const pagedRows = useMemo(() => {
    const start = (pageNo - 1) * PAGE_SIZE;
    return searchedRows.slice(start, start + PAGE_SIZE);
  }, [searchedRows, pageNo]);

  useEffect(() => {
    if (pageNo > totalPages) setPageNo(totalPages);
  }, [pageNo, totalPages]);

  const getOriginalIndex = (row) => rows.indexOf(row);

  const ActionButtons = () => (
    <div className="d-flex gap-2 flex-wrap">
      <Button size="sm" variant="primary" onClick={saveChanges} disabled={saving}>
        Save
      </Button>
      <Button size="sm" variant="outline-danger" onClick={deleteSelected}>
        Delete Selected
      </Button>
      <Button size="sm" variant="secondary" onClick={cancelEntry}>
        Cancel
      </Button>
    </div>
  );

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
      <h5>Leave Ledger Entry / Adjustment</h5>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div
        className={styles["form-grid"]}
        style={{
          fontSize: "0.72rem",
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        <Form.Group>
          <Form.Label>Process Month</Form.Label>
          <Select
            options={processMonths}
            value={processMonths.find((m) => m.value === filter.pmonth) || null}
            onChange={(o) => handleFilterSelect(o, "pmonth")}
            placeholder="Select active month"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Contractor</Form.Label>
          <Select
            options={contractors}
            value={
              contractors.find((c) => c.value === filter.contractor_id) || null
            }
            onChange={(o) => handleFilterSelect(o, "contractor_id")}
            isClearable
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Leave Type</Form.Label>
          <Select
            options={leaveTypes}
            value={
              leaveTypes.find((l) => l.value === filter.leave_type_code) || null
            }
            onChange={(o) => handleFilterSelect(o, "leave_type_code")}
          />
        </Form.Group>

        <Form.Group className="d-flex align-items-end gap-2">
          <Button size="sm" onClick={() => queryData()}>
            Query
          </Button>
          <Button size="sm" variant="success" onClick={addRow}>
            + Add
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={exportXls}>
            Export XLSX
          </Button>
        </Form.Group>
      </div>

      <div className="mt-2 mb-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
        <ActionButtons />

        <div style={{ width: 260 }}>
          <Form.Control
            size="sm"
            placeholder="Search Emp Code / Name"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPageNo(1);
            }}
          />
        </div>
      </div>

      <Table bordered size="sm">
        <thead>
          <tr>
            <th></th>
            <th>Trans Id</th>
            <th>Emp.Code</th>
            <th>Employee Name</th>
            <th>Trans Type</th>
            <th>Effect</th>
            <th>Leave Days</th>
            <th>Remarks</th>
            <th>Ref.Type</th>
            <th>Created By</th>
            <th>Created Date</th>
          </tr>
        </thead>

        <tbody>
          {pagedRows.map((r, i) => {
            const originalIndex = getOriginalIndex(r);
            const isManual = r.ref_type === "MANUAL" || r.is_new;

            return (
              <tr key={`${r.trans_id || "new"}-${originalIndex}`}>
                <td className="text-center">
                  <Form.Check
                    checked={!!r.selected}
                    disabled={!isManual}
                    onChange={() => toggleSelect(originalIndex)}
                  />
                </td>

                <td>{r.trans_id || ""}</td>

                <td style={{ minWidth: 220 }}>
                  <Select
                    ref={i === pagedRows.length - 1 ? empRef : null}
                    options={filteredEmployees}
                    value={
                      filteredEmployees.find(
                        (e) => String(e.value) === String(r.employee_code),
                      ) || null
                    }
                    isDisabled={!isManual}
                    onChange={(o) =>
                      updateRow(
                        originalIndex,
                        "employee_code",
                        o ? o.value : "",
                      )
                    }
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    styles={selectPortalStyles}
                    placeholder="Select Employee"
                  />
                </td>

                <td>{r.employee_name}</td>

                <td style={{ minWidth: 190 }}>
                  <Select
                    options={transTypes}
                    value={
                      transTypes.find(
                        (t) => String(t.value) === String(r.trans_type),
                      ) || null
                    }
                    isDisabled={!isManual}
                    onChange={(o) =>
                      updateRow(originalIndex, "trans_type", o ? o.value : "")
                    }
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    styles={selectPortalStyles}
                    placeholder="Select Type"
                  />
                </td>

                <td>{r.balance_effect}</td>

                <td style={{ width: 90 }}>
                  <Form.Control
                    size="sm"
                    type="number"
                    step="0.5"
                    value={r.leave_days || ""}
                    disabled={!isManual}
                    onChange={(e) =>
                      updateRow(originalIndex, "leave_days", e.target.value)
                    }
                  />
                </td>

                <td>
                  <Form.Control
                    size="sm"
                    value={r.remarks || ""}
                    disabled={!isManual}
                    onChange={(e) =>
                      updateRow(originalIndex, "remarks", e.target.value)
                    }
                  />
                </td>

                <td>{r.ref_type || "MANUAL"}</td>
                <td>{r.created_by}</td>
                <td>
                  {r.created_date
                    ? new Date(r.created_date).toLocaleString()
                    : ""}
                </td>
              </tr>
            );
          })}

          {pagedRows.length === 0 && (
            <tr>
              <td colSpan="11" className="text-center text-muted">
                No records found. Select filters and click Query or Add.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <div className="d-flex justify-content-between align-items-center mt-2 mb-2">
        <div style={{ fontSize: "0.75rem" }}>
          Showing {pagedRows.length} of {searchedRows.length} records
        </div>

        <div className="d-flex gap-2 align-items-center">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={pageNo <= 1}
            onClick={() => setPageNo((p) => p - 1)}
          >
            Prev
          </Button>

          <span style={{ fontSize: "0.75rem" }}>
            Page {pageNo} / {totalPages}
          </span>

          <Button
            size="sm"
            variant="outline-secondary"
            disabled={pageNo >= totalPages}
            onClick={() => setPageNo((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="mt-2 mb-2">
        <ActionButtons />
      </div>
    </div>
  );
};

export default LeaveLedgerEntry;
