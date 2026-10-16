import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Form, Table } from "react-bootstrap";
import api from "../../api/axios.js";
import { downloadWorkbook, LOCAL_DATA_NOTICE } from "../../utils/exportWorkbook.js";
import styles from "./ComplianceReports.module.css";

const formTitles = {
  "form-xii-register-of-contractors": "Form XII — Register of contractors",
  "form-xiii-register-of-workmen": "Form XIII — Register of workmen",
  "form-xix-wage-slip": "Form XIX — Wage slip",
  "form-xvi-muster-roll": "Form XVI — Muster roll",
  "form-xviii-wages-cum-muster-roll": "Form XVIII — Wages-cum-Muster Roll",
  "form-xxiii-register-of-overtime": "Form XXIII — Register of Overtime",
};
const cellText = (value) => value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);

export default function ComplianceReports() {
  const params = useParams();
  const form = params.form || params.module;
  const requiresMonth = ['form-xvi-muster-roll', 'form-xviii-wages-cum-muster-roll', 'form-xxiii-register-of-overtime'].includes(form);
  // The print stylesheet hides everything except the report. That rule is keyed to this body class so it can only
  // apply while a compliance report is mounted; other screens print normally (W0/U02, gate A03).
  useEffect(() => {
    document.body.classList.add("printing-compliance-report");
    return () => document.body.classList.remove("printing-compliance-report");
  }, []);
  const [months, setMonths] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [pmonth, setPmonth] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [report, setReport] = useState(null);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);

  useEffect(() => {
    let alive = true;
    Promise.all([api.post("/api/wages/getAllProcessMonth"), api.get("/api/contractor/getAllContractors")]).then(([monthResponse, contractorResponse]) => {
      if (!alive) return;
      const allMonths = monthResponse.data.data || monthResponse.data || [];
      setMonths([...new Map(allMonths.map((month) => [String(month.pmonth).substring(0, 10), month])).values()]);
      setContractors(contractorResponse.data.data || contractorResponse.data || []);
    }).catch((requestError) => { if (alive) setError(requestError.response?.data?.message || "Could not load report filters."); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { revision.current += 1; setReport(null); setSearch(""); setError(""); setMessage(""); }, [form]);

  const clearPreview = () => { revision.current += 1; setReport(null); setSelectedColumns([]); setMessage(""); setError(""); };
  const preview = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const requestRevision = ++revision.current;
    const snapshot = { pmonth, contractorId, generatedAt: new Date().toISOString() };
    setReport(null);
    try {
      const response = await api.get("/api/compliance/report", { params: { form, pmonth, contractor_id: contractorId } });
      if (requestRevision !== revision.current) return;
      setReport({ ...response.data, snapshot: { ...snapshot, pmonth: response.data.scope?.pmonth || '' } });
      setSelectedColumns((response.data.columns || []).map((column) => column.key));
      setSearch("");
    } catch (requestError) {
      if (requestRevision === revision.current) setError(requestError.response?.data?.message || "Could not preview local report data.");
    } finally { if (requestRevision === revision.current) setBusy(false); }
  };

  const columns = (report?.columns || []).filter((column) => selectedColumns.includes(column.key));
  const rows = (report?.data || []).filter((row) => !search.trim() || Object.values(row).some((value) => cellText(value).toLowerCase().includes(search.trim().toLowerCase())));
  const title = report?.title || formTitles[form] || "Compliance working data";
  const monthLabel = months.find((item) => String(item.pmonth).substring(0, 10) === report?.snapshot.pmonth)?.period_name || report?.snapshot.pmonth || "All available periods";
  const contractorLabel = contractors.find((item) => String(item.Contractor_ID) === report?.snapshot.contractorId)?.Contractor_Name || "All contractors";
  const missingRules = report?.missingRules || [];

  const exportData = () => {
    setError("");
    if (!report || !rows.length || !columns.length) return setError("Preview matching records and select at least one column before exporting.");
    try {
      downloadWorkbook({ title, columns, rows, sheetName: "Working Data", metadata: {
        "Format status": "WORKING DATA / BFCL FORMAT REQUIRED",
        "API format status": report.formatStatus || "BFCL_FORMAT_REQUIRED",
        "Process month": monthLabel, "Contractor": contractorLabel,
        "Search": search || "None", "Preview generated at (UTC)": report.snapshot.generatedAt,
        "Missing requirements": missingRules.map((rule) => typeof rule === "string" ? rule : rule.label || rule.description || JSON.stringify(rule)).join("; "),
        "Use": "Local data review only. Not an approved statutory register, wage slip or filing.",
      } }, `CLMS_${form}_${report.snapshot.pmonth.substring(0, 7) || "all-periods"}_WORKING_DATA`);
      setMessage(`Exported ${rows.length} working-data records.`);
    } catch (exportError) { setError(exportError.message || "Could not export working data."); }
  };

  return <div className={styles.screen}>
    <div className={`${styles.titleRow} ${styles.noPrint}`}><div><h2>{title}</h2><p>Review the available local source data and required BFCL format inputs.</p></div><Link className="btn btn-outline-secondary btn-sm" to="/dashboard">Dashboard</Link></div>
    {error && <Alert className={styles.noPrint} variant="danger" role="alert">{error}</Alert>}
    {message && <Alert className={styles.noPrint} variant="success" role="status">{message}</Alert>}
    <Alert className={styles.noPrint} variant="warning"><strong>WORKING DATA / BFCL FORMAT REQUIRED</strong><p className="mb-0 mt-1">This preview uses fictional local records. Supply the applicable BFCL approved format, field mappings, rule sources and sign-off requirements before treating it as a statutory register or wage slip.</p></Alert>
    <Form onSubmit={preview} className={`${styles.filters} ${styles.noPrint}`}>
      <Form.Group controlId="compliance-month"><Form.Label>Process month</Form.Label><Form.Select required={requiresMonth} value={pmonth} onChange={(event) => { setPmonth(event.target.value); clearPreview(); setBusy(false); }}><option value="">{requiresMonth ? 'Select process month' : 'All available periods'}</option>{months.map((month) => <option key={month.pmonth} value={String(month.pmonth).substring(0, 10)}>{month.period_name || String(month.pmonth).substring(0, 7)}</option>)}</Form.Select></Form.Group>
      <Form.Group controlId="compliance-contractor"><Form.Label>Contractor</Form.Label><Form.Select value={contractorId} onChange={(event) => { setContractorId(event.target.value); clearPreview(); setBusy(false); }}><option value="">All contractors</option>{contractors.map((contractor) => <option key={contractor.Contractor_ID} value={contractor.Contractor_ID}>{contractor.Contractor_Name} ({contractor.Contractor_ID})</option>)}</Form.Select></Form.Group>
      <Button type="submit" disabled={busy}>{busy ? "Loading…" : "Preview working data"}</Button>
    </Form>
    {report && <>
      <section className={`${styles.requirements} ${styles.noPrint}`}><h3>Requirements before BFCL approval</h3>{missingRules.length ? <ul>{missingRules.map((rule, index) => <li key={index}>{typeof rule === "string" ? rule : rule.label || rule.description || JSON.stringify(rule)}</li>)}</ul> : <p>Confirm approved BFCL layout, applicable rule references and reviewer approval.</p>}<Link to="/development/features">Open state profiles and BFCL rule intake</Link></section>
      <div className={`${styles.tools} ${styles.noPrint}`}><Form.Control aria-label="Search working data" placeholder="Search preview records" value={search} onChange={(event) => setSearch(event.target.value)} /><Button variant="outline-primary" disabled={!rows.length || !columns.length} onClick={exportData}>Export XLSX</Button><Button variant="outline-secondary" disabled={!rows.length || !columns.length} onClick={() => window.print()}>Print / Save PDF</Button></div>
      <details className={`${styles.columnSelect} ${styles.noPrint}`}><summary>Choose preview and export columns ({selectedColumns.length})</summary><div>{report.columns?.map((column) => <Form.Check inline key={column.key} id={`column-${column.key}`} label={column.label} checked={selectedColumns.includes(column.key)} onChange={(event) => setSelectedColumns((current) => event.target.checked ? [...current, column.key] : current.filter((key) => key !== column.key))} />)}</div></details>
      <div className={styles.printArea}>
        <div className={styles.printHeading}><h3>{title}</h3><Badge bg="warning" text="dark">WORKING DATA / BFCL FORMAT REQUIRED</Badge><p>{LOCAL_DATA_NOTICE}</p><p>Month: {monthLabel} · Contractor: {contractorLabel} · Search: {search || "None"}<br />Preview generated (UTC): {report.snapshot.generatedAt} · Records: {rows.length}</p></div>
        <div className={styles.tableWrap}><Table bordered striped size="sm"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column.key}>{cellText(row[column.key])}</td>)}</tr>)}{(!rows.length || !columns.length) && <tr><td colSpan={Math.max(1, columns.length)}>{!columns.length ? "Select at least one preview column." : "No matching local source records were found. No calculated payroll values have been fabricated."}</td></tr>}</tbody></Table></div>
        <p className={styles.footnote}>For local development review. This working-data output has not been approved for statutory submission.</p>
      </div>
    </>}
    {!report && !busy && <p className="text-muted">Select filters and preview the available local source records.</p>}
  </div>;
}
