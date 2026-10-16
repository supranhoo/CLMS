import Container from "react-bootstrap/Container";
import React, { useState, useEffect } from "react";
import Form from "react-bootstrap/Form";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import { logoutUser } from "../../features/userSlice";
import logo from "../../assets/grouplogo.png"; // Import your logo image
import "./Header.css";
//import axios from "../../api/axios.js";
import api from "../../api/axios";

import { selectUser } from "../../features/userSlice";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FaSignOutAlt, FaKey } from "react-icons/fa"; // Icons for logout and change password

const Header = () => {
  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [menu, setMenu] = useState([]);
  console.log("User:", user);
  const [userName, setUserId] = useState(user?.Name || "");

  const fetchMenuData = async (userName) => {
    let menuData = [];
    try {
      const response = await api.post("/api/menu/getMenuUserData", {
        emp_id,
      }); // Adjust URL as per your backend API
      console.log("menudata response", response);
      let menuData = [];
      menuData = response.data;
      console.log("menudata:", menuData);
      const organizedMenu = organizeMenuData(menuData);
      setMenu(organizedMenu);
    } catch (error) {
      console.log("fetchmenu error:", error);
      let menuData = [];
    }
  };

  useEffect(() => {
    setUserId(user?.Name || "");
  }, []); // Run once on mount

  useEffect(() => {
    const newUserName = user?.Name || "";
    setUserId(user?.Name || "");
    console.log("Useffect:-2", newUserName);
    fetchMenuData(newUserName); // Pass the updated userName directly
  }, [user]); // Run whenever user changes

  const organizeMenuData = (menuData) => {
    const menuMap = {};
    const rootMenu = [];

    menuData.forEach((menuItem) => {
      menuMap[menuItem.menu_id] = { ...menuItem, children: [] };
    });

    menuData.forEach((menuItem) => {
      if (menuItem.parent_menu_id) {
        menuMap[menuItem.parent_menu_id].children.push(
          menuMap[menuItem.menu_id]
        );
      } else {
        rootMenu.push(menuMap[menuItem.menu_id]);
      }
    });

    return rootMenu;
  };

  const logoutHandler = () => {
    dispatch(logoutUser());
    setUserId(""); // Clear username on logout
    setMenu([]); // Clear menu on logout
    navigate("/");
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    setUserId(""); // Clear username on logout
    setMenu([]); // Clear menu on logout
    navigate("/");
  };

  const handleChangePassword = () => {
    // Change password logic
    console.log("Navigating to change password...");
    navigate("/change-password"); // Navigates to the Change Password screen
  };

  const handleMenuClick = (menuItem) => {
    console.log("Menu Click:", menuItem);
    if (menuItem.menu_url) {
      navigate(menuItem.menu_url);
    } else if (menuItem.handler) {
      menuItem.handler();
    } else {
      console.error("A URL or handler is required for this menu item");
    }
  };

  const renderMenu = (menuItems) => {
    return menuItems.map((menuItem) => {
      if (menuItem.children.length > 0) {
        return (
          <NavDropdown
            title={menuItem.menu_name}
            id={`navbarScrollingDropdown-${menuItem.menu_id}`}
            key={menuItem.menu_id}
          >
            {renderMenu(menuItem.children)}
          </NavDropdown>
        );
      } else {
        return (
          <NavDropdown.Item
            key={menuItem.menu_id}
            onClick={() => handleMenuClick(menuItem)}
          >
            {menuItem.menu_name}
          </NavDropdown.Item>
        );
      }
    });
  };

  return (
    <Navbar expand="lg" bg="primary" variant="dark">
      <Container>
        <Nav className="mr-auto">
          <NavDropdown title="Menu" id="navbarScrollingDropdown">
            {renderMenu(menu)}
            <NavDropdown.Divider />
            <NavDropdown.Item onClick={logoutHandler}>Logout</NavDropdown.Item>
          </NavDropdown>
        </Nav>

        <Navbar.Toggle aria-controls="navbarScroll" />
        <Navbar.Collapse id="navbarScroll">
          <Nav className="m-auto">
            <Form>
              <Form.Control
                type="search"
                placeholder="Search"
                className="me-2"
                aria-label="Search"
              />
            </Form>
          </Nav>
        </Navbar.Collapse>

        {user ? (
          <Nav className="mr-2">
            <Nav.Item className="d-flex align-items-center">
              <div className="mr-2">Welcome!</div>
              <div>{userName}</div>
            </Nav.Item>
            <Nav.Item></Nav.Item>
          </Nav>
        ) : (
          <Nav className="mr-auto"></Nav>
        )}

        {/* Icons Section on the Right */}
        <Nav className="ml-auto">
          <Nav.Link onClick={handleChangePassword} className="header-icon">
            <FaKey /> Change Password
          </Nav.Link>
          <Nav.Link onClick={handleLogout} className="header-icon">
            <FaSignOutAlt /> Logout
          </Nav.Link>
        </Nav>

        {/* Logo image click will navigate to the dashboard */}
        <Navbar.Brand className="mr-2" onClick={() => navigate("/dashboard")}>
          <img
            src={logo}
            alt="Logo"
            height="100%"
            style={{ cursor: "pointer" }}
          />
        </Navbar.Brand>
      </Container>
    </Navbar>
  );
};

export default Header;
