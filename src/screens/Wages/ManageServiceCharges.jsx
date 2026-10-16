import React, { useState, useEffect, useRef } from "react";
import { Table, Form, Button, Alert, Modal } from "react-bootstrap";
import axios from "../../api/axios.js";
import Select from 'react-select';
import styles from "./AddWageDeductionsGrid.module.css";

const ManageServiceCharges = () => {
  const [serviceCharges, setServiceCharges] = useState([]);
  const [newServiceCharge, setNewServiceCharge] = useState({
    ContractorID: "",
    RuleType: "",
    EmployeeCode: "",
    BasicRate: "",
    rate: "",
    Eff_PMonth: "",
    DesignCode: "",
    BuCode: "",
    entity_code: "",
  });
  const [ruleTypes, setRuleTypes] = useState([
    { value: "EmployeeCode", label: "Employee Code" },
    { value: "Designation", label: "Designation" },
    { value: "BuCode", label: "BU Code" },
    { value: "BasicRate", label: "Basic Rate" },
  ]);
  const [contractors, setContractors] = useState([]);
  const [processMonths, setProcessMonths] = useState([]);
  const [entities, setEntities] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const employeeCodeRef = useRef(null);

  useEffect(() => {
    fetchContractors();
    fetchProcessMonths();
    fetchEntities();
    fetchDesignations();
    fetchBusinessUnits();
    fetchServiceCharges();
  }, []);

  const fetchContractors = async () => {
    try {
      const response = await axios.get("/api/contractor/getAllContractors");
      setContractors(response.data.map(c => ({ value: c.Contractor_ID, label: c.Contractor_Name })));
    } catch (error) {
      console.error("Error fetching contractors:", error);
    }
  };

  const fetchProcessMonths = async () => {
    try {
      const response = await axios.post("/api/wages/getAllProcessMonth");
      setProcessMonths(response.data.map(p => ({ value: p.pmonth, label: p.pmonth })));
    } catch (error) {
      console.error("Error fetching process months:", error);
    }
  };

  const fetchEntities = async () => {
    try {
      const response = await axios.get("/api/entity/");
      setEntities(response.data.map(e => ({ value: e.entity_code, label: e.entity_name })));
    } catch (error) {
      console.error("Error fetching entities:", error);
    }
  };

  const fetchDesignations = async () => {
    try {
      const response = await axios.post("/api/entity/getAllDept");
      setDesignations(response.data.map(d => ({ value: d.dept_code, label: d.dept_name })));
    } catch (error) {
      console.error("Error fetching designations:", error);
    }
  };

  const fetchBusinessUnits = async () => {
    try {
      const response = await axios.post("/api/entity/getAllBU");
      setBusinessUnits(response.data.map(bu => ({ value: bu.bu_code, label: bu.bu_name })));
    } catch (error) {
      console.error("Error fetching business units:", error);
    }
  };

  const fetchServiceCharges = async () => {
    try {
      const response = await axios.get("/api/wages/getServiceCharges");
      setServiceCharges(response.data);
    } catch (error) {
      console.error("Error fetching service charges:", error);
      setErrorMessage("Failed to fetch service charges.");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewServiceCharge({ ...newServiceCharge, [name]: value });
  };

  const handleSelectChange = (selectedOption, field) => {
    setNewServiceCharge({ ...newServiceCharge, [field]: selectedOption.value });
  };

  const handleAddServiceCharge = async () => {
    try {
      const response = await axios.post("/api/wages/addServiceCharges", newServiceCharge);
      if (response.status === 200) {
        setServiceCharges([...serviceCharges, response.data]);
        setNewServiceCharge({
          ContractorID: "",
          RuleType: "",
          EmployeeCode: "",
          BasicRate: "",
          rate: "",
          Eff_PMonth: "",
          DesignCode: "",
          BuCode: "",
          entity_code: "",
        });
        setSuccessMessage("Service charge added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error adding service charge:", error);
      setErrorMessage("Failed to add service charge.");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const handleDeleteServiceCharge = async (ruleID) => {
    try {
      const response = await axios.delete(`/api/wages/deleteServiceCharges/${ruleID}`);
      //const response = await axios.delete("/api/wages/deleteServiceCharges", ruleID);
      if (response.status === 200) {
        setServiceCharges(serviceCharges.filter(sc => sc.RuleID !== ruleID));
        setSuccessMessage("Service charge deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error deleting service charge:", error);
      setErrorMessage("Failed to delete service charge.");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  return (
    <div className={styles.container}>
      <h3>Manage Service Charges</h3>
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

      <div className={styles.formContainer}>
        <Form>
          <Form.Group>
            <Form.Label>Entity</Form.Label>
            <Select
              options={entities}
              onChange={(option) => handleSelectChange(option, "entity_code")}
              placeholder="Select Entity"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Contractor</Form.Label>
            <Select
              options={contractors}
              onChange={(option) => handleSelectChange(option, "ContractorID")}
              placeholder="Select Contractor"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Process Month</Form.Label>
            <Select
              options={processMonths}
              onChange={(option) => handleSelectChange(option, "Eff_PMonth")}
              placeholder="Select Process Month"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Rule Type</Form.Label>
            <Select
              options={ruleTypes}
              onChange={(option) => handleSelectChange(option, "RuleType")}
              placeholder="Select Rule Type"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Employee Code</Form.Label>
            <Form.Control
              type="text"
              name="EmployeeCode"
              value={newServiceCharge.EmployeeCode}
              onChange={handleInputChange}
              placeholder="Enter Employee Code"
              ref={employeeCodeRef}
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Basic Rate</Form.Label>
            <Form.Control
              type="number"
              name="BasicRate"
              value={newServiceCharge.BasicRate}
              onChange={handleInputChange}
              placeholder="Enter Basic Rate"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Rate</Form.Label>
            <Form.Control
              type="number"
              name="rate"
              value={newServiceCharge.rate}
              onChange={handleInputChange}
              placeholder="Enter Rate"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Designation</Form.Label>
            <Select
              options={designations}
              onChange={(option) => handleSelectChange(option, "DesignCode")}
              placeholder="Select Designation"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>BU Code</Form.Label>
            <Select
              options={businessUnits}
              onChange={(option) => handleSelectChange(option, "BuCode")}
              placeholder="Select BU Code"
            />
          </Form.Group>

          <Button onClick={handleAddServiceCharge} variant="primary">Add Service Charge</Button>
        </Form>
      </div>

      <Table bordered>
        <thead>
          <tr>
            <th>Rule ID</th>
            <th>Rule Type</th>
            <th>Process Month</th>
            <th>Entity Code</th>
            <th>Contractor Code</th>
            <th>Contractor Name</th>
            <th>BU Code</th>
            <th>Designation</th>
            <th>Employee Code</th>
            <th>Basic Rate</th>
            <th>Rate</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {serviceCharges.map((sc) => (
            <tr key={sc.RuleID}>
              <td>{sc.RuleID}</td>
              <td>{sc.RuleType}</td>
              <td>{sc.Eff_PMonth}</td>
              <td>{sc.entity_code}</td>
              <td>{sc.ContractorID}</td>
              <td>{sc.ContractorName}</td>
              <td>{sc.BuCode}</td>
              <td>{sc.DesignCode}</td>
              <td>{sc.EmployeeCode}</td>
              <td>{sc.BasicRate}</td>
              <td>{sc.rate}</td>
              <td>
                <Button variant="danger" onClick={() => handleDeleteServiceCharge(sc.RuleID)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default ManageServiceCharges;
