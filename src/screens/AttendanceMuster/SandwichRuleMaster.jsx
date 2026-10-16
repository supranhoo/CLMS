import React, { useState, useEffect } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import axios from "../../api/axios.js";
import styles from "./SandwichRuleMaster.module.css";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";

const SandwichRuleMaster = () => {
  const [rules, setRules] = useState([]);
  const [punchMarks, setPunchMarks] = useState([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;

  const [newRule, setNewRule] = useState({
    present_pattern: "",
    converted_pattern: "",
  });

  /* ============================
     Fetch Rules
  ============================ */
  const fetchRules = async () => {
    try {
      const res = await axios.post("/api/attendance/getSandwichRules");
      setRules(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Error fetching sandwich rules");
    }
  };

  /* ============================
     Fetch Punch Marks
  ============================ */
  const fetchPunchMarks = async () => {
    try {
      const res = await axios.post("/api/attendance/getPunchMarks");
      setPunchMarks(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Error fetching punch marks");
    }
  };

  useEffect(() => {
    fetchRules();
    fetchPunchMarks();
  }, []);

  /* ============================
     Validation
  ============================ */
  const validatePattern = (pattern) => {
    if (!pattern) return false;

    const tokens = pattern.split("-").filter((t) => t !== "");
    const validMarks = punchMarks.map((pm) => pm.punch_mark);

    return tokens.length >= 2 && tokens.every((t) => validMarks.includes(t));
  };

  const isPatternComplete = (pattern) => {
    if (!pattern) return false;
    const tokens = pattern.split("-").filter((t) => t !== "");
    return tokens.length >= 2;
  };

  /* ============================
     Pattern Builder (FIXED)
  ============================ */
  const renderPatternBuilder = (pattern, setPattern) => {
    // 🔥 FIX: ensure at least one dropdown
    const tokens = pattern === "" ? [""] : pattern ? pattern.split("-") : [];

    const updateToken = (index, value) => {
      const updated = [...tokens];
      updated[index] = value;
      setPattern(updated.join("-"));
    };

    const addToken = () => {
      if (!pattern) {
        setPattern(""); // first token
      } else {
        setPattern(pattern + "-");
      }
    };

    const removeToken = (index) => {
      const updated = tokens.filter((_, i) => i !== index);
      setPattern(updated.join("-"));
    };

    return (
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {tokens.map((token, index) => (
          <div
            key={index}
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <Form.Select
              value={token}
              onChange={(e) => updateToken(index, e.target.value)}
              className={styles["small-input"]}
              style={{
                border: token === "" ? "1px solid red" : "",
              }}
            >
              <option value="">Select</option>
              {punchMarks.map((pm) => (
                <option key={pm.punch_mark} value={pm.punch_mark}>
                  {pm.punch_mark}
                </option>
              ))}
            </Form.Select>

            <Button
              size="sm"
              variant="danger"
              onClick={() => removeToken(index)}
            >
              ✕
            </Button>

            {index < tokens.length - 1 && <span>-</span>}
          </div>
        ))}

        <Button size="sm" variant="secondary" onClick={addToken}>
          + Add
        </Button>
      </div>
    );
  };

  /* ============================
     Add Rule
  ============================ */
  const handleAdd = async () => {
    try {
      setError("");

      if (
        !validatePattern(newRule.present_pattern) ||
        !validatePattern(newRule.converted_pattern)
      ) {
        setError("Invalid pattern. Please select valid punch marks.");
        return;
      }

      await axios.post("/api/attendance/addSandwichRule", {
        ...newRule,
        created_by: emp_id,
      });

      setSuccessMessage("Rule added successfully");
      setNewRule({ present_pattern: "", converted_pattern: "" });

      fetchRules();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Error adding rule");
    }
  };

  /* ============================
     Update Rule
  ============================ */
  const handleUpdate = async (rule) => {
    try {
      if (
        !validatePattern(rule.present_pattern) ||
        !validatePattern(rule.converted_pattern)
      ) {
        setError("Invalid pattern.");
        return;
      }

      await axios.post("/api/attendance/updateSandwichRule", {
        ...rule,
        modified_by: emp_id,
      });

      setSuccessMessage("Updated successfully");
      fetchRules();
    } catch (err) {
      console.error(err);
      setError("Error updating rule");
    }
  };

  /* ============================
     Delete Rule
  ============================ */
  const handleDelete = async (rule) => {
    try {
      await axios.post("/api/attendance/deleteSandwichRule", {
        rule_id: rule.rule_id,
        modified_by: emp_id,
      });

      setSuccessMessage("Deleted successfully");
      fetchRules();
    } catch (err) {
      console.error(err);
      setError("Error deleting rule");
    }
  };

  /* ============================
     Handle Change
  ============================ */
  const handleChange = (e, rule) => {
    const { name, value } = e.target;

    const updated = rules.map((r) =>
      r.rule_id === rule.rule_id ? { ...r, [name]: value } : r,
    );

    setRules(updated);
  };

  return (
    <div className={styles["regularize-punch-grid-container"]}>
      <h3>Sandwich Rule Master</h3>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Table bordered className={styles["compact-grid"]}>
        <thead>
          <tr>
            <th>Present Pattern</th>
            <th>Converted Pattern</th>
            <th>Token Count</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rules.length > 0 ? (
            rules.map((rule) => (
              <tr key={rule.rule_id}>
                <td>
                  {renderPatternBuilder(rule.present_pattern, (val) =>
                    handleChange(
                      { target: { name: "present_pattern", value: val } },
                      rule,
                    ),
                  )}
                </td>

                <td>
                  {renderPatternBuilder(rule.converted_pattern, (val) =>
                    handleChange(
                      { target: { name: "converted_pattern", value: val } },
                      rule,
                    ),
                  )}
                </td>

                <td>{rule.token_count}</td>

                <td>
                  <Form.Check
                    type="checkbox"
                    checked={rule.is_active === "Y"}
                    onChange={() =>
                      handleChange(
                        {
                          target: {
                            name: "is_active",
                            value: rule.is_active === "Y" ? "N" : "Y",
                          },
                        },
                        rule,
                      )
                    }
                  />
                </td>

                <td>
                  <Button size="sm" onClick={() => handleUpdate(rule)}>
                    Save
                  </Button>{" "}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(rule)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5">No rules found</td>
            </tr>
          )}

          {/* Add Row */}
          <tr>
            <td>
              {renderPatternBuilder(newRule.present_pattern, (val) =>
                setNewRule({ ...newRule, present_pattern: val }),
              )}
            </td>

            <td>
              {renderPatternBuilder(newRule.converted_pattern, (val) =>
                setNewRule({ ...newRule, converted_pattern: val }),
              )}
            </td>

            <td>-</td>
            <td>-</td>

            <td>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={
                  !isPatternComplete(newRule.present_pattern) ||
                  !isPatternComplete(newRule.converted_pattern)
                }
              >
                Add
              </Button>
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};

export default SandwichRuleMaster;
