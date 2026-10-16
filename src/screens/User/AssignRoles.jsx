import React, { useState, useEffect } from "react";
import axios from "../../api/axios.js";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import { apiErrorMessage } from "../../utils/apiError";
import styles from "./AssignRoles.module.css"; // Custom CSS module
import { useNavigate } from "react-router-dom"; // Import useNavigate

const AssignRoles = ({ existingData, onSubmit }) => {
  const navigate = useNavigate(); // Initialize navigate
  const [cleared, setCleared] = useState(false); // Track if clearing is done
  const [empCode, setEmpCode] = useState("");
  const [copyEmpCode, setCopyEmpCode] = useState("");
  const [loadError, setLoadError] = useState("");

  const [bu, setBu] = useState([]);
  const [selectedBu, setSelectedBu] = useState([]);
  const [contractor, setContractor] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState([]);
  const [dept, setDept] = useState([]);
  const [selectedDept, setSelectedDept] = useState([]);

  const [menu, setMenu] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState([]);

  const [location, setLocation] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState([]);

  const [menuActivity, setMenuActivity] = useState([]);
  const [selectedMenuActivity, setSelectedMenuActivity] = useState([]);

  const user = useSelector(selectUser); // Get user details from state

  // Fetch Business Unit data from API
  useEffect(() => {
    // Fetch Business Unit data from API when component mounts
    fetchBUData();
    fetchContractorData();
    fetchDeptData();
    fetchMenuData();
    fetchLocationData();
    fetchMenuActivityData();

    if (existingData) {
      setEmpCode(existingData.emp_code);
      setSelectedBu(existingData.bu_codes || []);
      setSelectedContractor(existingData.contractor_codes || []);
      setSelectedDept(existingData.dept_codes || []);
      setSelectedMenu(existingData.menu_ids || []);
      setSelectedMenuActivity(existingData.menu_ids || []);
      setSelectedLocation(existingData.loc_codes || []);
    }
  }, [existingData]);

  useEffect(() => {
    if (cleared) {
      // Fetch Business Unit data from API when component mounts
      fetchBUData();
      fetchContractorData();
      fetchDeptData();
      fetchMenuData();
      fetchMenuActivityData();
      fetchLocationData();

      // Fetch and populate roles for the given employee code after clearing
      fetchRolesFromEmployee(empCode);

      // Reset the cleared flag after fetching the roles
      setCleared(false);
    }
  }, [cleared, empCode]);

  const fetchBUData = async () => {
    try {
      // Sending a POST request to the API without any parameters
      const response = await axios.post("/api/entity/getAllBU");

      // Assuming the response data is an array of objects with bu_code and bu_name
      const formattedBUData = response.data.map((item) => ({
        bu_code: item.bu_code,
        bu_name: item.bu_name,
      }));

      setBu(formattedBUData); // Set formatted data to state
    } catch (error) {
      console.error("Error fetching BU data:", error);
      setLoadError(apiErrorMessage(error));
    }
  };

  const fetchContractorData = async () => {
    try {
      // Sending a POST request to the API without any parameters
      const response = await axios.get("/api/contractor/getAllContractors");

      // Assuming the response data is an array of objects with bu_code and bu_name
      const formattedContractorData = response.data.map((item) => ({
        contractor_code: item.Contractor_ID,
        contractor_name: item.Contractor_Name,
      }));

      setContractor(formattedContractorData); // Set formatted data to state
    } catch (error) {
      console.error("Error fetching Contractor data:", error);
      setLoadError(apiErrorMessage(error));
    }
  };

  const fetchDeptData = async () => {
    try {
      // Sending a POST request to the API without any parameters
      const response = await axios.post("/api/entity/getAllDept");

      // Assuming the response data is an array of objects with bu_code and bu_name
      const formattedDeptData = response.data.map((item) => ({
        dept_code: item.dept_code,
        dept_name: item.dept_name,
      }));

      setDept(formattedDeptData); // Set formatted data to state
    } catch (error) {
      console.error("Error fetching BU data:", error);
      setLoadError(apiErrorMessage(error));
    }
  };

  const fetchMenuData = async () => {
    try {
      // Sending a POST request to the API without any parameters
      const response = await axios.get("/api/menu/getMenuData");

      // Assuming the response data is an array of objects with bu_code and bu_name
      const formattedMenuData = response.data.map((item) => ({
        menu_id: item.menu_id,
        menu_name: item.menu_name,
      }));

      setMenu(formattedMenuData); // Set formatted data to state
    } catch (error) {
      console.error("Error fetching Contractor data:", error);
      setLoadError(apiErrorMessage(error));
    }
  };

  const fetchLocationData = async () => {
    try {
      // Sending a POST request to the API without any parameters
      const response = await axios.get("/api/menu/getLocationData");

      console.log("fetchLocationData:", response);
      // Assuming the response data is an array of objects with bu_code and bu_name
      const formattedLocationData = response.data.map((item) => ({
        loc_code: item.loc_code,
        loc_name: item.loc_name,
      }));

      setLocation(formattedLocationData); // Set formatted data to state
    } catch (error) {
      console.error("Error fetching location data:", error);
      setLoadError(apiErrorMessage(error));
    }
  };

  const fetchMenuActivityData = async () => {
    try {
      // Sending a POST request to the API without any parameters
      const response = await axios.post("/api/menu/getMenuActivityData");

      // Assuming the response data is an array of objects with bu_code and bu_name
      const formattedMenuActivityData = response.data.map((item) => ({
        menu_id: item.menu_id,
        menu_name: item.menu_name,
        activity_name: item.activity_name,
      }));

      setMenuActivity(formattedMenuActivityData); // Set formatted data to state
    } catch (error) {
      console.error("Error fetching Contractor data:", error);
      setLoadError(apiErrorMessage(error));
    }
  };

  const mergeBack = (available, selected, key) => [
    ...available,
    ...selected.filter(
      (item) => !available.some((avail) => avail[key] === item[key])
    ),
  ];

  // Put every selection back into its available list and empty the selections.
  const clearSelections = () => {
    setBu(mergeBack(bu, selectedBu, "bu_code"));
    setSelectedBu([]);
    setContractor(mergeBack(contractor, selectedContractor, "contractor_code"));
    setSelectedContractor([]);
    setDept(mergeBack(dept, selectedDept, "dept_code"));
    setSelectedDept([]);
    setMenu(mergeBack(menu, selectedMenu, "menu_id"));
    setSelectedMenu([]);
    setMenuActivity(mergeBack(menuActivity, selectedMenuActivity, "menu_id"));
    setSelectedMenuActivity([]);
    setLocation(mergeBack(location, selectedLocation, "loc_code"));
    setSelectedLocation([]);
  };

  const fetchRolesFromEmployee = async (employeeCode) => {
    try {
      const filterAndAssignRoles = async (available, selected, url, key) => {
        const response = await axios.post(url, { emp_id: employeeCode });
        const fetched = response.data;
        // Replace the selections with the fetched ones; anything that was selected
        // but is not fetched goes back to the available list.
        const universe = mergeBack(available, selected, key);
        const updatedAvailable = universe.filter(
          (item) =>
            !fetched.some((fetchedItem) => fetchedItem[key] === item[key])
        );
        const updatedSelected = fetched;
        console.log("step1", updatedAvailable);
        console.log("Step2", updatedSelected);
        return { updatedAvailable, updatedSelected };
      };

      const {
        updatedAvailable: updatedBu,
        updatedSelected: updatedSelectedBu,
      } = await filterAndAssignRoles(
        bu,
        selectedBu,
        "/api/assignRoles/getUserBU",
        "bu_code"
      );
      setBu(updatedBu);
      setSelectedBu(updatedSelectedBu);
      console.log("updatedBU", updatedBu);
      console.log("updatedSelectedBU", updatedSelectedBu);

      const {
        updatedAvailable: updatedContractor,
        updatedSelected: updatedSelectedContractor,
      } = await filterAndAssignRoles(
        contractor,
        selectedContractor,
        "/api/assignRoles/getUserContractor",
        "contractor_code"
      );
      setContractor(updatedContractor);
      setSelectedContractor(updatedSelectedContractor);

      const {
        updatedAvailable: updatedDept,
        updatedSelected: updatedSelectedDept,
      } = await filterAndAssignRoles(
        dept,
        selectedDept,
        "/api/assignRoles/getUserDept",
        "dept_code"
      );
      setDept(updatedDept);
      setSelectedDept(updatedSelectedDept);

      const {
        updatedAvailable: updatedMenu,
        updatedSelected: updatedSelectedMenu,
      } = await filterAndAssignRoles(
        menu,
        selectedMenu,
        "/api/assignRoles/getUserMenu",
        "menu_id"
      );
      setMenu(updatedMenu);
      setSelectedMenu(updatedSelectedMenu);

      const {
        updatedAvailable: updatedMenuActivity,
        updatedSelected: updatedSelectedMenuActivity,
      } = await filterAndAssignRoles(
        menuActivity,
        selectedMenuActivity,
        "/api/assignRoles/getUserMenuActivity",
        "menu_id"
      );
      setMenuActivity(updatedMenuActivity);
      setSelectedMenuActivity(updatedSelectedMenuActivity);

      const {
        updatedAvailable: updatedLocation,
        updatedSelected: updatedSelectedLocation,
      } = await filterAndAssignRoles(
        location,
        selectedLocation,
        "/api/assignRoles/getUserLocation",
        "loc_code"
      );
      setLocation(updatedLocation);
      setSelectedLocation(updatedSelectedLocation);
    } catch (error) {
      console.error(
        `Error fetching roles for employee ${employeeCode}:`,
        error
      );
      setLoadError(apiErrorMessage(error));
    }
  };

  const handleCopyRoles = () => {
    fetchRolesFromEmployee(copyEmpCode);
  };

  const handleShowRoles = () => {
    fetchRolesFromEmployee(empCode);
  };

  const moveItems = (
    sourceItems,
    setSourceItems,
    targetItems,
    setTargetItems,
    selectedItems,
    key
  ) => {
    console.log("Selected Items to Move:", selectedItems);
    console.log("Source Items:", sourceItems);
    console.log("Target Items:", targetItems);

    const itemsToMove = selectedItems;

    // Filter the sourceItems to remove the selected items
    const newSourceItems = sourceItems.filter(
      (item) => !itemsToMove.includes(String(item[key]))
    );

    // Add the selected items to the targetItems
    const newTargetItems = [
      ...targetItems,
      ...sourceItems.filter((item) => itemsToMove.includes(String(item[key]))),
    ];

    // Sort by the appropriate name field (like menu_name, dept_name, etc.)
    const sortedTargetItems = newTargetItems.sort((a, b) => {
      const nameKey = key.replace("_code", "_name"); // Ensure we replace _code with _name

      // Make sure both a[nameKey] and b[nameKey] are valid strings before calling localeCompare
      if (typeof a[nameKey] === "string" && typeof b[nameKey] === "string") {
        return a[nameKey].localeCompare(b[nameKey]);
      } else {
        return 0; // If either name is invalid, don't attempt sorting
      }
    });

    setSourceItems(newSourceItems);
    setTargetItems(sortedTargetItems);
  };

  const [selectedBuCodes, setSelectedBuCodes] = useState([]);
  const [selectedContractorCodes, setSelectedContractorCodes] = useState([]);
  const [selectedDeptCodes, setSelectedDeptCodes] = useState([]);
  const [selectedMenuCodes, setSelectedMenuCodes] = useState([]);
  const [selectedLocCodes, setSelectedLocCodes] = useState([]);
  const [selectedMenuActivityCodes, setSelectedMenuActivityCodes] = useState(
    []
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      [
        selectedBu,
        selectedContractor,
        selectedDept,
        selectedMenu,
        selectedMenuActivity,
        selectedLocation,
      ].every((list) => list.length === 0) &&
      !window.confirm(
        "This will remove all assignments for this user. Continue?"
      )
    ) {
      return;
    }

    // Payloads for each type of data
    const buPayload = {
      emp_code: empCode,
      bu_codes: selectedBu,
      created_by: user?.emp_id,
      modified_by: user?.emp_id,
    };

    const contractorPayload = {
      emp_code: empCode,
      contractor_ids: selectedContractor,
      created_by: user?.emp_id,
      modified_by: user?.emp_id,
    };

    const deptPayload = {
      emp_code: empCode,
      dept_codes: selectedDept,
      created_by: user?.emp_id,
      modified_by: user?.emp_id,
    };

    const menuPayload = {
      emp_code: empCode,
      menu_ids: selectedMenu,
      created_by: user?.emp_id,
      modified_by: user?.emp_id,
    };

    const locationPayload = {
      emp_code: empCode,
      loc_codes: selectedLocation,
      created_by: user?.emp_id,
      modified_by: user?.emp_id,
    };

    const menuActivityPayload = {
      emp_code: empCode,
      menu_ids: selectedMenuActivity,
      created_by: user?.emp_id,
      modified_by: user?.emp_id,
    };

    try {
      await axios.post("/api/assignRoles/saveAll", { emp_code: empCode, roles: { BU: selectedBu, Contractor: selectedContractor, Dept: selectedDept, Menu: selectedMenu, MenuActivity: selectedMenuActivity, Location: selectedLocation } });
      alert("Local assignments saved, including empty selections.");
      if (onSubmit) onSubmit();
    } catch (error) { alert(error.response?.data?.message || "Could not save local assignments."); }
  };

  // Handle cancel button click
  const handleCancel = () => {
    navigate("/dashboard"); // Adjust the path as necessary
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Assign Roles</h2>
      {loadError && (
        <div role="alert" style={{ color: "#b00020", marginBottom: "8px" }}>
          {loadError}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* User Code and Copy Roles from Another Employee in a Single Line */}
        <div className={styles.inlineGroup}>
          <label>User Code:</label>
          <input
            type="text"
            value={empCode}
            onChange={(e) => {
              if (e.target.value !== empCode) clearSelections();
              setEmpCode(e.target.value);
            }}
            required
          />
          <button
            type="button"
            className={styles.button}
            onClick={handleShowRoles}
          >
            Show Roles
          </button>

          <label htmlFor="copyEmpCode">Copy Roles from User:</label>
          <input
            id="copyEmpCode"
            type="text"
            placeholder="Enter Employee Code"
            onChange={(e) => setCopyEmpCode(e.target.value)} // Store the entered employee code in state
            className={styles.input}
          />
          <button
            type="button"
            className={styles.button}
            onClick={handleCopyRoles}
          >
            Copy Roles
          </button>
        </div>

        {/* First Row: Business Unit and Contractor */}
        <div className={styles.parallelSection}>
          {/* Business Unit Section */}
          <div className={styles.section}>
            <h3>Business Unit (BU)</h3>
            <div className={styles.listContainer}>
              <div className={styles.listBoxWrapper}>
                <div>
                  <h4>Roles Available</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedBuCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {bu.map((item) => (
                      <option key={item.bu_code} value={item.bu_code}>
                        {item.bu_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.arrowButtons}>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        bu,
                        setBu,
                        selectedBu,
                        setSelectedBu,
                        selectedBuCodes,
                        "bu_code"
                      );
                      setSelectedBuCodes([]);
                    }}
                    disabled={selectedBuCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &gt;&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        selectedBu,
                        setSelectedBu,
                        bu,
                        setBu,
                        selectedBuCodes,
                        "bu_code"
                      );
                      setSelectedBuCodes([]);
                    }}
                    disabled={selectedBuCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &lt;&lt;
                  </button>
                </div>
                <div>
                  <h4>Roles Assigned</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedBuCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {selectedBu.map((item) => (
                      <option key={item.bu_code} value={item.bu_code}>
                        {item.bu_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Contractor Section */}
          <div className={styles.section}>
            <h3>Contractor</h3>
            <div className={styles.listContainer}>
              <div className={styles.listBoxWrapper}>
                <div>
                  <h4>Contractors Available</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedContractorCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {contractor.map((item) => (
                      <option
                        key={item.contractor_code}
                        value={item.contractor_code}
                      >
                        {item.contractor_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.arrowButtons}>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        contractor,
                        setContractor,
                        selectedContractor,
                        setSelectedContractor,
                        selectedContractorCodes,
                        "contractor_code"
                      );
                      setSelectedContractorCodes([]);
                    }}
                    disabled={selectedContractorCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &gt;&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        selectedContractor,
                        setSelectedContractor,
                        contractor,
                        setContractor,
                        selectedContractorCodes,
                        "contractor_code"
                      );
                      setSelectedContractorCodes([]);
                    }}
                    disabled={selectedContractorCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &lt;&lt;
                  </button>
                </div>
                <div>
                  <h4>Contractors Assigned</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedContractorCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {selectedContractor.map((item) => (
                      <option
                        key={item.contractor_code}
                        value={item.contractor_code}
                      >
                        {item.contractor_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row: Department and Menu */}
        <div className={styles.parallelSection}>
          {/* Department Section */}
          <div className={styles.section}>
            <h3>Department</h3>
            <div className={styles.listContainer}>
              <div className={styles.listBoxWrapper}>
                <div>
                  <h4>Departments Available</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedDeptCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {dept.map((item) => (
                      <option key={item.dept_code} value={item.dept_code}>
                        {item.dept_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.arrowButtons}>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        dept,
                        setDept,
                        selectedDept,
                        setSelectedDept,
                        selectedDeptCodes,
                        "dept_code"
                      );
                      setSelectedDeptCodes([]);
                    }}
                    disabled={selectedDeptCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &gt;&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        selectedDept,
                        setSelectedDept,
                        dept,
                        setDept,
                        selectedDeptCodes,
                        "dept_code"
                      );
                      setSelectedDeptCodes([]);
                    }}
                    disabled={selectedDeptCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &lt;&lt;
                  </button>
                </div>
                <div>
                  <h4>Departments Assigned</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedDeptCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {selectedDept.map((item) => (
                      <option key={item.dept_code} value={item.dept_code}>
                        {item.dept_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Section */}
          <div className={styles.section}>
            <h3>Menu</h3>
            <div className={styles.listContainer}>
              <div className={styles.listBoxWrapper}>
                <div>
                  <h4>Menus Available</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedMenuCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {menu.map((item) => (
                      <option key={item.menu_id} value={item.menu_id}>
                        {item.menu_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.arrowButtons}>
                  <button
                    type="button"
                    onClick={() => {
                      console.log("menu", selectedMenu, selectedMenuCodes);
                      moveItems(
                        menu,
                        setMenu,
                        selectedMenu,
                        setSelectedMenu,
                        selectedMenuCodes,
                        "menu_id"
                      );
                      setSelectedMenuCodes([]);
                    }}
                    disabled={selectedMenuCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &gt;&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        selectedMenu,
                        setSelectedMenu,
                        menu,
                        setMenu,
                        selectedMenuCodes,
                        "menu_id"
                      );
                      setSelectedMenuCodes([]);
                    }}
                    disabled={selectedMenuCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &lt;&lt;
                  </button>
                </div>
                <div>
                  <h4>Menus Assigned</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedMenuCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {selectedMenu.map((item) => (
                      <option key={item.menu_id} value={item.menu_id}>
                        {item.menu_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Third Row: MenuActivity */}
        <div className={styles.parallelSection}>
          {/* Menu Section */}
          <div className={styles.section}>
            <h3>Menu---Activities</h3>
            <div className={styles.listContainer}>
              <div className={styles.listBoxWrapper}>
                <div>
                  <h4>Activities Available</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedMenuActivityCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {menuActivity.map((item) => (
                      <option key={item.menu_id} value={item.menu_id}>
                        {item.menu_name || item.activity_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.arrowButtons}>
                  <button
                    type="button"
                    onClick={() => {
                      console.log(
                        "menu",
                        selectedMenuActivity,
                        selectedMenuActivityCodes
                      );
                      moveItems(
                        menuActivity,
                        setMenuActivity,
                        selectedMenuActivity,
                        setSelectedMenuActivity,
                        selectedMenuActivityCodes,
                        "menu_id"
                      );
                      setSelectedMenuActivityCodes([]);
                    }}
                    disabled={selectedMenuActivityCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &gt;&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        selectedMenuActivity,
                        setSelectedMenuActivity,
                        menuActivity,
                        setMenuActivity,
                        selectedMenuActivityCodes,
                        "menu_id"
                      );
                      setSelectedMenuActivityCodes([]);
                    }}
                    disabled={selectedMenuActivityCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &lt;&lt;
                  </button>
                </div>
                <div>
                  <h4>Activities=Assigned</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedMenuActivityCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {selectedMenuActivity.map((item) => (
                      <option key={item.menu_id} value={item.menu_id}>
                        {item.menu_name || item.activity_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Loction Section */}
          <div className={styles.section}>
            <h3>Locations</h3>
            <div className={styles.listContainer}>
              <div className={styles.listBoxWrapper}>
                <div>
                  <h4>Locations Available</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedLocCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {location.map((item) => (
                      <option key={item.loc_code} value={item.loc_code}>
                        {item.loc_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.arrowButtons}>
                  <button
                    type="button"
                    onClick={() => {
                      console.log(
                        "location",
                        selectedLocation,
                        selectedLocCodes
                      );
                      moveItems(
                        location,
                        setLocation,
                        selectedLocation,
                        setSelectedLocation,
                        selectedLocCodes,
                        "loc_code"
                      );
                      setSelectedLocCodes([]);
                    }}
                    disabled={selectedLocCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &gt;&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      moveItems(
                        selectedLocation,
                        setSelectedLocation,
                        location,
                        setLocation,
                        selectedLocCodes,
                        "loc_code"
                      );
                      setSelectedLocCodes([]);
                    }}
                    disabled={selectedLocCodes.length === 0} // Ensure button is disabled if no item is selected
                  >
                    &lt;&lt;
                  </button>
                </div>
                <div>
                  <h4>Locations Assigned</h4>
                  <select
                    multiple
                    className={styles.listBox}
                    onChange={(e) =>
                      setSelectedLocCodes(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {selectedLocation.map((item) => (
                      <option key={item.loc_code} value={item.loc_code}>
                        {item.loc_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className={styles.buttonContainer}>
          <button type="submit" className={styles.button}>
            Submit
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssignRoles;
