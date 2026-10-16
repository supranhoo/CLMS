import React, { useEffect, useMemo, useState } from "react";
import axios from "../../api/axios.js";
import { MASTER_DEFINITIONS } from "./config/masterDefinitions";
import styles from "./MasterDataManager.module.css";

const normalizeTime = (value) => (value ? String(value).slice(0, 8) : "");
const normalizeDate = (value) => (value ? String(value).slice(0, 10) : "");
const display = (value) =>
  value == null || value === ""
    ? "—"
    : typeof value === "string" && /^\d\d:\d\d:\d\d/.test(value)
      ? normalizeTime(value)
      : String(value);

export default function MasterDataManager({ master }) {
  const config = MASTER_DEFINITIONS[master];
  const [rows, setRows] = useState([]),
    [lookups, setLookups] = useState({}),
    [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState({}),
    [notice, setNotice] = useState(null),
    [confirmRow, setConfirmRow] = useState(null);

  const blank = () =>
    Object.fromEntries(
      config.fields.map((f) => [f.name, f.defaultValue ?? ""]),
    );
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/master-data/${master}`);
      setRows(data);
    } catch (e) {
      setNotice({
        type: "error",
        text: e.response?.data?.message || e.message,
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    axios
      .get("/api/master-data/lookups")
      .then((r) => setLookups(r.data))
      .catch(() => {});
  }, [master]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q
      ? rows
      : rows.filter((r) =>
          config.columns.some((c) =>
            String(r[c] ?? "")
              .toLowerCase()
              .includes(q),
          ),
        );
  }, [rows, search, config]);
  const openNew = () => {
    setEditing("new");
    setForm(blank());
    setNotice(null);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm(
      Object.fromEntries(
        config.fields.map((f) => [
          f.name,
          f.type === "time"
            ? normalizeTime(row[f.name])
            : f.type === "date"
              ? normalizeDate(row[f.name])
              : (row[f.name] ?? ""),
        ]),
      ),
    );
    setNotice(null);
  };
  const keysOf = (row) =>
    Object.fromEntries(config.keyFields.map((k) => [k, row[k]]));
  const validate = () => {
    const missing = config.fields.filter(
      (f) => f.required && String(form[f.name] ?? "").trim() === "",
    );
    if (missing.length) {
      setNotice({
        type: "error",
        text: `Please enter ${missing.map((x) => x.label).join(", ")}.`,
      });
      return false;
    }
    return true;
  };
  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing === "new")
        await axios.post(`/api/master-data/${master}`, form);
      else
        await axios.put(`/api/master-data/${master}`, {
          keys: keysOf(editing),
          data: form,
        });
      setEditing(null);
      setNotice({ type: "success", text: "Record saved successfully." });
      await load();
    } catch (e) {
      setNotice({
        type: "error",
        text: e.response?.data?.message || e.message,
      });
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    try {
      await axios.delete(`/api/master-data/${master}`, {
        data: { keys: keysOf(confirmRow) },
      });
      setConfirmRow(null);
      setNotice({ type: "success", text: "Record deleted successfully." });
      await load();
    } catch (e) {
      setConfirmRow(null);
      setNotice({
        type: "error",
        text: e.response?.data?.message || e.message,
      });
    }
  };
  const optionsFor = (f) =>
    f.options ||
    (f.lookup
      ? (lookups[f.lookup] || []).filter(
          (o) =>
            f.lookup !== "divisions" ||
            !form.ENTITY_CODE ||
            o.entity_code === form.ENTITY_CODE,
        )
      : []);
  const renderField = (f) => (
    <label className={styles.field} key={f.name}>
      <span>
        {f.label}
        {f.required && <b> *</b>}
      </span>
      {f.type === "select" || f.type === "lookup" ? (
        <select
          value={form[f.name] ?? ""}
          onChange={(e) => setForm((x) => ({ ...x, [f.name]: e.target.value }))}
          disabled={editing !== "new" && config.keyFields.includes(f.name)}
        >
          <option value="">{f.blankLabel || `Select ${f.label}`}</option>
          {optionsFor(f).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={f.type || "text"}
          step={f.type === "time" ? "1" : undefined}
          maxLength={f.maxLength}
          required={f.required}
          value={form[f.name] ?? ""}
          onChange={(e) => setForm((x) => ({ ...x, [f.name]: e.target.value }))}
          disabled={editing !== "new" && config.keyFields.includes(f.name)}
        />
      )}
    </label>
  );
  const sections = config.sections || [
    { title: "Details", fields: config.fields.map((f) => f.name) },
  ];

  return (
    <main className={styles.page}>
      <section className={`${styles.card} ${config.wide ? styles.wide : ""}`}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>BFCL · MASTER DATA</div>
            <h1>{config.title}</h1>
            <p>{config.subtitle}</p>
          </div>
          <button className={styles.primary} onClick={openNew}>
            ＋ Add New
          </button>
        </header>
        {notice && (
          <div className={`${styles.notice} ${styles[notice.type]}`}>
            {notice.text}
            <button onClick={() => setNotice(null)}>×</button>
          </div>
        )}
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${config.title.toLowerCase()}…`}
            />
          </div>
          <span className={styles.count}>
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </span>
          <button className={styles.refresh} onClick={load}>
            ↻ Refresh
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c}>
                    {config.fields.find((f) => f.name === c)?.label || c}
                  </th>
                ))}
                <th className={styles.actionHead}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={config.columns.length + 1}
                    className={styles.empty}
                  >
                    Loading records…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={config.columns.length + 1}
                    className={styles.empty}
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={config.keyFields.map((k) => r[k]).join("|")}>
                    <>
                      {config.columns.map((c, j) => (
                        <td key={c}>
                          {j === 0 ? (
                            <span className={styles.code}>{display(r[c])}</span>
                          ) : (
                            display(r[c])
                          )}
                        </td>
                      ))}
                    </>
                    <td className={styles.rowActions}>
                      <button onClick={() => openEdit(r)}>Edit</button>
                      <button
                        className={styles.delete}
                        onClick={() => setConfirmRow(r)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <section
            className={`${styles.modal} ${config.wide ? styles.modalWide : ""}`}
          >
            <header>
              <div>
                <h2>
                  {editing === "new" ? "Add" : "Edit"}{" "}
                  {config.title.replace(/s$/, "")}
                </h2>
                <p>
                  {editing === "new"
                    ? "Enter the new master record details."
                    : "Update the selected record. Key fields are locked."}
                </p>
              </div>
              <button onClick={() => setEditing(null)}>×</button>
            </header>
            <div className={styles.formBody}>
              {sections.map((s) => (
                <fieldset key={s.title}>
                  <legend>{s.title}</legend>
                  <div className={styles.formGrid}>
                    {s.fields.map((n) =>
                      renderField(config.fields.find((f) => f.name === n)),
                    )}
                  </div>
                </fieldset>
              ))}
            </div>
            <footer>
              <button
                className={styles.cancel}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className={styles.primary}
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Record"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {confirmRow && (
        <div className={styles.overlay}>
          <section className={styles.confirm}>
            <div className={styles.warn}>!</div>
            <h2>Delete this record?</h2>
            <p>
              This action cannot be undone. Related records may prevent
              deletion.
            </p>
            <div>
              <button
                className={styles.cancel}
                onClick={() => setConfirmRow(null)}
              >
                Keep Record
              </button>
              <button className={styles.danger} onClick={remove}>
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
