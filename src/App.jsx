import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { licenseBus } from "./utils/licenseBus";
import { useEffect, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import LicenseLockScreen from "./components/LicenseLockScreen";

//import User from "./components/User";
//import CreateUser from "./components/CreateUser";
//import UpdateUser from "./components/UpdateUser";
import LandingPage from "./screens/LandingPage/LandingPage";
import Dashboard from "./screens/LandingPage/Dashboard";
import LoginScreen from "./screens/LoginScreen/LoginScreen";
import ChangePassword from "./screens/LoginScreen/ChangePassword";
import RegisterScreen from "./screens/RegisterScreen/RegisterScreen";
import RegisterContractor from "./screens/Contractor/RegisterContractor";
import ManageContractors from "./screens/Contractor/ManageContractors";
import ManageUSers from "./screens/User/ManageUsers";
import AssignRoles from "./screens/User/AssignRoles";
import ManageEmployees from "./screens/Employee/ManageEmployees";
import ManageAttendance from "./screens/AttendanceMuster/ManageAttendance";
import ManageShGrpAlloc from "./screens/Employee/ManageShGrpAlloc";

import PrintDailyAttendance from "./screens/AttendanceMuster/PrintDailyAttendance";
import PrintAttendanceFormat2 from "./screens/AttendanceMuster/PrintAttendanceFormat2";
import MonthlyAtndSheet from "./screens/AttendanceMuster/MonthlyAtndSheet";
import UpdDeptInMust from "./screens/AttendanceMuster/UpdDeptInMust";
import RegularizePunchGrid from "./screens/AttendanceMuster/RegularizePunchGrid.jsx";
import PrintAtndSummary from "./screens/AttendanceMuster/PrintAtndSummary";
import RegenerateMuster from "./screens/AttendanceMuster/RegenerateMuster";
import ManualProcessAttendance from "./screens/AttendanceMuster/ManualProcessAttendance";
import PrintApprovedVsPresent from "./screens/AttendanceMuster/PrintApprovedVsPresent";
import PrintApprVsPresentPeriod from "./screens/AttendanceMuster/PrintApprVsPresentPeriod";

import ExportEmpMastDump from "./screens/Employee/ExportEmpMastDump";
import ExportFixWagesDump from "./screens/Wages/ExportFixWagesDump";
import ProcessWages from "./screens/Wages/ProcessWages";
import ManageFixWages from "./screens/Wages/ManageFixWages";
import PrintWages from "./screens/Wages/PrintWages";
import WageDeductions from "./screens/Wages/AddWageDeductionsGrid";
import WageEarnings from "./screens/Wages/AddWageEarningsGrid";

import WageArraers from "./screens/Wages/AddWageArrearsGrid";
import WageSlip from "./screens/Wages/WageSlip";
import PrintWageSlips from "./screens/Wages/PrintWageSlips";
import BankStatement from "./screens/Wages/ExportBankStatement";
import PFStatement from "./screens/Wages/ExportPFStatement";
import ESIStatement from "./screens/Wages/ExportESIStatement";
import CashStatement from "./screens/Wages/ExportCashStatement";
import UploadEmpWageComp from "./screens/Wages/UploadEmpWageComp";

import ManageProcessMonth from "./screens/Wages/ManageProcessMonth";
import ManageWageProcessLock from "./screens/Wages/ManageWageProcessLock";
import MonthlyAtndRegTimes from "./screens/AttendanceMuster/MonthlyAtndRegTimes";
import ManualMuster from "./screens/AttendanceMuster/ManualMuster";
import EmpRequest from "./screens/AttendanceMuster/EmpRequest.jsx";
import ServiceCharges from "./screens/Wages/ManageServiceCharges";
import ExportWageComparission from "./screens/Wages/ExportWageComparission";
import InActiveEmp from "./screens/Employee/InActiveEmp";
import ResetSuccess from "./screens/LoginScreen/ResetSuccess.jsx";
import ResetPasswd from "./screens/LoginScreen/ResetPasswd.jsx";

import ExpRegPunchDetToXLS from "./screens/AttendanceMuster/ExpRegPunchDet.jsx";
import ApproveEmployeeChanges from "./screens/Employee/ApproveEmployeeChanges";

import ManageApprovedManpower from "./screens/AttendanceMuster/ManageApprovedManpower.jsx";

import LeaveEntryTimeKeeper from "./screens/Leave/LeaveEntryTimeKeeper.jsx";
import ProcessSandwich from "./screens/AttendanceMuster/ProcessSandwich.jsx";
import SandwichRuleMaster from "./screens/AttendanceMuster/SandwichRuleMaster.jsx";

import PTReport from "./screens/Wages/PTReport";
import PTMonthReport from "./screens/Wages/PTMonthReport";
import LeaveLedgerEntry from "./screens/Leave/LeaveLedgerEntry.jsx";
import LeavePayrollPosting from "./screens/Leave/LeavePayrollPosting.jsx";
import LeaveLedgerSummaryReport from "./screens/Leave/LeaveLedgerSummaryReport.jsx";
import LeaveBalanceReport from "./screens/Leave/LeaveBalanceReport.jsx";
import BonusReport from "../src/screens/Wages/BonusReport.jsx";
import MasterDataManager from "./screens/MasterData/MasterDataManager.jsx";
import ShiftSetup from "./screens/MasterData/ShiftSetup.jsx";
import DevelopmentBanner from "./components/DevelopmentBanner";
import ServerWorkspace from './screens/Administration/ServerWorkspace';
import ServerOperations from './screens/Operations/ServerOperations';
import DevelopmentUnavailable from "./screens/Development/Unavailable";
import FeatureWorkbench from "./screens/Development/FeatureWorkbench";
import ComplianceReports from "./screens/Compliance/ComplianceReports";
import LocalWorkspace from "./screens/Development/LocalWorkspace";
import AppShell from "./components/layout/AppShell";
import PublicShell from "./components/layout/PublicShell";
import { selectUser } from "./features/userSlice";
import { useSelector } from "react-redux";

const PUBLIC_ROUTES = new Set(["/", "/login", "/change-password", "/register", "/resetpassword", "/resetsuccess"]);

function RoutedApplication() {
  const location = useLocation();
  const user = useSelector(selectUser);
  const isPublic = !user?.token || PUBLIC_ROUTES.has(location.pathname.toLowerCase());
  const routes = (
    <Routes>
      <Route path="/" Component={LandingPage} exact />
      <Route path="/Dashboard" Component={Dashboard} exact />
      <Route path="/dashboard" Component={Dashboard} exact />
      <Route path="/login" Component={LoginScreen} exact />
      <Route path="/change-password" Component={ChangePassword} exact />
      <Route path="/register" Component={RegisterScreen} exact />
      <Route
        path="/registerContractor"
        Component={RegisterContractor}
        exact
      />
      <Route
        path="/manageContractors"
        Component={ManageContractors}
        exact
      />
      <Route path="/manageUsers" Component={ManageUSers} exact />
      <Route path="/AssignRoles" Component={AssignRoles} exact />
      <Route
        path="/manageEmployees"
        Component={ManageEmployees}
        exact
      />
      <Route
        path="/manageAttendance"
        Component={ManageAttendance}
        exact
      />
      <Route
        path="/printDailyAttendance"
        Component={PrintDailyAttendance}
        exact
      />
      <Route
        path="/PrintAttendanceFormat2"
        Component={PrintAttendanceFormat2}
        exact
      />
      <Route
        path="/printAtndSummary"
        Component={PrintAtndSummary}
        exact
      />
      <Route
        path="/monthlyAtndSheet"
        Component={MonthlyAtndSheet}
        exact
      />
      <Route path="/updDeptInMust" Component={UpdDeptInMust} exact />
      <Route
        path="/manageShGrpAlloc"
        Component={ManageShGrpAlloc}
        exact
      />
      <Route
        path="/regularizePunches"
        Component={RegularizePunchGrid}
        exact
      />
      <Route
        path="/exportEmpMastDump"
        Component={ExportEmpMastDump}
        exact
      />
      <Route path="/processWages" Component={ProcessWages} exact />
      <Route
        path="/ExportFixWagesDump"
        Component={ExportFixWagesDump}
        exact
      />
      <Route path="/ManageFixWages" Component={ManageFixWages} exact />
      <Route path="/printWages" Component={PrintWages} exact />
      <Route
        path="/regenerateMuster"
        Component={RegenerateMuster}
        exact
      />
      <Route path="/wageDeductions" Component={WageDeductions} exact />
      <Route path="/wageEarnings" Component={WageEarnings} exact />
      <Route path="/wageArrears" Component={WageArraers} exact />
      <Route path="/PTReport" Component={PTReport} exact />
      <Route
        path="/manualProcessAttendance"
        Component={ManualProcessAttendance}
        exact
      />
      <Route path="/wageSlip" Component={WageSlip} exact />
      <Route path="/PrintWageSlips" Component={PrintWageSlips} exact />
      <Route
        path="/monthlyAtndRegTimes"
        Component={MonthlyAtndRegTimes}
        exact
      />
      <Route path="/getBankStatement" Component={BankStatement} exact />
      <Route path="/getPFStatement" Component={PFStatement} exact />
      <Route path="/getESIStatement" Component={ESIStatement} exact />
      <Route path="/getCashStatement" Component={CashStatement} exact />
      <Route path="/PTMonthReport" Component={PTMonthReport} exact />
      <Route
        path="/manageProcessMonth"
        Component={ManageProcessMonth}
        exact
      />
      <Route
        path="/manageWageProcessLock"
        Component={ManageWageProcessLock}
        exact
      />
      <Route path="/ManualMuster" Component={ManualMuster} exact />
      <Route path="/EmpRequest" Component={EmpRequest} exact />
      <Route
        path="/printApprovedVsPresent"
        Component={PrintApprovedVsPresent}
        exact
      />
      <Route path="/ServiceCharges" Component={ServiceCharges} exact />
      <Route
        path="/ExportWageComparission"
        Component={ExportWageComparission}
        exact
      />
      <Route
        path="/printApprVsPresentPeriod"
        Component={PrintApprVsPresentPeriod}
        exact
      />
      <Route path="/InActiveEmp" Component={InActiveEmp} exact />
      <Route path="/resetSuccess" element={<ResetSuccess />} />
      <Route path="/resetPassword" element={<ResetPasswd />} />
      <Route
        path="/ExpRegPunchDetToXLS"
        Component={ExpRegPunchDetToXLS}
        exact
      />
      <Route
        path="/UploadEmpWageComp"
        Component={UploadEmpWageComp}
        exact
      />
      <Route
        path="/ApproveEmployeeChanges"
        Component={ApproveEmployeeChanges}
        exact
      />
      <Route
        path="/ManageApprovedManpower"
        Component={ManageApprovedManpower}
        exact
      />
      <Route
        path="/LeaveEntryTimeKeeper"
        Component={LeaveEntryTimeKeeper}
        exact
      />
      <Route
        path="/leave-ledger-entry"
        element={<LeaveLedgerEntry />}
      />
      <Route
        path="/leave-payroll-posting"
        element={<LeavePayrollPosting />}
      />
      <Route
        path="/leave-ledger-summary"
        element={<LeaveLedgerSummaryReport />}
      />
      <Route
        path="/leave-balance-report"
        element={<LeaveBalanceReport />}
      />
      <Route
        path="/ProcessSandwich"
        Component={ProcessSandwich}
        exact
      />
      <Route
        path="/SandwichRuleMaster"
        Component={SandwichRuleMaster}
        exact
      />
      <Route path="/BonusReport" Component={BonusReport} exact />
      <Route path="/masters/shifts" element={<ShiftSetup />} />
      <Route
        path="/masters/business-units"
        element={<MasterDataManager master="business-units" />}
      />
      <Route
        path="/masters/cities"
        element={<MasterDataManager master="cities" />}
      />
      <Route
        path="/masters/divisions"
        element={<MasterDataManager master="divisions" />}
      />
      <Route
        path="/masters/holidays"
        element={<MasterDataManager master="holidays" />}
      />
      <Route
        path="/masters/locations"
        element={<MasterDataManager master="locations" />}
      />
      <Route
        path="/masters/cost-centres"
        element={<MasterDataManager master="cost-centres" />}
      />
      <Route path="/administration/server" element={<ServerWorkspace />} />
      <Route path="/masters/entities" element={<MasterDataManager master="entities" />} />
      <Route path="/masters/departments" element={<MasterDataManager master="departments" />} />
      <Route path="/server/workers" element={<ServerWorkspace kind="workers" />} />
      <Route path="/server/contractors" element={<ServerWorkspace kind="contractors" />} />
      <Route path="/server/attendance" element={<ServerOperations key="attendance" kind="attendance" />} />
      <Route path="/server/leave" element={<ServerOperations key="leave" kind="leave" />} />
      <Route path="/development/unavailable/:module" element={<DevelopmentUnavailable />} />
      <Route path="/development/features" element={<FeatureWorkbench />} />
      <Route path="/development/:tool" element={<LocalWorkspace />} />
      <Route path="/development/import/:kind" element={<LocalWorkspace />} />
      <Route path="/compliance/:form" element={<ComplianceReports />} />
      <Route path="*" element={<DevelopmentUnavailable />} />
    </Routes>
  );

  return isPublic ? <PublicShell>{routes}</PublicShell> : <AppShell>{routes}</AppShell>;
}


function App() {
  const [licenseError, setLicenseError] = useState(null);

  useEffect(() => licenseBus.subscribe((err) => {
    console.warn("🔒 GLOBAL LICENSE LOCK", err);
    setLicenseError(err);
  }), []);

  if (licenseError) {
    return <><DevelopmentBanner /><LicenseLockScreen message={licenseError.message} /></>;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <RoutedApplication />
      </BrowserRouter>
    </div>
  );
}

export default App;
