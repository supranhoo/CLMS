// src/components/UploadWageComponents.js
import React, { useState } from "react";
import * as XLSX from "xlsx";
import axios from "../api/axios.js";
import PropTypes from "prop-types";

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
      const components = rows.flatMap((r) => {
        const EmployeeCode = r["EmployeeCode"]?.toString().trim();
        const eff_date = excelDateToISO(r["eff_date"]);
        const billingType = r["BillingCycle"]?.toString().trim();
        const BasicRate = r["BasicRate"]?.toString().trim();
        const DARate = r["DARate"]?.toString().trim();
        const JaggeryRate = r["JaggeryRate"]?.toString().trim();
        const GrossRate = r["GrossRate"]?.toString().trim();
        const ESIApply = r["ESIApply"]?.toString().trim();
        const PFApply = r["PFApply"]?.toString().trim();
        const LWFApply = r["LWFApply"]?.toString().trim();
        const OTHALWRT = r["OTHALWRT"]?.toString().trim();
        const HRART = r["HRART"]?.toString().trim();
        const TRALWRT = r["TRALWRT"]?.toString().trim();
        const UNALWRT = r["UNALWRT"]?.toString().trim();
        // Keep compatibility with both the exported header and the legacy header.
        const MEDIALWRT = (r["MEDIALWRT"] ?? r["MEDALWRT"])
          ?.toString()
          .trim();
        const CONALWRT = r["CONALWRT"]?.toString().trim();
        const HRAOLDRT = (r["HRAOLDRT"] ?? r["OLDHRART"])
          ?.toString()
          .trim();
        const OTFACTOR = r["OTFactor"]?.toString().trim();

        if (
          !EmployeeCode ||
          !eff_date ||
          !billingType ||
          !BasicRate ||
          !DARate ||
          !JaggeryRate ||
          !GrossRate ||
          !ESIApply ||
          !PFApply ||
          !LWFApply ||
          !OTHALWRT ||
          !HRART ||
          !TRALWRT ||
          !UNALWRT ||
          !MEDIALWRT ||
          !CONALWRT ||
          !HRAOLDRT ||
          OTFACTOR === ""
        ) {
          console.log(
            "Stage-1",
            EmployeeCode,
            eff_date,
            BasicRate,
            DARate,
            JaggeryRate,
            GrossRate,
            ESIApply,
            PFApply,
            LWFApply,
            OTHALWRT,
            HRART,
            TRALWRT,
            UNALWRT,
            MEDIALWRT,
            CONALWRT,
            HRAOLDRT,
            OTFACTOR,
          );
          throw new Error("Data Issue");
          return [];
        } // skip incomplete rows  //

        return {
          EmployeeCode: EmployeeCode,
          eff_date: eff_date,
          billingType: billingType,
          BasicRate: Number(r["BasicRate"] || 0),
          DARate: Number(r["DARate"] || 0),
          JaggeryRate: Number(r["JaggeryRate"] || 0),
          ESIApply: (r["ESIApply"] || "").toString().trim() || null,
          PFApply: (r["PFApply"] || "").toString().trim() || null,
          LWFApply: (r["LWFApply"] || "").toString().trim() || null,
          OTHALWRT: Number(r["OTHALWRT"] || 0),
          HRART: Number(r["HRART"] || 0),
          TRALWRT: Number(r["TRALWRT"] || 0),
          UNALWRT: Number(r["UNALWRT"] || 0),
          MEDIALWRT: Number(MEDIALWRT || 0),
          CONALWRT: Number(r["CONALWRT"] || 0),
          HRAOLDRT: Number(HRAOLDRT || 0),
          OTFACTOR: Number(OTFACTOR || 0),
          created_by: created_by,
        };
      });

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
      onError(err.message || "Upload failed – check console.");
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
  if (!val) return null;

  // If it's a JS Date object (Excel stores as actual date type)
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  // Excel serial number
  if (typeof val === "number") {
    const jsDate = new Date((val - 25569) * 86400 * 1000);
    return jsDate.toISOString().slice(0, 10);
  }

  // If it's a DD-MM-YYYY string (user manually typed)
  if (typeof val === "string" && /^\d{2}-\d{2}-\d{4}$/.test(val)) {
    const [d, m, y] = val.split("-");
    return `${y}-${m}-${d}`; // YYYY-MM-DD
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
                <td>${r.EmployeeCode}</td>
                <td>${r.eff_date}</td>
                <td>${r.BasicRate}</td>
                <td>${r.DARate}</td>
                <td>${r.JaggeryRate}</td>
                <td>${r.ESIApply}</td>
                <td>${r.PFApply}</td>
                <td>${r.LWFApply}</td>
                <td>${r.OTHALWRT}</td>
                <td>${r.HRART}</td>
                <td>${r.TRALWRT}</td>
                <td>${r.UNALWRT}</td>
                <td>${r.OTFACTOR}</td>
                <td>${r.result}</td></tr>
               `,
      )
      .join("")}
    </tbody></table>
    </body></html>
  `);
  win.document.close();
}

export default UploadEmpWageComp;
