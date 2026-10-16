import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Modal, Table } from "react-bootstrap";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select from "react-select";
import axios from "../../api/axios.js";
import { FaSearch } from "react-icons/fa";
import { jsPDF } from "jspdf";
import styles from "./WageSlip.module.css"; // Import CSS module
import grouplogo from "../../assets/grouplogo.png"; // Assuming you have a Group logo in your assets folder
import moment from "moment"; // You can use the moment library for date formatting

// Custom Option component to include checkboxes in the dropdown
const CustomOption = (props) => {
  const { innerRef, innerProps, isSelected, data } = props;
  return (
    <div
      ref={innerRef}
      {...innerProps}
      style={{ display: "flex", alignItems: "center" }}
    >
      <input type="checkbox" checked={isSelected} onChange={() => null} />
      <label style={{ marginLeft: 8 }}>{data.label}</label>
    </div>
  );
};

const WageSlip = () => {
  const [pmonth, setPmonth] = useState([]); // Process months options
  const [selectedPmonth, setSelectedPmonth] = useState(null); // Selected process month
  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Search results for employees
  const [searchTerm, setSearchTerm] = useState(""); // Stores search term input
  const [employee_code, setEmployee_code] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState({
    employee_code: "",
    display_name: "",
    pmonth: "",
    billingType: "",
  });
  const [payslipData, setPayslipData] = useState(null); // State for fetched payslip data

  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const token = user?.token;
  const emp_id = user?.emp_id;

  // Fetch available process months
  const fetchPmonthData = async () => {
    try {
      const response = await axios.post("/api/wages/getAllProcessMonth");
      const formattedPmonth = response.data.map((item) => ({
        value: item.pmonth,
        //label: item.pmonth,
        label: moment(item.pmonth).format("DD/MM/YYYY"), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth);
    } catch (error) {
      console.error("Error fetching Process Month:", error);
    }
  };

  // Fetch process months by billing cycle
  const fetchPmonthByBillingCycle = async (billingType) => {
    try {
      const response = await axios.post(
        "/api/wages/getAllProcessMonthByBillingCycle",
        {
          billingtype: billingType,
        },
      );
      const formattedPmonth = response.data.map((item) => ({
        value: item.pmonth,
        //label: item.pmonth,
        label: moment(item.pmonth).format("DD/MM/YYYY"), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth);
    } catch (error) {
      console.error("Error fetching Process Months by Billing Type:", error);
    }
  };

  // Load all data on component mount
  useEffect(() => {
    fetchPmonthData();
  }, []);

  useEffect(() => {
    if (employee_code && employee_code.length === 7) {
      fetchEmployee(employee_code);
    }
  }, [employee_code]);

  // Fetch employee data based on employee code
  const fetchEmployee = async (employee_code) => {
    try {
      const response = await axios.post("/api/employee/getEmployeeByCode", {
        employee_code: employee_code,
      });
      if (response.data && response.data.length > 0) {
        setSelectedEmployee({
          employee_code: response.data[0].Employee_Code,
          display_name: response.data[0].display_name,
          pmonth: "",
          billingType: response.data[0].BillingType,
        });
        // Fetch process months by billing cycle if billingType is available
        fetchPmonthByBillingCycle(response.data[0].BillingType);
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);
    }
  };

  // Open employee search modal
  const openEmployeeSearch = () => {
    setShowEmployeeSearch(true);
  };

  // Close employee search modal
  const closeEmployeeSearch = () => {
    setShowEmployeeSearch(false);
  };

  // Fetch employees based on the search term
  const handleSearchEmployees = async () => {
    try {
      const response = await axios.post("/api/employee/searchEmployees", {
        searchTerm: searchTerm,
      });
      setSearchResults(response.data || []);
    } catch (err) {
      console.error("Error fetching employee search results:", err);
    }
  };

  // Select employee from search results
  const handleSelectEmployee = (employee) => {
    setEmployee_code(employee.employee_code);
    setSelectedEmployee({
      employee_code: employee.employee_code,
      display_name: employee.display_name,
      pmonth: "",
      billingType: employee.BillingType,
    });
    closeEmployeeSearch();
  };

  // Handle input change for employee code
  const handleInputChange = (e) => {
    setEmployee_code(e.target.value);
  };

  // Custom single selection change handler
  const customHandleChangeSingle = (selectedOption) => {
    setSelectedPmonth(selectedOption);
    setSelectedEmployee({
      ...selectedEmployee,
      pmonth: selectedOption?.value || "",
    });
  };

  // Show wage slip button click handler
  const showWageSlip = async () => {
    if (!employee_code || !selectedPmonth) {
      alert("Please provide both Employee Code and Process Month");
      return;
    }

    try {
      const response = await axios.post("/api/wages/wageSlip", {
        employee_code: employee_code,
        pmonth: selectedPmonth.value,
        emp_id: emp_id,
        token: token,
      });

      if (response.data && response.data.length > 0) {
        setPayslipData(response.data[0]);
      }
    } catch (error) {
      console.error("Error fetching wage slip:", error);
    }
  };

  // Download wage slip as PDF with grid lines and beautification
  const downloadPDF = () => {
    if (!payslipData) return;

    const doc = new jsPDF();
    doc.setFontSize(10);

    // Header section
    doc.text("Name and address of contractor:", 10, 10, { align: "left" });
    doc.text(payslipData.ContractorName, 70, 10, { align: "left" });
    doc.setFontSize(12);
    doc.text("FORM XIX", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text("1[See rule 78 (1) (b)]", 105, 20, { align: "center" });
    doc.text("Wage Slip for the week/fortnight/month ending", 105, 25, {
      align: "center",
    });

    // First grid section
    doc.setFontSize(10);
    let yPosition = 25;
    let prv_yPosition;

    // Employee details table
    const employeeDetails = [
      [
        "Employee Code",
        payslipData.EmployeeCode,
        "Designation",
        payslipData.Designation,
      ],
      [
        "Employee Name",
        payslipData.EmployeeName,
        "Department",
        payslipData.Department,
      ],
      [
        "Business Unit",
        payslipData.BusinessUnit,
        "Employee Type",
        payslipData.EmployeeType,
      ],
    ];

    yPosition += 5;
    prv_yPosition = yPosition;
    doc.line(10, yPosition, 200, yPosition);
    employeeDetails.forEach((row) => {
      let xPosition = 10;
      const maxLength = 30;
      yPosition += 5;
      row.forEach((cell, index) => {
        if (index % 2 === 0) {
          doc.setFont("helvetica", "normal");
          doc.text(cell, xPosition + 2, yPosition);
          xPosition += 30; // Narrower width for columns 1 & 3
        } else {
          doc.setFont("helvetica", "normal");
          let truncatedValue =
            cell.length > maxLength
              ? cell.substring(0, maxLength) + "..."
              : cell;
          doc.text(truncatedValue, xPosition + 2, yPosition);
          xPosition += 70; // Wider width for columns 2 & 4
        }
      });
      yPosition += 2;
      // Draw horizontal lines for each row
      doc.line(10, yPosition, 200, yPosition);
    });

    // Draw vertical lines for the table
    doc.line(10, prv_yPosition, 10, yPosition); // Leftmost vertical line (start of column 1)
    doc.line(40, prv_yPosition, 40, yPosition); // After column 1 (xPosition for column 2 starts at 40)
    doc.line(110, prv_yPosition, 110, yPosition); // After column 2 (xPosition for column 3 starts at 110)
    doc.line(140, prv_yPosition, 140, yPosition); // After column 3 (xPosition for column 4 starts at 140)
    doc.line(200, prv_yPosition, 200, yPosition); // Rightmost vertical line (end of column 4)

    // Second grid section
    doc.setFontSize(10);

    //2nd grid  Employee Paid Days
    const employeeDays = [
      [
        "Wage Period",
        `${payslipData.startDate} To ${payslipData.endDate}`,
        "Days Worked",
        payslipData.Days !== 0 ? payslipData.Days.toString() : "",
      ],
      [
        "Shift Group",
        payslipData.ShiftGroup,
        "ArrearDays",
        payslipData.ArrearDays !== 0 ? payslipData.ArrearDays.toString() : "",
      ],
      [
        "Basic Rate",
        payslipData.BasicRate !== 0 ? payslipData.BasicRate.toString() : "",
        "OT Hours",
        payslipData.OTHrs !== 0 ? payslipData.OTHrs.toString() : "",
      ],
    ];

    yPosition += 5;
    prv_yPosition = yPosition;
    doc.line(10, yPosition, 200, yPosition);
    employeeDays.forEach((row) => {
      let xPosition = 10;
      const maxLength = 30;
      yPosition += 5;
      row.forEach((cell, index) => {
        if (index % 2 === 0) {
          doc.setFont("helvetica", "normal");
          doc.text(cell, xPosition + 2, yPosition);
          xPosition += 30; // Narrower width for columns 1 & 3
        } else {
          doc.setFont("helvetica", "normal");
          let truncatedValue =
            cell.length > maxLength
              ? cell.substring(0, maxLength) + "..."
              : cell;
          doc.text(truncatedValue, xPosition + 2, yPosition);
          xPosition += 70; // Wider width for columns 2 & 4
        }
      });
      yPosition += 2;
      // Draw horizontal lines for each row
      doc.line(10, yPosition, 200, yPosition);
    });

    // Draw vertical lines for the second grid table (employeeDays section)
    doc.line(10, prv_yPosition, 10, yPosition); // Leftmost vertical line (start of column 1)
    doc.line(40, prv_yPosition, 40, yPosition); // After column 1 (xPosition for column 2 starts at 40)
    doc.line(110, prv_yPosition, 110, yPosition); // After column 2 (xPosition for column 3 starts at 110)
    doc.line(140, prv_yPosition, 140, yPosition); // After column 3 (xPosition for column 4 starts at 140)
    doc.line(200, prv_yPosition, 200, yPosition); // Rightmost vertical line (end of column 4)

    // Third grid section

    yPosition += 10;
    doc.setFontSize(10);
    prv_yPosition = yPosition;
    doc.line(10, yPosition, 200, yPosition);
    yPosition += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Earning Heads", 10 + 2, yPosition);
    doc.text("Amount", 65 + 2, yPosition, { align: "right" });
    doc.text("Arrear Heads", 70 + 2, yPosition);
    doc.text("Amount", 115 + 2, yPosition, { align: "right" });
    doc.text("Deduction Heads", 130 + 2, yPosition);
    doc.text("Amount", 185 + 2, yPosition, { align: "right" });
    yPosition += 2;
    doc.line(10, yPosition, 200, yPosition);

    // Earnings and Deductions table
    const earningsAndDeductions = [
      [
        "Basic",
        payslipData.Basic !== 0 ? payslipData.Basic : "",
        "Extra Days",
        payslipData.EXTRADAYS !== 0 ? payslipData.EXTRADAYS : "",
        "PF",
        payslipData.EmpPF !== 0 ? payslipData.EmpPF : "",
      ],
      [
        "DA",
        payslipData.DA !== 0 ? payslipData.DA : "",
        "Wage Arrear",
        payslipData.WAGEARREAR !== 0 ? payslipData.WAGEARREAR : "",
        "ESI",
        payslipData.EmpESI !== 0 ? payslipData.EmpESI : "",
      ],
      [
        "Jaggery",
        payslipData.Jaggery !== 0 ? payslipData.Jaggery : "",
        "Jaggery Arrear",
        payslipData.JAGARREAR !== 0 ? payslipData.JAGARREAR : "",
        "Electricity",
        payslipData.ELEC !== 0 ? payslipData.ELEC : "",
      ],
      [
        "OT",
        payslipData.OTAmt !== 0 ? payslipData.OTAmt : "",
        "PF Refund",
        payslipData.PFREFUND !== 0 ? payslipData.PFREFUND : "",
        "Other Deductions",
        payslipData.OTHERDED !== 0 ? payslipData.OTHERDED : "",
      ],
      [
        "",
        "",
        "Electricity Refund",
        payslipData.ELECREFUND !== 0 ? payslipData.ELECREFUND : "",
        "",
        "",
      ],
      [
        "Gross",
        payslipData.Gross !== 0 ? payslipData.Gross : "",
        "ESI Refund",
        payslipData.ESIREFUND !== 0 ? payslipData.ESIREFUND : "",
        "Total Deductions",
        payslipData.TotalDed !== 0 ? payslipData.TotalDed : "",
      ],
      [
        "Net Amount",
        payslipData.NetAmt !== 0 ? payslipData.NetAmt : "",
        "",
        "",
        "",
        "",
      ],
    ];

    earningsAndDeductions.forEach((row) => {
      yPosition += 5;
      let xPosition = 10;
      row.forEach((cell, index) => {
        if (index === 0) {
          xPosition = 10;
        }
        if (index === 1) {
          xPosition = 40;
        }
        if (index === 2) {
          xPosition = 70;
        }
        if (index === 3) {
          xPosition = 100;
        }
        if (index === 4) {
          xPosition = 130;
        }
        if (index === 5) {
          xPosition = 170;
        }

        doc.text(`${cell}`, xPosition + 2, yPosition);
      });
      // Draw horizontal lines for each row
      yPosition += 2;
      doc.line(10, yPosition, 200, yPosition);
    });

    // Draw vertical lines for the earnings and deductions table
    doc.line(10, prv_yPosition, 10, yPosition);
    doc.line(40, prv_yPosition, 40, yPosition);
    doc.line(70, prv_yPosition, 70, yPosition);
    doc.line(100, prv_yPosition, 100, yPosition);
    doc.line(130, prv_yPosition, 130, yPosition);
    doc.line(170, prv_yPosition, 170, yPosition);
    doc.line(200, prv_yPosition, 200, yPosition);

    // Footer section
    yPosition += 5;
    doc.text(convertNumberToWords(payslipData.NetAmt), 10, yPosition, {
      align: "left",
    });
    yPosition += 20;
    doc.setFont("helvetica", "normal");
    doc.text(
      "Initials of the Contractor or his representative.",
      10,
      yPosition,
      { align: "left" },
    );

    doc.save(`WageSlip_${employee_code}.pdf`);
  };

  const convertNumberToWords = (num) => {
    const a = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    if ((num = num.toString()).length > 9) return "Overflow";

    const n = ("000000000" + num)
      .substr(-9)
      .match(/^(\d{2})(\d{2})(\d{2})(\d{3})$/);
    if (!n) return;

    let str = "";
    str +=
      n[1] !== "00"
        ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + " Crore "
        : "";
    str +=
      n[2] !== "00"
        ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + " Lakh "
        : "";
    str +=
      n[3] !== "00"
        ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + " Thousand "
        : "";
    str += n[4][0] !== "0" ? a[Number(n[4][0])] + " Hundred " : "";
    str +=
      n[4].substr(1) !== "00"
        ? a[Number(n[4].substr(1))] || b[n[4][1]] + " " + a[n[4][2]]
        : "";

    return `Rupees ${str.trim()} Only`;
  };

  if (!token) {
    return (
      <div>
        <p>You must be logged in to print daily attendance.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  return (
    <div>
      {/* Inputs in a single row grid structure */}
      <div className={`${styles.container} ${styles.inputRowGrid}`}>
        <div className={styles.inputColumn}>
          <label className={styles.inputLabel}>Employee Code:</label>
          <div className={styles.inputWrapper}>
            <Form.Control
              type="text"
              name="employee_code"
              value={employee_code}
              onChange={handleInputChange}
              placeholder="Enter Employee Code"
              className={styles.employeeCodeInput}
            />
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={openEmployeeSearch}
              className={styles.iconButton}
            >
              <FaSearch />
            </Button>
          </div>
        </div>
        <div className={styles.inputColumn}>
          <label className={styles.inputLabel}>Process Month:</label>
          <Select
            options={pmonth}
            value={selectedPmonth}
            onChange={customHandleChangeSingle}
            components={{ Option: CustomOption }}
            placeholder="Select Process Month"
            className={styles.selectContainer}
            required
          />
        </div>
        <div className={styles.inputColumn}>
          <Button
            type="button"
            className={styles.showWageSlipButton}
            onClick={showWageSlip}
          >
            Show Wage Slip
          </Button>
        </div>
        <div className={styles.inputColumn}>
          <Button
            type="button"
            className={styles.downloadPDFButton}
            onClick={downloadPDF}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Wage Slip Display */}
      {payslipData && (
        <div className={styles.payslipContainer}>
          <div className={styles.payslipHeader}>
            <h2>Contractor Name: {payslipData.ContractorName} </h2>
            <h3>Wage Slip</h3>
          </div>
          <Table bordered>
            <tbody>
              <tr>
                <td>Employee Code</td>
                <td>{payslipData.EmployeeCode}</td>
                <td>Employee Type</td>
                <td>{payslipData.EmployeeType}</td>
                <td>Wage Period</td>
                <td>
                  {payslipData.startDate} To {payslipData.endDate}
                </td>
              </tr>
              <tr>
                <td>Employee Name</td>
                <td>{payslipData.EmployeeName}</td>
                <td>Designation</td>
                <td>{payslipData.Designation}</td>
                <td>Shift Group</td>
                <td>{payslipData.ShiftGroup}</td>
              </tr>
              <tr>
                <td>Business Unit</td>
                <td>{payslipData.BusinessUnit}</td>
                <td>Department</td>
                <td>{payslipData.Department}</td>
                <td>Days Worked</td>
                <td>{payslipData.Days !== 0 ? payslipData.Days : ""}</td>
              </tr>
              <tr>
                <td>Basic Rate</td>
                <td>{payslipData.BasicRate}</td>
                <td></td>
                <td></td>
                <td>Arrear Days</td>
                <td>
                  {payslipData.ArrearDays !== 0 ? payslipData.ArrearDays : ""}
                </td>
              </tr>
              <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>Overtime Hours</td>
                <td>{payslipData.OTHrs !== 0 ? payslipData.OTHrs : ""}</td>
              </tr>
              <tr></tr>
              <tr></tr>
              <tr></tr>
              <tr style={{ backgroundColor: "#1e90ff", color: "#ffffff" }}>
                <th
                  style={{
                    padding: "10px",
                    backgroundColor: "#1e90ff",
                    color: "#ffffff",
                  }}
                >
                  Earning Heads
                </th>
                <th
                  style={{
                    padding: "10px",
                    backgroundColor: "#1e90ff",
                    color: "#ffffff",
                  }}
                >
                  Earned Amount
                </th>
                <th
                  style={{
                    padding: "10px",
                    backgroundColor: "#1e90ff",
                    color: "#ffffff",
                  }}
                >
                  Arrear/Refunds Heads
                </th>
                <th
                  style={{
                    padding: "10px",
                    backgroundColor: "#1e90ff",
                    color: "#ffffff",
                  }}
                >
                  Arrear Amount
                </th>
                <th
                  style={{
                    padding: "10px",
                    backgroundColor: "#1e90ff",
                    color: "#ffffff",
                  }}
                >
                  Deduction Heads
                </th>
                <th
                  style={{
                    padding: "10px",
                    backgroundColor: "#1e90ff",
                    color: "#ffffff",
                  }}
                >
                  Deduction Amount
                </th>
              </tr>
              <tr>
                <td>Basic</td>
                <td>{payslipData.Basic !== 0 ? payslipData.Basic : ""}</td>
                <td>Extra Days</td>
                <td>
                  {payslipData.EXTRADAYS !== 0 ? payslipData.EXTRADAYS : ""}
                </td>
                <td>Provident Fund</td>
                <td>{payslipData.EmpPF !== 0 ? payslipData.EmpPF : ""}</td>
              </tr>
              <tr>
                <td>DA</td>
                <td>{payslipData.DA !== 0 ? payslipData.DA : ""}</td>
                <td>Wage Arrear</td>
                <td>
                  {payslipData.WAGEARREAR !== 0 ? payslipData.WAGEARREAR : ""}
                </td>
                <td>ESI</td>
                <td>{payslipData.EmpESI !== 0 ? payslipData.EmpESI : ""}</td>
              </tr>
              <tr>
                <td>Jaggery Allw</td>
                <td>{payslipData.Jaggery !== 0 ? payslipData.Jaggery : ""}</td>
                <td>Jaggery Arrear</td>
                <td>
                  {payslipData.JAGARREAR !== 0 ? payslipData.JAGARREAR : ""}
                </td>
                <td>Electricity</td>
                <td>{payslipData.ELEC !== 0 ? payslipData.ELEC : ""}</td>
              </tr>
              <tr>
                <td>OT Amount</td>
                <td>{payslipData.OTAmt !== 0 ? payslipData.OTAmt : ""}</td>
                <td>PF Refund</td>
                <td>
                  {payslipData.PFREFUND !== 0 ? payslipData.PFREFUND : ""}
                </td>
                <td>Other Deductions</td>
                <td>
                  {payslipData.OTHERDED !== 0 ? payslipData.OTHERDED : ""}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold" }}>Gross Amount</td>
                <td style={{ fontWeight: "bold" }}>
                  {payslipData.Gross !== 0 ? payslipData.Gross : ""}
                </td>
                <td>Electricity Refund</td>
                <td>
                  {payslipData.ELECREFUND !== 0 ? payslipData.ELECREFUND : ""}
                </td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td></td>
                <td></td>
                <td>ESI Refund</td>
                <td>
                  {payslipData.ESIREFUND !== 0 ? payslipData.ESIREFUND : ""}
                </td>
                <td style={{ fontWeight: "bold" }}>Total Deductions</td>
                <td style={{ fontWeight: "bold" }}>
                  {payslipData.TotalDed !== 0 ? payslipData.TotalDed : ""}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "10px",
                    backgroundColor: "#d3d3d3",
                    color: "#000000",
                    fontWeight: "bold",
                  }}
                >
                  Net Amount
                </td>
                <td
                  style={{
                    padding: "10px",
                    backgroundColor: "#d3d3d3",
                    color: "#000000",
                    fontWeight: "bold",
                  }}
                >
                  {payslipData.NetAmt !== 0 ? payslipData.NetAmt : ""}
                </td>
                <td
                  colSpan="4"
                  style={{
                    padding: "10px",
                    backgroundColor: "#d3d3d3",
                    color: "#000000",
                    fontWeight: "bold",
                  }}
                >
                  {convertNumberToWords(payslipData.NetAmt)}
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
      )}

      {/* Employee Search Modal */}
      <Modal show={showEmployeeSearch} onHide={closeEmployeeSearch}>
        <Modal.Header closeButton>
          <Modal.Title>Search Employee</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            type="text"
            placeholder="Enter employee name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles["small-input"]}
          />
          <Button
            size="sm"
            onClick={handleSearchEmployees}
            className={styles["small-button"]}
          >
            Search
          </Button>
          {searchResults.length > 0 && (
            <ul>
              {searchResults.map((employee) => (
                <li
                  key={employee.employee_code}
                  onClick={() => handleSelectEmployee(employee)}
                >
                  {employee.display_name} ({employee.employee_code})
                </li>
              ))}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={closeEmployeeSearch}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WageSlip;
