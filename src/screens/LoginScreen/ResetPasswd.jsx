import React, { useState, useRef, useEffect } from "react";
import MainScreen from "../../components/MainScreen";
import { Button, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios.js";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import "./ChangePassword.css";
import { validatePassword } from "../../utils/validatePassword";
import zxcvbn from "zxcvbn";

const ResetPasswd = () => {
  const navigate = useNavigate();

  const empIdRef = useRef(null);
  const tokenRef = useRef(null);
  const newPasswordRef = useRef(null);

  const [empId, setEmpId] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const passwordStrength = zxcvbn(newPassword).score;
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tokenSent, setTokenSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    empIdRef.current?.focus();
  }, []);

  const handleGenerateToken = async () => {
    if (!empId) {
      setError("Please enter your User ID.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post("/api/users/generateResetToken", { emp_id: empId });
      setMessage(data.message);
      setTokenSent(true);

      // Move focus to token field
      setTimeout(() => tokenRef.current?.focus(), 200);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send token.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!token || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const { isFormatStrong, zxcvbnScore, isStrong } = validatePassword(newPassword);
    if (!isStrong) {
      let msg = "Password must contain uppercase, lowercase, digit, special char, and be 8+ chars long.";
      if (isFormatStrong && zxcvbnScore < 3) {
        msg = "Password is too weak or common. Please choose something more unique.";
      }
      setError(msg);
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      //const { data } =   await axios.post("/api/users/resetPassword", { emp_id: empId, token, newPassword } );
      const { data } = await axios.post("/api/users/resetPassword", { emp_id: empId, token, newPassword } );

      if (data.success) {
        navigate("/resetSuccess");
      } else {
        console.log("data:",data);
        setError(data.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error("Reset error:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Error resetting password.");
    }
    finally {
      setLoading(false);
    }
  };

  return (
    <MainScreen title="Reset Password">
      <div className="change-password-container">
        {error && <ErrorMessage variant="danger">{error}</ErrorMessage>}
        {message && (
          <div className="alert alert-success">
            {message}
            <br />
            <small className="text-muted">
              This OTP is valid for 10 minutes. Maximum 3 requests allowed per day.
            </small>
          </div>
        )}

        {loading && <Loading />}

        <Form onSubmit={handleResetPassword} className="change-password-form">
          <Form.Group controlId="formEmpId" className="mb-3">
            <Form.Label>User ID</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter your user ID"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              disabled={tokenSent}
              ref={empIdRef}
              className="input-field"
            />
          </Form.Group>

          {!tokenSent && (
            <div className="d-grid gap-2">
              <Button variant="warning" onClick={handleGenerateToken}>
                🔐 Generate Token
              </Button>
            </div>
          )}

          {tokenSent && (
            <>
              <Form.Group controlId="formToken" className="mb-3 mt-3">
                <Form.Label>Token</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Token from the local administrator recovery outbox"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  ref={tokenRef}
                />
              </Form.Group>

              <Form.Group controlId="formNewPassword" className="mb-3">
                <Form.Label>New Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  ref={newPasswordRef}
                />
              </Form.Group>

              <Form.Group controlId="formConfirmPassword" className="mb-3">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {newPassword && (
                  <div className={`strength-meter strength-${zxcvbn(newPassword).score}`}>
                    Password strength: {["Very Weak", "Weak", "Fair", "Good", "Strong"][zxcvbn(newPassword).score]}
                  </div>
                )}
              </Form.Group>

              <div className="d-grid gap-2">
                <Button variant="success" type="submit">
                  ✅ Reset Password
                </Button>
              </div>
            </>
          )}
        </Form>
      </div>
    </MainScreen>
  );
};

export default ResetPasswd;
