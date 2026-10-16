import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Row, Col, Button, Container } from "react-bootstrap";
import axios from "../../api/axios.js";
import { selectUser } from "../../features/userSlice"; // Adjust based on your Redux setup
import "./Dashboard.css"; // Custom CSS for the dashboard

const Dashboard = () => {
  const [menuOptions, setMenuOptions] = useState([]);
  const user = useSelector(selectUser); // Get user info from Redux
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();

  useEffect(() => {
    if (token && emp_id) {
      const fetchMenuOptions = async () => {
        try {
          const menuResponse = await axios.post("/api/menu/getMenuUserData", { emp_id });
          
          // Filter and organize the menu options
          const parentMenus = menuResponse.data.filter(menu => menu.parent_menu_id === 0);
          const childMenus = menuResponse.data.filter(menu => menu.parent_menu_id !== 0);

          const groupedMenuOptions = parentMenus.map(parent => ({
            ...parent,
            children: childMenus.filter(child => child.parent_menu_id === parent.menu_id)
          }));
          
          setMenuOptions(groupedMenuOptions); // Store the organized menu
        } catch (error) {
          console.log("Error fetching menu options:", error);
        }
      };

      fetchMenuOptions();
    } else {
      navigate("/login"); // Redirect to login if not authenticated
    }
  }, [token, emp_id, navigate]);

  const handleTileClick = (menuUrl) => {
    if (menuUrl) {
      console.log("Navigating to:", menuUrl);
      navigate(menuUrl);
    } else {
      console.error("No URL for this menu item.");
    }
  };

  return (
    <div className="dashboard-container">
      <Container fluid> {/* Changed to fluid to utilize more space */}
        <h1 className="dashboard-title">Welcome to Your CLMS</h1> {/* Updated title */}
        
        {/* Loop through each parent menu */}
        {menuOptions.map((parentMenu, index) => (
          parentMenu.menu_url ? (
            <Row key={index} className="mb-3">
              <Col xs={6} sm={4} md={3} lg={2}> {/* Adjusted column size */}
                <Button
                  variant="outline-primary"
                  className="menu-tile-btn w-100"
                  onClick={() => handleTileClick(parentMenu.menu_url)} // Handle tile click
                  style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}
                >
                  {parentMenu.menu_name}
                </Button>
              </Col>
            </Row>
          ) : (
            <div key={index} className="menu-section">
              <h2 className="section-title">{parentMenu.menu_name}</h2>
              <Row>
                {parentMenu.children.map((childMenu, childIndex) => (
                  <Col key={childIndex} xs={6} sm={4} md={3} lg={2} className="mb-3"> {/* Adjusted column size */}
                    <Button
                      variant="outline-primary"
                      className="menu-tile-btn w-100"
                      onClick={() => handleTileClick(childMenu.menu_url)} // Handle child tile click
                      //style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}
                    >
                      {childMenu.menu_name}
                    </Button>
                  </Col>
                ))}
              </Row>
            </div>
          )
        ))}
      </Container>
    </div>
  );
};

export default Dashboard;
