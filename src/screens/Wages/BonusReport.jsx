import React, { useEffect, useMemo, useState } from "react";
import axios from "../../api/axios.js";
import moment from "moment";
import Select from "react-select";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import exportBonusReportToXLS from "../../components/ExportBonusReportToXLS";
import styles from "./BonusReport.module.css";
import { apiErrorMessage } from "../../utils/apiError";

const ALL = { value: "ALL", label: "Select All" };
const valuesOf = (items) => items.some((x) => x.value === "ALL") ? [] : items.map((x) => x.value);
const formatOptions = (rows, value, label) => [ALL, ...rows.map((x) => ({ value: x[value], label: x[label] }))];

export default function BonusReport() {
  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const [billingOptions, setBillingOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [options, setOptions] = useState({ empType: [], contractor: [], bu: [], entity: [], department: [], location: [] });
  const [form, setForm] = useState({ billing: null, from: null, to: null, empType: [], contractor: [], bu: [], entity: [], department: [], location: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!emp_id) return;
    Promise.all([
      axios.get("/api/employee/getBillingType"),
      axios.get("/api/employee/getEmpType"),
      axios.get("/api/contractor/getAllContractors"),
      axios.post("/api/entity/getAssignedBU", { emp_id }),
      axios.post("/api/entity/getAssignedEntity", { emp_id }),
      axios.post("/api/entity/getAllDept"),
      axios.post("/api/entity/getAssignedLocCode", { emp_id }),
    ]).then(([billing, empType, contractor, bu, entity, department, location]) => {
      setBillingOptions(billing.data.map((x) => ({ value: x.billingtype_code, label: x.billingtype_name })));
      setOptions({
        empType: formatOptions(empType.data, "emp_type_code", "emp_type_desc"),
        contractor: formatOptions(contractor.data, "Contractor_ID", "Contractor_Name"),
        bu: formatOptions(bu.data, "bu_code", "bu_name"),
        entity: formatOptions(entity.data, "entity_code", "entity_name"),
        department: formatOptions(department.data, "dept_code", "dept_name"),
        location: formatOptions(location.data, "loc_code", "loc_name"),
      });
    }).catch((error) => setMessage(apiErrorMessage(error)));
  }, [emp_id]);

  useEffect(() => {
    if (!form.billing) return;
    axios.post("/api/wages/getAllProcessMonthByBillingCycle", { billingtype: form.billing.value })
      .then(({ data }) => {
        const months = data
          .map((x) => ({ value: String(x.pmonth).slice(0, 10), label: moment(x.pmonth).format("MMM-YYYY") }))
          .sort((a, b) => a.value.localeCompare(b.value));
        setMonthOptions(months);
        setForm((current) => ({ ...current, from: null, to: null }));
      });
  }, [form.billing]);

  const valid = useMemo(() => form.billing && form.from && form.to && form.from.value <= form.to.value, [form]);
  const setMulti = (name, selected) => {
    const picked = selected || [];
    setForm((current) => ({ ...current, [name]: picked.some((x) => x.value === "ALL") ? options[name] : picked }));
  };

  const generate = async () => {
    if (!valid) return setMessage("Select a valid Billing Cycle, From Month and To Month.");
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        billingType: form.billing.value,
        from_pmonth: form.from.value,
        to_pmonth: form.to.value,
        emp_type: valuesOf(form.empType),
        contractor: valuesOf(form.contractor),
        bu: valuesOf(form.bu),
        entity: valuesOf(form.entity),
        department: valuesOf(form.department),
        location: valuesOf(form.location),
        emp_id,
      };
      const { data } = await axios.post("/api/wages/getBonusReport", payload);
      await exportBonusReportToXLS({ rows: data, fromPmonth: payload.from_pmonth, toPmonth: payload.to_pmonth, billingType: payload.billingType });
      setMessage(`Bonus report generated successfully for ${data.length} employee-month records.`);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const multi = (name, label) => (
    <label className={styles.field}><span>{label}</span><Select isMulti closeMenuOnSelect={false} options={options[name]} value={form[name]} onChange={(v) => setMulti(name, v)} /></label>
  );

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.heading}><div><h1>Bonus Report</h1><p>Generate a professionally formatted employee bonus statement for a payroll period.</p></div><span>XLSX</span></div>
        <div className={styles.grid}>
          <label className={styles.field}><span>Billing Cycle *</span><Select options={billingOptions} value={form.billing} onChange={(v) => setForm((x) => ({ ...x, billing: v }))} /></label>
          <label className={styles.field}><span>From Process Month *</span><Select options={monthOptions} value={form.from} onChange={(v) => setForm((x) => ({ ...x, from: v }))} /></label>
          <label className={styles.field}><span>To Process Month *</span><Select options={monthOptions} value={form.to} onChange={(v) => setForm((x) => ({ ...x, to: v }))} /></label>
          {multi("empType", "Employee Type")}{multi("contractor", "Contractor")}{multi("bu", "Business Unit")}
          {multi("entity", "Entity")}{multi("department", "Department")}{multi("location", "Location")}
        </div>
        {message && <div className={styles.message}>{message}</div>}
        <div className={styles.actions}><button type="button" onClick={generate} disabled={!valid || busy}>{busy ? "Generating…" : "Export Bonus Report"}</button></div>
      </section>
    </main>
  );
}
