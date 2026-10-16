import React, { useState, useEffect, useRef } from "react";
import { Table, Form, Button, Alert, Modal } from "react-bootstrap";
import Select from "react-select";
import axios from "../../api/axios.js";
import styles from "./ManualMusterMark.module.css";

const EmpRequest = () => {
  const [requestsData, setRequestsData] = useState([]);
  const [newRequest, setNewRequest] = useState({
    employee_code: "",
    request_date: "",
    request_type: "",
    start_date: "",
    end_date: "",
    reason: "",
    approver_id: "",
  });
  const [employeeList, setEmployeeList] = useState([]);
  const [requestTypes] = useState([
    { value: "OD", label: "On Duty (OD)" },
    { value: "WFH", label: "Work From Home (WFH)" },
  ]);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const employeeCodeRef = useRef(null);

  // Fetch employee list on mount
  useEffect(() => {
    fetchEmployeeList();
    fetchRequestsData();
  }, []);

  const fetchEmployeeList = async () => {
    try {
      const response = await axios.get("/api/employee/getAllEmployees");
      const formattedList = response.data.map((employee) => ({
        value: employee.Employee_Code,
        label: `${employee.display_name} (${employee.Employee_Code})`,
      }));
      setEmployeeList(formattedList);
    } catch (error) {
      console.error("Error fetching employee list:", error);
    }
  };

  const fetchRequestsData = async () => {
    try {
      const response = await axios.post("/api/attendance/getEmpRequest");
      setRequestsData(response.data);
    } catch (error) {
      console.error("Error fetching requests data:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewRequest({ ...newRequest, [name]: value });
  };

  const handleSelectChange = (selectedOption, name) => {
    setNewRequest({ ...newRequest, [name]: selectedOption ? selectedOption.value : "" });
  };

  const handleAddRequest = async () => {
    try {
      const response = await axios.post("/api/attendance/addEmpRequest", newRequest);
      if (response.status === 200) {
        setRequestsData([...requestsData, response.data]);
        setSuccessMessage("Request added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);
        fetchRequestsData();
        setNewRequest({
          employee_code: "",
          request_date: "",
          request_type: "",
          start_date: "",
          end_date: "",
          reason: "",
          approver_id: "",
        });
        employeeCodeRef.current.focus();
      } else {
        setError("Failed to add request.");
      }
    } catch (error) {
      console.error("Error adding request:", error);
      setError("An error occurred while adding the request.");
    }
  };

  return (
    <div className={styles["requests-container"]}>
      <h3>Employee Requests</h3>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <div className={styles["form-grid"]}>
        <Form.Group>
          <Form.Label>Employee</Form.Label>
          <Select
            options={employeeList}
            value={employeeList.find((e) => e.value === newRequest.employee_code)}
            onChange={(selectedOption) => handleSelectChange(selectedOption, "employee_code")}
            placeholder="Select Employee"
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Request Date</Form.Label>
          <Form.Control
            type="date"
            name="request_date"
            value={newRequest.request_date}
            onChange={handleInputChange}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Request Type</Form.Label>
          <Select
            options={requestTypes}
            value={requestTypes.find((type) => type.value === newRequest.request_type)}
            onChange={(selectedOption) => handleSelectChange(selectedOption, "request_type")}
            placeholder="Select Request Type"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Start Date</Form.Label>
          <Form.Control
            type="date"
            name="start_date"
            value={newRequest.start_date}
            onChange={handleInputChange}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>End Date</Form.Label>
          <Form.Control
            type="date"
            name="end_date"
            value={newRequest.end_date}
            onChange={handleInputChange}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Reason</Form.Label>
          <Form.Control
            as="textarea"
            name="reason"
            value={newRequest.reason}
            onChange={handleInputChange}
            rows={3}
          />
        </Form.Group>

        <Button variant="primary" onClick={handleAddRequest}>
          Add Request
        </Button>
      </div>

      <Table bordered>
        <thead>
          <tr>
            <th>Employee Code</th>
            <th>Request Date</th>
            <th>Request Type</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Reason</th>
            <th>Approver ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requestsData.length > 0 ? (
            requestsData.map((request, index) => (
              <tr key={index}>
                <td>{request.employee_code}</td>
                <td>{request.request_date}</td>
                <td>{request.request_type}</td>
                <td>{request.start_date}</td>
                <td>{request.end_date}</td>
                <td>{request.reason}</td>
                <td>{request.approver_id}</td>
                <td>
                  <Button size="sm" variant="danger">
                    Delete
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">No requests found.</td>
            </tr>
          )}
          <tr>
            <td colSpan="7">Add new request above.</td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};

export default EmpRequest;
