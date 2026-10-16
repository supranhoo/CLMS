import React, { useState, useEffect, useRef } from "react";
import MainScreen from "../../components/MainScreen";
import { Table, Button, Row, Col, Form, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllContractors,
  registerContractor,
  selectUser,
} from "../../features/userSlice";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import "./Contractor.css";
import axios from "../../api/axios.js";
import "./Paginated1.css";
import "./Paginated2.css";
import { downloadWorkbook } from "../../utils/exportWorkbook.js";
import { apiErrorMessage } from "../../utils/apiError";

const isYes = (value) => value === "Y" || value === true;

const blankContractorForm = () => ({
  Contractor_ID: "",
  Contractor_Name: "",
  Billing_Name: "",
  PAN_No: "",
  TAN_No: "",
  GIR_No: "",
  REG_No: "",
  Father_Name: "",
  Address1: "",
  Address2: "",
  PF_No: "",
  ESIC_No: "",
  Is_Administrative_Applicable: false,
  Administrative_Charge_Percent: "",
  Is_FoodAccoChargs_Applicable: false,
  Food_Acco_Charges: "",
  HeadIDs: "",
  EmailID: "",
  ContractorCode: "",
  GSTNo: "",
  GSTPercent: "",
  GSTPercent1: "",
  Created_By: "",
  Created_Date: "",
  Modified_By: "",
  Modified_Date: "",
  labour_license_number: "",
  labour_license_valid_from: "",
  labour_license_valid_to: "",
  contact_number: "",
});

const ManageContractors = () => {
  const [contractors, setContractors] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [filteredContractors, setFilteredContractors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [errors, setErrors] = useState({}); // State for errors
  const [formData, setFormData] = useState(blankContractorForm);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOffset = new Date().getTimezoneOffset();
  const timezoneOffsetInHours = timezoneOffset / 60;

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const contractorIdRef = useRef(null); // Ref for Contractor_ID input field

  useEffect(() => {
    fetchContractors();
  }, []);

  useEffect(() => {
    const filtered = contractors.filter((contractor) =>
      contractor.Contractor_Name.toLowerCase().includes(
        searchTerm.toLowerCase()
      )
    );
    setFilteredContractors(filtered);
  }, [searchTerm, contractors]);

  const fetchContractors = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/contractor/getAllContractors"); // Adjust URL as per your backend API
      console.log("API response:", response.data); // Log the response data
      const contractorsData = Array.isArray(response.data)
        ? response.data
        : [response.data];
      /*--raj
      // Convert date fields for each contractor
      const updatedContractorsData = contractorsData.map((contractor) => ({
        ...contractor,
        Created_Date: convertUTCToLocalTime(contractor.Created_Date),
        Modified_Date: convertUTCToLocalTime(contractor.Modified_Date),
      }));

      setContractors(updatedContractorsData);
      --*/
      setContractors(contractorsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching contractors:", error);
      setLoading(false);
      setMessage(apiErrorMessage(error));
    }
  };

  const handleAddNewRecord = () => {
    setSelectedContractor(null); // Reset form
    clearForm();
    contractorIdRef.current.focus(); // Set focus on Contractor_ID input field
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when items per page change
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    return formattedDate + "Z";
  };
  const formatDateTimeForInput = (dateTime) => {
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  const convertLocalTimeToUTC = (localDateTime) => {
    const localDate = new Date(localDateTime);
    return localDate.toISOString();
  };
  // Function to convert UTC datetime to local time
  const convertUTCToLocalTime = (utcDateTime) => {
    const localDate = new Date(utcDateTime);
    return localDate.toLocaleString();
  };
  const clearForm = () => {
    setFormData(blankContractorForm());
  };

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error1, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  // Validation function
  const validateForm = () => {
    const newErrors = {};

    if (!formData.Contractor_ID) {
      newErrors.Contractor_ID = "Contractor ID is required.";
    }
    if (!formData.Contractor_Name) {
      newErrors.Contractor_Name = "Contractor Name is required.";
    } else if (formData.Contractor_Name.length > 50) {
      newErrors.Contractor_Name =
        "Contractor Name cannot exceed 50 characters.";
    }

    if (!formData.Billing_Name) {
      newErrors.Billing_Name = "Billing Name is required.";
    }

    if (!formData.PAN_No) {
      newErrors.PAN_No = "PAN No is required.";
    } else if (formData.PAN_No.length !== 10) {
      newErrors.PAN_No = "PAN No must be 10 characters.";
    }

    if (!formData.GSTNo) {
      newErrors.GSTNo = "GST No is required.";
    }

    // Add more validation rules as needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setMessage("Please fix the validation errors before submitting.");
      return;
    }

    setError(false);
    setLoading(true);

    try {
      const updatedFormData = {
        ...formData,
        GSTPercent: formData.GSTPercent
          ? parseFloat(formData.GSTPercent).toFixed(2)
          : "0.00",
        GSTPercent1: formData.GSTPercent1
          ? parseFloat(formData.GSTPercent1).toFixed(2)
          : "0.00",
        Administrative_Charge_Percent: formData.Administrative_Charge_Percent
          ? parseFloat(formData.Administrative_Charge_Percent).toFixed(2)
          : "0.00",
        Food_Acco_Charges: formData.Food_Acco_Charges
          ? parseFloat(formData.Food_Acco_Charges).toFixed(2)
          : "0.00",
        Is_Administrative_Applicable: isYes(formData.Is_Administrative_Applicable)
          ? "Y"
          : "N",
        Is_FoodAccoChargs_Applicable: isYes(formData.Is_FoodAccoChargs_Applicable)
          ? "Y"
          : "N",
      };

      let result;
      if (selectedContractor) {
        const localDate = new Date(); // Assuming this is the local date you want to store
        console.log("Local Time:", localDate);
        console.log("Current Date Tome:", formatDateTimeForInput(new Date()));
        const utcDate = convertLocalTimeToUTC(localDate);
        console.log("UTC Time:", utcDate);

        const tmp_date = formatDateTimeForInput(new Date());
        const utcDateFromBackend = "2024-06-18T12:31:34.945Z";
        const localDateForDisplay = convertUTCToLocalTime(utcDateFromBackend);
        console.log("Local Time:", localDateForDisplay); // Display the local date

        // The server stamps the audit columns itself; do not send them back.
        const {
          Created_By,
          Created_Date,
          Modified_By,
          Modified_Date,
          ...updatedFormData1
        } = updatedFormData;
        // Edit existing contractor
        result = await axios.put(
          `/api/contractor/updateContractor/${selectedContractor.Contractor_ID}`,
          updatedFormData1
        );
      } else {
        // Add new contractor
        const updatedFormData1 = {
          ...updatedFormData,
          Created_By: emp_id,
          Created_Date: formatDateTimeForInput(new Date()),
          Modified_By: null,
          Modified_Date: null,
        };
        result = await dispatch(registerContractor(updatedFormData1)).unwrap();
      }

      setErrors({});
      setMessage("");
      setError(false);
      setShowSuccessModal(true);
      fetchContractors(); // Refresh the contractor data
      setSelectedContractor(null); // Reset form
      clearForm();
      setLoading(false);
    } catch (error) {
      setShowErrorModal(true);
      console.error("Submit Error:", error);
      setError(true);
      setMessage(apiErrorMessage(error));
      setLoading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message
    navigate("/manageContractors"); // Navigate to the home route after closing the modal
  };

  const handleContractorClick = (contractor) => {
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message

    setFormData({
      Contractor_ID: contractor.Contractor_ID,
      Contractor_Name: contractor.Contractor_Name,
      Billing_Name: contractor.Billing_Name,
      PAN_No: contractor.PAN_No,
      TAN_No: contractor.TAN_No,
      GIR_No: contractor.GIR_No,
      REG_No: contractor.REG_No,
      Father_Name: contractor.Father_Name,
      Address1: contractor.Address1,
      Address2: contractor.Address2,
      PF_No: contractor.PF_No,
      ESIC_No: contractor.ESIC_No,
      Created_By: contractor.Created_By,
      Modified_By: contractor.Modified_By,
      Created_Date: formatDateTimeForInput(contractor.Created_Date),
      Modified_Date: formatDateTimeForInput(contractor.Modified_Date),
      Is_Administrative_Applicable: isYes(contractor.Is_Administrative_Applicable),
      Administrative_Charge_Percent:
        contractor.Administrative_Charge_Percent || "",
      Is_FoodAccoChargs_Applicable: isYes(contractor.Is_FoodAccoChargs_Applicable),
      Food_Acco_Charges: contractor.Food_Acco_Charges || "",
      HeadIDs: contractor.HeadIDs || "",
      EmailID: contractor.EmailID || "",
      ContractorCode: contractor.ContractorCode || "",
      GSTNo: contractor.GSTNo || "",
      GSTPercent: contractor.GSTPercent || "",
      GSTPercent1: contractor.GSTPercent1 || "",
      labour_license_number: contractor.labour_license_number || "",
      labour_license_valid_from: contractor.labour_license_valid_from || "",
      labour_license_valid_to: contractor.labour_license_valid_to || "",
      contact_number: contractor.contact_number || "",
    });
    setSelectedContractor(contractor);
  };

  if (!token) {
    return (
      <div>
        <p>You must be logged in to register a contractor.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredContractors.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredContractors.length / itemsPerPage);

  const TimezoneInfo = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = new Date().getTimezoneOffset();
    const timezoneOffsetInHours = timezoneOffset / 60;
  };

  return (
    <MainScreen scope="legacy-paginated" title="Manage Contractors">
      <div className="contractor-list">
        <div className="Paginated1">
          <Table responsive striped bordered hover>
            <thead style={{ height: "50%", verticalAlign: "midle" }}>
              <tr>
              <td
                style={{ height: "50$", width: "5%", verticalAlign: "midle" }}
              >
                No.Records:
              </td>
              <td width={"5%"}>
                <div>
                  <Form.Control
                    as="select"
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </Form.Control>
                </div>
              </td>

              <td>
                <div
                  className="pagination-buttons"
                  style={{ width: "68%", color: "lightskyblue" }}
                >
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    {"<<"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    {"<"}
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    {">"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    {">>"}
                  </Button>
                </div>
              </td>
              <td width={"5%"}></td>
              <td>
                <Form.Control
                  type="text"
                  placeholder="Search by name"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </td>
              <td className="button-cell">
                <Button variant="primary" onClick={() => handleAddNewRecord()}>
                  Add
                </Button>
                <Button variant="secondary" onClick={() => navigate('/development/import/contractors')}>Upload</Button>
                <Button variant="secondary" disabled={!filteredContractors.length} onClick={() => downloadWorkbook({ title: 'Local contractor master', rows: filteredContractors, columns: [{key:'Contractor_ID',label:'Contractor_ID'},{key:'Contractor_Name',label:'Contractor_Name'},{key:'Billing_Name',label:'Billing_Name'},{key:'Address1',label:'Address1'}], metadata: { Search: searchTerm || 'None', Scope: 'Current filtered contractors' } }, 'CLMS-contractors')}>Export</Button>
              </td>
              </tr>
            </thead>
          </Table>
        </div>
        <div className="Paginated2">
          <Table responsive striped bordered hover>
            <thead>
              <tr>
                <th>Contractor ID</th>
                <th>Contractor Name</th>
                <th>Billing_Name</th>
                <th>PAN_No</th>
                <th>TAN_No</th>
                <th>GIR_No</th>
                <th>REG_No</th>
                <th>Father_Name</th>
                <th>Address1</th>
                <th>Address2</th>
                <th>PF_No</th>
                <th>ESIC_No</th>
                <th>Created_By</th>
                <th>Created_Date</th>
                <th>Modified_By</th>
                <th>Modified_Date</th>
                <th>Is_Administrative_Applicable</th>
                <th>Administrative_Charge_Percent</th>
                <th>Is_FoodAccoChargs_Applicable</th>
                <th>Food_Acco_Charges</th>
                <th>HeadIDs</th>
                <th>EmailID</th>
                <th>ContractorCode</th>
                <th>GSTNo</th>
                <th>GSTPercent</th>
                <th>GSTPercent1</th>

                <th>ContactNo</th>
                <th>Lab Lic No</th>
                <th>Lic Valid From</th>
                <th>Lic Valid To</th>

                {/* Add more headers as needed */}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((contractor) => (
                <tr key={contractor.Contractor_ID}>
                  <td>
                    <a
                      href="#"
                      onClick={() => handleContractorClick(contractor)}
                    >
                      {contractor.Contractor_ID}
                    </a>
                  </td>
                  <td>{contractor.Contractor_Name}</td>
                  <td>{contractor.Billing_Name}</td>
                  <td>{contractor.PAN_No}</td>
                  <td>{contractor.TAN_No}</td>
                  <td>{contractor.GIR_No}</td>
                  <td>{contractor.REG_No}</td>
                  <td>{contractor.Father_Name}</td>
                  <td>{contractor.Address1}</td>
                  <td>{contractor.Address2}</td>
                  <td>{contractor.PF_No}</td>
                  <td>{contractor.ESIC_No}</td>
                  <td>{contractor.Created_By}</td>
                  <td>
                    {contractor.Created_Date
                      ? convertUTCToLocalTime(contractor.Created_Date)
                      : ""}
                  </td>
                  <td>{contractor.Modified_By}</td>
                  <td>
                    {contractor.Modified_Date
                      ? convertUTCToLocalTime(contractor.Modified_Date)
                      : ""}
                  </td>
                  <td>{contractor.Is_Administrative_Applicable}</td>
                  <td>{contractor.Administrative_Charge_Percent}</td>
                  <td>{contractor.Is_FoodAccoChargs_Applicable}</td>
                  <td>{contractor.Food_Acco_Charges}</td>
                  <td>{contractor.HeadIDs}</td>
                  <td>{contractor.EmailID}</td>
                  <td>{contractor.ContractorCode}</td>
                  <td>{contractor.GSTNo}</td>
                  <td>{contractor.GSTPercent}</td>
                  <td>{contractor.GSTPercent1}</td>

                  <td>{contractor.contact_number}</td>
                  <td>{contractor.labour_license_number}</td>
                  <td>{contractor.labour_license_valid_from}</td>
                  <td>{contractor.labour_license_valid_to}</td>

                  {/* Add more columns as needed */}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="loginContainer">
        {error1 && (
          <ErrorMessage variant="danger">
            Unable to Register, Please check data
          </ErrorMessage>
        )}
        {message && <ErrorMessage variant="danger">{message}</ErrorMessage>}
        {loading && <Loading />}
        <Form onSubmit={submitHandler}>
          <Form.Group controlId="contractor_ID" className="formGroup">
            <Form.Label>Contractor ID</Form.Label>
            <Form.Control
              type="text"
              name="Contractor_ID"
              value={formData.Contractor_ID ?? ""}
              placeholder="Enter Contractor ID"
              onChange={handleChange}
              ref={contractorIdRef}
            />
            {errors.Contractor_ID && (
              <div className="error-message">{errors.Contractor_ID}</div>
            )}
          </Form.Group>
          <Form.Group controlId="contractorName" className="formGroup">
            <Form.Label>Contractor Name</Form.Label>
            <Form.Control
              type="text"
              name="Contractor_Name"
              value={formData.Contractor_Name ?? ""}
              placeholder="Enter Contractor Name"
              onChange={handleChange}
            />
            {errors.Contractor_Name && (
              <div className="error-message">{errors.Contractor_Name}</div>
            )}
          </Form.Group>
          <Form.Group controlId="billingName" className="formGroup">
            <Form.Label>Billing Name</Form.Label>
            <Form.Control
              type="text"
              name="Billing_Name"
              value={formData.Billing_Name ?? ""}
              placeholder="Enter Billing Name"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="panNo" className="formGroup">
            <Form.Label>PAN No</Form.Label>
            <Form.Control
              type="text"
              name="PAN_No"
              value={formData.PAN_No ?? ""}
              placeholder="Enter PAN No"
              onChange={handleChange}
            />
            {errors.PAN_No && (
              <div className="error-message">{errors.PAN_No}</div>
            )}
          </Form.Group>
          <Form.Group controlId="tanNo" className="formGroup">
            <Form.Label>TAN No</Form.Label>
            <Form.Control
              type="text"
              name="TAN_No"
              value={formData.TAN_No ?? ""}
              placeholder="Enter TAN No"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="girNo" className="formGroup">
            <Form.Label>GIR No</Form.Label>
            <Form.Control
              type="text"
              name="GIR_No"
              value={formData.GIR_No ?? ""}
              placeholder="Enter GIR No"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="regNo" className="formGroup">
            <Form.Label>REG No</Form.Label>
            <Form.Control
              type="text"
              name="REG_No"
              value={formData.REG_No ?? ""}
              placeholder="Enter REG No"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="fatherName" className="formGroup">
            <Form.Label>Father's Name</Form.Label>
            <Form.Control
              type="text"
              name="Father_Name"
              value={formData.Father_Name ?? ""}
              placeholder="Enter Father's Name"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="address1" className="formGroup">
            <Form.Label>Address 1</Form.Label>
            <Form.Control
              type="text"
              name="Address1"
              value={formData.Address1 ?? ""}
              placeholder="Enter Address 1"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="address2" className="formGroup">
            <Form.Label>Address 2</Form.Label>
            <Form.Control
              type="text"
              name="Address2"
              value={formData.Address2 ?? ""}
              placeholder="Enter Address 2"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="pfNo" className="formGroup">
            <Form.Label>PF No</Form.Label>
            <Form.Control
              type="text"
              name="PF_No"
              value={formData.PF_No ?? ""}
              placeholder="Enter PF No"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="esicNo" className="formGroup">
            <Form.Label>ESIC No</Form.Label>
            <Form.Control
              type="text"
              name="ESIC_No"
              value={formData.ESIC_No ?? ""}
              placeholder="Enter ESIC No"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group
            controlId="isAdministrativeApplicable"
            className="formGroup"
          >
            <Form.Label>Is Administrative Applicable</Form.Label>
            <Form.Check
              type="checkbox"
              name="Is_Administrative_Applicable"
              checked={isYes(formData.Is_Administrative_Applicable)}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group
            controlId="administrativeChargePercent"
            className="formGroup"
          >
            <Form.Label>Administrative Charge Percent</Form.Label>
            <Form.Control
              type="number"
              name="Administrative_Charge_Percent"
              value={formData.Administrative_Charge_Percent ?? ""}
              placeholder="Enter Administrative Charge Percent"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group
            controlId="isFoodAccoChargesApplicable"
            className="formGroup"
          >
            <Form.Label>Is Food Acco Charges Applicable</Form.Label>
            <Form.Check
              type="checkbox"
              name="Is_FoodAccoChargs_Applicable"
              checked={isYes(formData.Is_FoodAccoChargs_Applicable)}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="foodAccoCharges" className="formGroup">
            <Form.Label>Food Acco Charges</Form.Label>
            <Form.Control
              type="number"
              name="Food_Acco_Charges"
              value={formData.Food_Acco_Charges ?? ""}
              placeholder="Enter Food Acco Charges"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="headIDs" className="formGroup">
            <Form.Label>Head IDs</Form.Label>
            <Form.Control
              type="text"
              name="HeadIDs"
              value={formData.HeadIDs ?? ""}
              placeholder="Enter Head IDs"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="emailID" className="formGroup">
            <Form.Label>Email ID</Form.Label>
            <Form.Control
              type="email"
              name="EmailID"
              value={formData.EmailID ?? ""}
              placeholder="Enter Email ID"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="contractorCode" className="formGroup">
            <Form.Label>Contractor Code</Form.Label>
            <Form.Control
              type="text"
              name="ContractorCode"
              value={formData.ContractorCode ?? ""}
              placeholder="Enter Contractor Code"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="GSTNo" className="formGroup">
            <Form.Label>GST No</Form.Label>
            <Form.Control
              type="text"
              name="GSTNo"
              value={formData.GSTNo ?? ""}
              placeholder="Enter GST No"
              onChange={handleChange}
            />
            {errors.GSTNo && (
              <div className="error-message">{errors.GSTNo}</div>
            )}
          </Form.Group>
          <Form.Group controlId="GSTPercent" className="formGroup">
            <Form.Label>GST Percent</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              name="GSTPercent"
              value={formData.GSTPercent ?? ""}
              placeholder="Enter GST Percent"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="GSTPercent1" className="formGroup">
            <Form.Label>GST Percent1</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              name="GSTPercent1"
              value={formData.GSTPercent1 ?? ""}
              placeholder="Enter GST Percent 1"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="contact_number" className="formGroup">
            <Form.Label>Contact Number</Form.Label>
            <Form.Control
              type="text"
              name="contact_number"
              value={formData.contact_number ?? ""}
              placeholder="Enter Contact Number"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="lic_no" className="formGroup">
            <Form.Label>Labour License No</Form.Label>
            <Form.Control
              type="text"
              name="labour_license_number"
              value={formData.labour_license_number ?? ""}
              placeholder="Enter Labour License Number"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group
            controlId="labour_license_valid_from"
            className="formGroup"
          >
            <Form.Label>
              License Validity From<span className="mandatory">*</span>
            </Form.Label>
            <Form.Control
              type="date"
              name="labour_license_valid_from"
              value={
                formData.labour_license_valid_from
                  ? formatDateForInput(formData.labour_license_valid_from)
                  : ""
              }
              placeholder="Enter License Validity From Date"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group
            controlId="labour_license_valid_from"
            className="formGroup"
          >
            <Form.Label>
              License Validity To<span className="mandatory">*</span>
            </Form.Label>
            <Form.Control
              type="date"
              name="labour_license_valid_to"
              value={
                formData.labour_license_valid_to
                  ? formatDateForInput(formData.labour_license_valid_to)
                  : ""
              }
              placeholder="Enter License Validity To Date"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="createdBy" className="formGroup">
            <Form.Label>Created By</Form.Label>
            <Form.Control
              type="text"
              name="Created_By"
              value={formData.Created_By ?? ""}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="createdDate" className="formGroup">
            <Form.Label>Created Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Created_Date"
              value={formData.Created_Date ?? ""}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="modifiedBy" className="formGroup">
            <Form.Label>Modified By</Form.Label>
            <Form.Control
              type="text"
              name="Modified_By"
              value={formData.Modified_By ?? ""}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="modifiedDate" className="formGroup">
            <Form.Label>Modified Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Modified_Date"
              value={formData.Modified_Date ?? ""}
              readOnly
            />
          </Form.Group>

          <div className="submit-button">
            <Button variant="primary" type="submit">
              Submit
            </Button>
          </div>
        </Form>
        <Row className="py-3">
          <Col>
            Existing User? <Link to="/login">Login Here</Link>
          </Col>
        </Row>
      </div>

      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>Unable to register</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccessModal} onHide={handleSuccessModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Success</Modal.Title>
        </Modal.Header>
        <Modal.Body>Contractor saved successfully</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleSuccessModalClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </MainScreen>
  );
};

export default ManageContractors;
