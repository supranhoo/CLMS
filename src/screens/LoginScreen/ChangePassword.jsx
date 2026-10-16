import React, { useState, useEffect } from "react";
import MainScreen from "../../components/MainScreen";
import { Button, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios.js";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import { useSelector } from "react-redux";
import "./ChangePassword.css"; // Link to external CSS for styling

const ChangePassword = () => {
  const user = useSelector((state) => state.user);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Check if user is logged in, otherwise redirect to login page
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Please fill all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`, // Authentication token
        },
      };

      const { data } = await axios.post(
        "/api/Users/changePassword",
        { emp_id, oldPassword, newPassword },
        config
      );

      setLoading(false);
      setMessage("Password updated successfully");

      // Wait for 3-4 seconds before logging out and redirecting to login page
      setTimeout(() => {
        navigate("/login"); // Redirect to login page after success
      }, 3000); // 3 seconds
    } catch (error) {
      setLoading(false);
      const backendMessage =
        error.response?.data?.message || "Failed to change password. Please try again.";
      setError(backendMessage);
    }  };

  return (
    <MainScreen title="Change Password">
      <div className="change-password-container">
        {error && <ErrorMessage variant="danger">{error}</ErrorMessage>}
        {message && <div className="success-message">{message}</div>}
        {loading && <Loading />}

        <Form onSubmit={submitHandler} className="change-password-form">
          <Form.Group controlId="formOldPassword" className="mb-3">
            <Form.Label>Old Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter your old password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </Form.Group>

          <Form.Group controlId="formNewPassword" className="mb-3">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Form.Group>

          <Form.Group controlId="formConfirmPassword" className="mb-3">
            <Form.Label>Confirm New Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Form.Group>

          <div className="d-grid gap-2">
            <Button variant="primary" type="submit">
              Change Password
            </Button>
          </div>
        </Form>
      </div>
    </MainScreen>
  );
};

export default ChangePassword;
