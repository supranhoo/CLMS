// src/components/UploadWageComponents.js
import React, { useState } from "react";
import * as XLSX from "xlsx";
import axios from "../api/axios.js";
import PropTypes from "prop-types";
import { apiErrorMessage } from "../utils/apiError";
import { escapeHtml } from "../utils/escapeHtml";

const UploadEmpWageComp = ({ created_by, onClose, onSuccess, onError }) => {
  const [file, setFile] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const upload = async () => {
    if (!file) return alert("Select a file first!");

    setIsBusy(true);
    try {
      // read workbook
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // transform rows → API payload
      const errors = [];
      const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== "";
      const text = (v) => (hasValue(v) ? String(v).trim() : "");
      const components = [];
      rows.forEach((r, index) => {
        const rowNo = (r.__rowNum__ ?? index + 1) + 1; // spreadsheet row (header is row 1)
        const problems = [];
        const numberField = (name, value, { required = false } = {}) => {
          if (!hasValue(value)) {
            if (required) problems.push(`${name} is required`);
            return 0;
          }
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0) {
            problems.push(`${name} must be a non-negative number`);
            return 0;
          }
          return n;
        };

        const EmployeeCode = text(r["EmployeeCode"]);
        // The app's own export writes BillingType; older files use BillingCycle.
        const billingType = text(r["BillingType"] ?? r["BillingCycle"]).toUpperCase();
        const effRaw = r["eff_date"] ?? r["Eff_Date"] ?? r["EffDate"] ?? r["Date"];
        const eff_date = excelDateToISO(effRaw);
        // Keep compatibility with both the exported header and the legacy header.
        const MEDIALWRT = r["MEDIALWRT"] ?? r["MEDALWRT"];
        const HRAOLDRT = r["HRAOLDRT"] ?? r["OLDHRART"];
        const OTFACTOR = r["OTFactor"] ?? r["OTFACTOR"];

        if (!EmployeeCode) problems.push("EmployeeCode is required");
        if (!billingType) problems.push("BillingType (or BillingCycle) is required");
        else if (!["M", "F"].includes(billingType))
          problems.push("BillingType must be M or F");
        if (!hasValue(effRaw)) problems.push("eff_date is required");
        else if (!eff_date) problems.push("eff_date is not a valid date");

        const BasicRate = numberField("BasicRate", r["BasicRate"], { required: true });
        if (hasValue(r["BasicRate"]) && BasicRate === 0 && Number.isFinite(Number(r["BasicRate"])))
          problems.push("BasicRate must be greater than 0");
        const record = {
          EmployeeCode: EmployeeCode,
          eff_date: eff_date,
          billingType: billingType,
          BasicRate: BasicRate,
          DARate: numberField("DARate", r["DARate"]),
          JaggeryRate: numberField("JaggeryRate", r["JaggeryRate"]),
          GrossRate: numberField("GrossRate", r["GrossRate"]),
          ESIApply: text(r["ESIApply"]) || null,
          PFApply: text(r["PFApply"]) || null,
          LWFApply: text(r["LWFApply"]) || null,
          OTHALWRT: numberField("OTHALWRT", r["OTHALWRT"]),
          HRART: numberField("HRART", r["HRART"]),
          TRALWRT: numberField("TRALWRT", r["TRALWRT"]),
          UNALWRT: numberField("UNALWRT", r["UNALWRT"]),
          MEDIALWRT: numberField("MEDIALWRT", MEDIALWRT),
          CONALWRT: numberField("CONALWRT", r["CONALWRT"]),
          HRAOLDRT: numberField("HRAOLDRT", HRAOLDRT),
          created_by: created_by,
        };
        // OTFactor is optional: leave it out when blank so the server default applies.
        if (hasValue(OTFACTOR)) record.OTFACTOR = numberField("OTFactor", OTFACTOR);

        if (problems.length) errors.push(`Row ${rowNo}: ${problems.join("; ")}`);
        else components.push(record);
      });

      if (errors.length) {
        const shown = errors.slice(0, 5).join(" | ");
        throw new Error(
          `${errors.length} row(s) have problems, nothing was uploaded. ${shown}${errors.length > 5 ? " | ..." : ""}`,
        );
      }
      if (!components.length) throw new Error("No data rows found in the file.");

      console.log("payload:", components);

      const { data } = await axios.post(
        "/api/wages/uploadWageComponents",
        { components: components }, // request body
      );
      console.log("data:", data);
      if (data.notInsertedRecords?.length) {
        openRejectWindow(data.notInsertedRecords);
        onSuccess(
          `Uploaded with ${data.notInsertedRecords.length} rejection(s) – see new tab`,
        );
      } else {
        onSuccess(`All ${components.length} row(s) inserted successfully.`);
      }
      onClose();
    } catch (err) {
      console.error(err);
      onError(apiErrorMessage(err, "Upload failed."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        disabled={isBusy}
      />
      <button onClick={upload} disabled={isBusy}>
        {isBusy ? "Uploading…" : "Upload"}
      </button>
      <button onClick={onClose} disabled={isBusy}>
        Cancel
      </button>
    </div>
  );
};

UploadEmpWageComp.propTypes = {
  created_by: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};

// helpers
function excelDateToISO(val) {
  if (val === undefined || val === null || val === "") return null;

  // Accept only real calendar dates
  const checked = (iso) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso
      ? iso
      : null;
  };

  // If it's a JS Date object (Excel stores as actual date type)
  if (val instanceof Date) {
    return Number.isFinite(val.getTime()) ? val.toISOString().slice(0, 10) : null; // YYYY-MM-DD
  }

  // Excel serial number
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return null;
    const jsDate = new Date((val - 25569) * 86400 * 1000);
    return Number.isFinite(jsDate.getTime())
      ? jsDate.toISOString().slice(0, 10)
      : null;
  }

  if (typeof val === "string") {
    const t = val.trim();
    // YYYY-MM-DD text, as written by the app's own export (a time part is ignored)
    if (/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(t)) return checked(t.slice(0, 10));
    // If it's a DD-MM-YYYY string (user manually typed)
    if (/^\d{2}-\d{2}-\d{4}$/.test(t)) {
      const [d, m, y] = t.split("-");
      return checked(`${y}-${m}-${d}`); // YYYY-MM-DD
    }
  }

  return null; // unrecognized format
}

function openRejectWindow(recs) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html><head><title>Rejected Rows</title>
    <style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px}</style>
    </head><body>
    <h3>Rows NOT inserted</h3>
    <table><thead><tr>
      <th>Employee</th>
      <th>Eff Date</th>
      <th>BasicRate</th>
      <th>DARate</th>
      <th>JaggeryRate</th>
      <th>ESIApply</th>
      <th>PFApply</th>
      <th>LWFApply</th>
      <th>OTHALWRT</th>
      <th>HRART</th>
      <th>TRALWRT</th>
      <th>UNALWRT</th>
      <th>OTFACTOR</th>
      <th>Reason</th>
    </tr></thead><tbody>
    ${recs
      .map(
        (r) => `<tr>
                <td>${escapeHtml(r.EmployeeCode)}</td>
                <td>${escapeHtml(r.eff_date)}</td>
                <td>${escapeHtml(r.BasicRate)}</td>
                <td>${escapeHtml(r.DARate)}</td>
                <td>${escapeHtml(r.JaggeryRate)}</td>
                <td>${escapeHtml(r.ESIApply)}</td>
                <td>${escapeHtml(r.PFApply)}</td>
                <td>${escapeHtml(r.LWFApply)}</td>
                <td>${escapeHtml(r.OTHALWRT)}</td>
                <td>${escapeHtml(r.HRART)}</td>
                <td>${escapeHtml(r.TRALWRT)}</td>
                <td>${escapeHtml(r.UNALWRT)}</td>
                <td>${escapeHtml(r.OTFACTOR)}</td>
                <td>${escapeHtml(r.result)}</td></tr>
               `,
      )
      .join("")}
    </tbody></table>
    </body></html>
  `);
  win.document.close();
}

export default UploadEmpWageComp;
