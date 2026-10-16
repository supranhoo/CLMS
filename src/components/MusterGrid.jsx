import React from "react";
import DetailedAttendanceGrid from "./DetailedAttendanceGrid";
import PunchesGrid from "./PunchesGrid";
import "./MusterGrid.css"; // Include the CSS for the grids

const AttendancePage = ({ employee_code, from_date, to_date }) => {
  return (
    <div className="attendance-container">
      {/* Display DetailedAttendanceGrid first */}
      <div className="detailed-grid-wrapper">
        <DetailedAttendanceGrid employee_code={employee_code} from_date={from_date} to_date={to_date} />
      </div>

      {/* Display PunchesGrid second */}
      <div className="punches-grid-wrapper">
        <PunchesGrid employee_code={employee_code} from_date={from_date} to_date={to_date} />
      </div>
    </div>
  );
};

export default AttendancePage;
