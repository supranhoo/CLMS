import React, { useState } from "react";
import MainScreen from "../../components/MainScreen";
import { Button, Row, Col, Form, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerContractor, selectUser } from "../../features/userSlice";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import "./Contractor.css";

const RegisterContractor = () => {
  const user = useSelector(selectUser);
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const getCurrentDateTime = () => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    return formattedDate;
  };

  const [formData, setFormData] = useState({
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
    Created_By: "",
    Created_Date: getCurrentDateTime(),
    Modified_By: "",
    Modified_Date: getCurrentDateTime(),
    Is_Administrative_Applicable: false,
    Administrative_Charge_Percent: "",
    Is_FoodAccoChargs_Applicable: false,
    Food_Acco_Charges: "",
    HeadIDs: "",
    EmailID: "",
    ContractorCode: "",
    GstNo: "",
    GstPercent: "",
    GstPercent1: "",
  });

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

  const submitHandler = async (e) => {
    e.preventDefault();

    setError(false);
    setLoading(true);

    try {
      const updatedFormData = {
        ...formData,
        GstPercent: formData.GstPercent
          ? parseFloat(formData.GstPercent).toFixed(2)
          : "0.00",
        GstPercent1: formData.GstPercent1
          ? parseFloat(formData.GstPercent1).toFixed(2)
          : "0.00",
        Administrative_Charge_Percent: formData.Administrative_Charge_Percent
          ? parseFloat(formData.Administrative_Charge_Percent).toFixed(2)
          : "0.00",
        Food_Acco_Charges: formData.Food_Acco_Charges
          ? parseFloat(formData.Food_Acco_Charges).toFixed(2)
          : "0.00",
      };
      const result = await dispatch(registerContractor(updatedFormData));
      if (result.payload) {
        setMessage("");
        setError(false);
        setShowSuccessModal(true);
      } else if (result.error) {
        setShowErrorModal(true);
        console.error("Error:", result.error);
        setError(true);
        setMessage(result.error.message || "Registration failed.");
      }
      setLoading(false);
    } catch (error) {
      setShowErrorModal(true);
      console.error("Submit Error:", error);
      setError(true);
      setLoading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate("/"); // Navigate to the home route after closing the modal
  };

  if (!token) {
    return (
      <div>
        <p>You must be logged in to register a contractor.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  return (
    <MainScreen title="Contractor Registration">
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
              value={formData.Contractor_ID}
              placeholder="Enter Contractor ID"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="contractorName" className="formGroup">
            <Form.Label>Contractor Name</Form.Label>
            <Form.Control
              type="text"
              name="Contractor_Name"
              value={formData.Contractor_Name}
              placeholder="Enter Contractor Name"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="billingName" className="formGroup">
            <Form.Label>Billing Name</Form.Label>
            <Form.Control
              type="text"
              name="Billing_Name"
              value={formData.Billing_Name}
              placeholder="Enter Billing Name"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="panNo" className="formGroup">
            <Form.Label>PAN No</Form.Label>
            <Form.Control
              type="text"
              name="PAN_No"
              value={formData.PAN_No}
              placeholder="Enter PAN No"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="tanNo" className="formGroup">
            <Form.Label>TAN No</Form.Label>
            <Form.Control
              type="text"
              name="TAN_No"
              value={formData.TAN_No}
              placeholder="Enter TAN No"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="girNo" className="formGroup">
            <Form.Label>GIR No</Form.Label>
            <Form.Control
              type="text"
              name="GIR_No"
              value={formData.GIR_No}
              placeholder="Enter GIR No"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="regNo" className="formGroup">
            <Form.Label>REG No</Form.Label>
            <Form.Control
              type="text"
              name="REG_No"
              value={formData.REG_No}
              placeholder="Enter REG No"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="fatherName" className="formGroup">
            <Form.Label>Father's Name</Form.Label>
            <Form.Control
              type="text"
              name="Father_Name"
              value={formData.Father_Name}
              placeholder="Enter Father's Name"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="address1" className="formGroup">
            <Form.Label>Address 1</Form.Label>
            <Form.Control
              type="text"
              name="Address1"
              value={formData.Address1}
              placeholder="Enter Address 1"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="address2" className="formGroup">
            <Form.Label>Address 2</Form.Label>
            <Form.Control
              type="text"
              name="Address2"
              value={formData.Address2}
              placeholder="Enter Address 2"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="pfNo" className="formGroup">
            <Form.Label>PF No</Form.Label>
            <Form.Control
              type="text"
              name="PF_No"
              value={formData.PF_No}
              placeholder="Enter PF No"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="esicNo" className="formGroup">
            <Form.Label>ESIC No</Form.Label>
            <Form.Control
              type="text"
              name="ESIC_No"
              value={formData.ESIC_No}
              placeholder="Enter ESIC No"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="createdBy" className="formGroup">
            <Form.Label>Created By</Form.Label>
            <Form.Control
              type="text"
              name="Created_By"
              value={formData.Created_By}
              placeholder="Enter Created By"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="createdDate" className="formGroup">
            <Form.Label>Created Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Created_Date"
              value={formData.Created_Date}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="modifiedBy" className="formGroup">
            <Form.Label>Modified By</Form.Label>
            <Form.Control
              type="text"
              name="Modified_By"
              value={formData.Modified_By}
              placeholder="Enter Modified By"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="modifiedDate" className="formGroup">
            <Form.Label>Modified Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Modified_Date"
              value={formData.Modified_Date}
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
              checked={formData.Is_Administrative_Applicable}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group
            controlId="administrativeChargePercent"
            className="formGroup"
          >
            <Form.Label>Administrative Charge Percent</Form.Label>
            <Form.Control
              type="text"
              name="Administrative_Charge_Percent"
              value={formData.Administrative_Charge_Percent}
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
              checked={formData.Is_FoodAccoChargs_Applicable}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="foodAccoCharges" className="formGroup">
            <Form.Label>Food Acco Charges</Form.Label>
            <Form.Control
              type="text"
              name="Food_Acco_Charges"
              value={formData.Food_Acco_Charges}
              placeholder="Enter Food Acco Charges"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="headIDs" className="formGroup">
            <Form.Label>Head IDs</Form.Label>
            <Form.Control
              type="text"
              name="HeadIDs"
              value={formData.HeadIDs}
              placeholder="Enter Head IDs"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="emailID" className="formGroup">
            <Form.Label>Email ID</Form.Label>
            <Form.Control
              type="email"
              name="EmailID"
              value={formData.EmailID}
              placeholder="Enter Email ID"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="contractorCode" className="formGroup">
            <Form.Label>Contractor Code</Form.Label>
            <Form.Control
              type="text"
              name="ContractorCode"
              value={formData.ContractorCode}
              placeholder="Enter Contractor Code"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="gstNo" className="formGroup">
            <Form.Label>GST No</Form.Label>
            <Form.Control
              type="text"
              name="GstNo"
              value={formData.GstNo}
              placeholder="Enter GST No"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="gstPercent" className="formGroup">
            <Form.Label>GST Percent</Form.Label>
            <Form.Control
              type="text"
              name="GstPercent"
              value={formData.GstPercent}
              placeholder="Enter GST Percent"
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group controlId="gstPercent1" className="formGroup">
            <Form.Label>GST Percent 1</Form.Label>
            <Form.Control
              type="text"
              name="GstPercent1"
              value={formData.GstPercent1}
              placeholder="Enter GST Percent 1"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="createdBy" className="formGroup">
            <Form.Label>Created By</Form.Label>
            <Form.Control
              type="text"
              name="Created_By"
              value={formData.Created_By}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="createdDate" className="formGroup">
            <Form.Label>Created Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Created_Date"
              value={formData.Created_Date}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="modifiedBy" className="formGroup">
            <Form.Label>Modified By</Form.Label>
            <Form.Control
              type="text"
              name="Modified_By"
              value={formData.Modified_By}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="modifiedDate" className="formGroup">
            <Form.Label>Modified Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Modified_Date"
              value={formData.Modified_Date}
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

export default RegisterContractor;
