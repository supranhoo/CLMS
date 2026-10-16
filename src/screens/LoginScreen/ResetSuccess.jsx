import React, { useEffect } from "react";
import MainScreen from "../../components/MainScreen";
import { useNavigate } from "react-router-dom";
import "./ChangePassword.css";

const ResetSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login");
    }, 4000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <MainScreen title="Password Reset Successful">
      <div className="success-page">
        <h4 className="text-success">✅ Your password has been reset successfully.</h4>
        <p>You will be redirected to the login page shortly...</p>
      </div>
    </MainScreen>
  );
};

export default ResetSuccess;
