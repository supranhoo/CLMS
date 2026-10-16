// ApproveEmployeeChanges.js
import React, { useState, useEffect } from "react";
import axios from "../../api/axios.js";
import { Table, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectUser } from "../../features/userSlice";

const ApproveEmployeeChanges = () => {
  const [grouped, setGrouped] = useState({});
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(5);

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.post("/api/employee/getUnapprovedEmpRec");
      const data = res.data;
      const groupedData = {};
      for (const rec of data) {
        const code = rec.Employee_Code;
        if (!groupedData[code]) groupedData[code] = {};
        groupedData[code][rec.source] = rec;
      }
      setGrouped(groupedData);
    } catch (err) {
      console.error(err);
      setMessage("Error fetching records");
    }
  };

  const handleApprove = async (record_id) => {
    try {
      await axios.post("/api/employee/approveOrRejectEmpRec", {
        record_id,
        action: "approve",
        approver_id: emp_id,
      });
      setMessage("Approved successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage("Approval failed");
    }
  };

  const handleReject = async (record_id) => {
    try {
      await axios.post("/api/employee/approveOrRejectEmpRec", {
        record_id,
        action: "reject",
        approver_id: emp_id,
      });
      setMessage("Rejected successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage("Rejection failed");
    }
  };

  const getDiffClass = (field, orig, mod) => {
    if (orig?.[field] !== mod?.[field]) return "table-warning";
    return "table-light text-muted";
  };

  if (!token) {
    return (
      <div>
        <p>You must be logged in to register a employee.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  const allFields = [
    "Employee_Code",
    "First_Name",
    "Middle_Name",
    "Last_Name",
    "Nick_Name",
    "Father_Husband_Name",
    "Salutation",
    "Gender",
    "Dateof_Birth",
    "Dateof_Birth_Actual",
    "Placeof_Birth",
    "Nationality",
    "Religion",
    "Caste",
    "Language",
    "Blood_Group",
    "Marital_Status",
    "Wedding_Anniversary",
    "Handicap",
    "handicap_details",
    "Smoker",
    "Is_Active",
    "Adhar_No",
    "Adhar_Name",
    "panno",
    "Hobbies",
    "Created_By",
    "Created_Date",
    "Modified_By",
    "Modified_Date",
    "EmpTag",
    "BillingType",
    "dept",
    "bu",
    "division",
    "contractor_id",
    "pfno",
    "uanno",
    "esino",
    "skill_category",
    "contact_no",
    "doj",
    "doj_group",
    "display_name",
    "design_code",
    "bank_code",
    "bank_account_no",
    "ifsc_code",
    "local_address",
    "local_city",
    "local_state",
    "local_pin",
    "pmt_address",
    "pmt_city",
    "pmt_state",
    "pmt_pin",
    "entity_code",
    "payment_mode",
    "emp_type",
    "section",
    "medical_status",
    "inactive_date",
    "wage_type",
    "ot_factor",
    "blacklisted",
    "blacklisted_reason",
    "emp_category_code",
    "loc_code",
    "cost_code",
    "level",
  ];

  const entries = Object.entries(grouped);
  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;
  const currentRecords = entries.slice(indexOfFirst, indexOfLast);

  return (
    <div>
      <h4>Approve Modified Employee Records</h4>
      {message && <Alert variant="info">{message}</Alert>}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "600px" }}>
        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              <th>Action</th>
              <th>Source</th>
              {allFields.map((field) => (
                <th key={field}>{field}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRecords.map(([Employee_Code, pair]) => (
              <React.Fragment key={Employee_Code}>
                <tr>
                  <td rowSpan={2}>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleApprove(pair?.Modified?.record_id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="mt-1"
                      onClick={() => handleReject(pair?.Modified?.record_id)}
                    >
                      Reject
                    </Button>
                  </td>
                  <td>Original</td>
                  {allFields.map((field) => (
                    <td
                      key={"orig-" + field}
                      className={getDiffClass(
                        field,
                        pair.Original,
                        pair.Modified,
                      )}
                    >
                      {String(pair.Original?.[field] ?? "")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Modified</td>
                  {allFields.map((field) => (
                    <td
                      key={"mod-" + field}
                      className={getDiffClass(
                        field,
                        pair.Original,
                        pair.Modified,
                      )}
                    >
                      {String(pair.Modified?.[field] ?? "")}
                    </td>
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="d-flex justify-content-between align-items-center">
        <Button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => prev - 1)}
        >
          Prev
        </Button>
        <span>
          Page {currentPage} of {Math.ceil(entries.length / recordsPerPage)}
        </span>
        <Button
          disabled={indexOfLast >= entries.length}
          onClick={() => setCurrentPage((prev) => prev + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default ApproveEmployeeChanges;
