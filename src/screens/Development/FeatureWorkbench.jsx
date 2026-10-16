import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Accordion, Alert, Badge, Button, Form, Table } from "react-bootstrap";
import api from "../../api/axios.js";
import styles from "./FeatureWorkbench.module.css";

const readable = (value) => String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
const displayValue = (value) => value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
const statusNames = { complete: "Available locally", needs_rules: "BFCL rules required", external_integration: "External integration required", in_progress: "In progress" };
const statusColors = { complete: "success", needs_rules: "warning", external_integration: "secondary", in_progress: "info" };

function RuleFields({ rules, path = [], onChange }) {
  return Object.entries(rules || {}).map(([key, value]) => {
    const fieldPath = [...path, key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return <fieldset className={styles.ruleGroup} key={key}><legend>{readable(key)}</legend><RuleFields rules={value} path={fieldPath} onChange={onChange} /></fieldset>;
    }
    return <Form.Group key={key} controlId={`rule-${fieldPath.join("-")}`} className="mb-3">
      <Form.Label>{readable(key)}</Form.Label>
      <Form.Control as="textarea" rows={2} value={displayValue(value)} placeholder="Awaiting supplied BFCL rule / source" onChange={(event) => onChange(fieldPath, event.target.value)} />
    </Form.Group>;
  });
}

export default function FeatureWorkbench() {
  const [features, setFeatures] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [newStateCode, setNewStateCode] = useState("");
  const [newStateName, setNewStateName] = useState("");

  const load = async () => {
    setBusy(true);
    try {
      const [featureResponse, profileResponse, rulesResponse, readinessResponse] = await Promise.all([
        api.get("/api/dev/features"), api.get("/api/compliance/profiles"), api.get("/api/payroll/rules"), api.get("/api/payroll/readiness"),
      ]);
      setFeatures(featureResponse.data.data || []);
      setProfiles(profileResponse.data.profiles || []);
      setProfile(rulesResponse.data);
      setDraft(structuredClone(rulesResponse.data));
      setReadiness(readinessResponse.data);
      setDirty(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load the local feature workbench.");
    } finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const changeRule = (path, value) => {
    setDraft((current) => {
      const updated = structuredClone(current);
      let target = updated.rules;
      for (const key of path.slice(0, -1)) target = target[key];
      target[path.at(-1)] = value.trim() ? value : null;
      return updated;
    });
    setDirty(true);
    setMessage("");
  };

  const updateMetadata = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value || null }));
    setDirty(true);
    setMessage("");
  };

  const saveDraft = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (draft.effectiveFrom && draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) return setError("Effective to must be on or after effective from.");
    setBusy(true);
    try {
      await api.put("/api/payroll/rules", {
        rules: draft.rules, status: "DRAFT", expectedVersion: profile.version,
        effectiveFrom: draft.effectiveFrom || null, effectiveTo: draft.effectiveTo || null,
        sourceRef: draft.sourceRef || null, verificationStatus: draft.verificationStatus || "UNVERIFIED",
      });
      await load();
      setMessage("Local BFCL rule draft saved. Payroll calculations and statutory formats remain pending verification and implementation.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not save the rule draft.");
    } finally { setBusy(false); }
  };

  const activateProfile = async (profileId) => {
    if (dirty) return setError("Save the current draft or discard its unsaved changes before changing state profiles.");
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api.put("/api/compliance/profiles/active", { profileId });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not select the state profile.");
    } finally { setBusy(false); }
  };

  const createProfile = async (event) => {
    event.preventDefault();
    if (dirty) return setError("Save the current draft or discard its unsaved changes before creating another state profile.");
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api.post("/api/compliance/profiles", { stateCode: newStateCode.trim().toUpperCase(), name: newStateName.trim() });
      setNewStateCode("");
      setNewStateName("");
      await load();
      setMessage("State profile created with blank rules. Select it to enter source-backed requirements.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not create the state profile.");
    } finally { setBusy(false); }
  };

  const missingFields = readiness?.missingFields || [];
  const visibleFeatures = features.filter((feature) => !filterStatus || feature.status === filterStatus);

  return <div className={styles.workbench}>
    <div className={styles.titleRow}><div><h2>Feature development workbench</h2><p>Local feature coverage and source-backed BFCL rule intake.</p></div><Link className="btn btn-outline-secondary btn-sm" to="/dashboard">Dashboard</Link></div>
    {error && <Alert variant="danger" role="alert">{error}</Alert>}
    {message && <Alert variant="success" role="status">{message}</Alert>}
    <Alert variant="warning">This workspace uses fictional local data. Draft rule entry does not enable a payroll engine or certify a statutory report.</Alert>

    <section className={styles.panel}>
      <div className={styles.titleRow}><h3>Feature coverage</h3><Form.Select size="sm" aria-label="Filter feature status" className={styles.statusFilter} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="">All feature statuses</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Form.Select></div>
      <div className="table-responsive"><Table size="sm" bordered><thead><tr><th>Feature</th><th>Status</th><th>Scope / requirements</th><th>Open</th></tr></thead><tbody>{visibleFeatures.map((feature) => <tr key={feature.id}><td>{feature.title}</td><td><Badge bg={statusColors[feature.status] || "secondary"} text={feature.status === "needs_rules" ? "dark" : undefined}>{statusNames[feature.status] || readable(feature.status)}</Badge></td><td>{feature.description}{feature.requirements?.some((item) => item !== feature.description) && <ul className="mb-0 mt-1">{feature.requirements.filter((item) => item !== feature.description).map((item, index) => <li key={index}>{typeof item === "string" ? item : item.label || item.description || JSON.stringify(item)}</li>)}</ul>}</td><td>{feature.path ? <Link to={feature.path}>Open</Link> : "—"}</td></tr>)}{!visibleFeatures.length && <tr><td colSpan={4}>{busy ? "Loading local features…" : "No features match this status."}</td></tr>}</tbody></Table></div>
    </section>

    <section className={styles.panel}>
      <h3>BFCL compliance profile</h3>
      <p>Keep central law, state requirements and company policy separate. Enter only supplied requirements with their source and effective period.</p>
      <Form.Group controlId="active-profile" className="mb-3"><Form.Label>Selected state profile</Form.Label><Form.Select value={profile?.id || ""} disabled={busy} onChange={(event) => activateProfile(event.target.value)}><option value="" disabled>Select a profile</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.stateCode})</option>)}</Form.Select></Form.Group>
      <Accordion className="mb-3"><Accordion.Item eventKey="create-profile"><Accordion.Header>Add another state profile</Accordion.Header><Accordion.Body><Form onSubmit={createProfile}><div className={styles.metadataGrid}><Form.Group controlId="new-state-code"><Form.Label>State code</Form.Label><Form.Control required maxLength={10} placeholder="Enter state code" value={newStateCode} onChange={(event) => setNewStateCode(event.target.value)} /></Form.Group><Form.Group controlId="new-state-name"><Form.Label>State name</Form.Label><Form.Control required placeholder="Enter state name" value={newStateName} onChange={(event) => setNewStateName(event.target.value)} /></Form.Group></div><Button type="submit" size="sm" disabled={busy || !newStateCode.trim() || !newStateName.trim()}>Create blank profile</Button></Form></Accordion.Body></Accordion.Item></Accordion>

      {draft && <Form onSubmit={saveDraft}>
        <div className={styles.metadataGrid}>
          <Form.Group controlId="effective-from"><Form.Label>Effective from</Form.Label><Form.Control type="date" value={draft.effectiveFrom || ""} onChange={(event) => updateMetadata("effectiveFrom", event.target.value)} /></Form.Group>
          <Form.Group controlId="effective-to"><Form.Label>Effective to</Form.Label><Form.Control type="date" value={draft.effectiveTo || ""} onChange={(event) => updateMetadata("effectiveTo", event.target.value)} /></Form.Group>
          <Form.Group controlId="source-ref"><Form.Label>Source reference</Form.Label><Form.Control value={draft.sourceRef || ""} placeholder="Policy / notification / approved rule reference" onChange={(event) => updateMetadata("sourceRef", event.target.value)} /></Form.Group>
          <Form.Group controlId="verification-status"><Form.Label>Verification status</Form.Label><Form.Select value={draft.verificationStatus || "UNVERIFIED"} onChange={(event) => updateMetadata("verificationStatus", event.target.value)}><option value="UNVERIFIED">Unverified draft</option><option value="SOURCE_REVIEW_PENDING">Source review pending</option></Form.Select></Form.Group>
        </div>
        <p className={styles.help}>All rule fields accept draft policy text. Leave unknown values blank. Saving preserves entered text; rates and formulas are not executed.</p>
        <Accordion alwaysOpen>{["central", "state", "company"].map((section) => <Accordion.Item key={section} eventKey={section}><Accordion.Header>{({ central: "Central requirements", state: "State requirements", company: "BFCL company policy" })[section]}</Accordion.Header><Accordion.Body><RuleFields rules={draft.rules?.[section]} path={[section]} onChange={changeRule} /></Accordion.Body></Accordion.Item>)}</Accordion>
        <div className={styles.actions}><Button type="submit" disabled={busy || !dirty}>{busy ? "Saving / loading…" : "Save local draft"}</Button><Button variant="outline-secondary" disabled={busy || !dirty} onClick={() => { setDraft(structuredClone(profile)); setDirty(false); setError(""); setMessage("Unsaved draft changes discarded."); }}>Discard unsaved changes</Button><span>{dirty ? "Unsaved changes" : `Saved draft version ${profile.version || 1}`}</span></div>
      </Form>}
      {profile?.history?.length > 0 && <details className="mt-3"><summary>Saved version history ({profile.history.length})</summary>{[...profile.history].reverse().map((version) => <div className="border rounded p-3 mt-2" key={version.version}><strong>Draft version {version.version}</strong><p className="mb-1">Effective: {version.effectiveFrom || 'Unspecified'} to {version.effectiveTo || 'Unspecified'} · {readable(version.verificationStatus)}</p><p className="mb-1">Source: {version.sourceRef || 'Awaiting supplied source'}</p><details><summary>View saved rule text</summary><pre className="mt-2" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(version.rules, null, 2)}</pre></details></div>)}</details>}
    </section>

    <section className={styles.panel}>
      <h3>Payroll and compliance readiness</h3>
      <p><Badge bg="warning" text="dark">{readable(readiness?.status || "Loading")}</Badge></p>
      <p>{readiness?.engineImplemented ? "Review the returned readiness requirements before any calculation workflow." : "Payroll calculation requires supplied BFCL rules, source verification and engine implementation. Completed draft fields do not enable wage calculation."}</p>
      {missingFields.length > 0 && <details><summary>{readiness?.missingCount ?? missingFields.length} rule requirements still need input</summary><ul className="mt-2">{missingFields.map((field) => <li key={field.path || field.label}>{field.label || readable(field.path)} <span className={styles.fieldPath}>({field.path})</span></li>)}</ul></details>}
      {!missingFields.length && readiness && <p>Draft fields have been entered. Source verification, approved formats and calculation implementation still require separate validation.</p>}
    </section>
  </div>;
}
