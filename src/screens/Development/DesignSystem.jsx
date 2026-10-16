import React, { useEffect, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import styles from "./DesignSystem.module.css";
import { contrastRatio, WCAG_NON_TEXT_AA, WCAG_TEXT_AA } from "../../utils/contrast";

// Development-only reference for the UI redesign tokens and component states (W0/U03, gate A04).
// Illustrative only: no API calls, no writes. `data-ds` attributes are read by
// docs/ui-redesign/w0/design-system-check.mjs, which measures contrast and target size from the rendered DOM.

const SWATCHES = [
  ["Brand", ["--ui-navy", "--ui-action", "--ui-action-hover", "--ui-action-active", "--ui-danger", "--ui-danger-hover"]],
  ["Surfaces", ["--ui-canvas", "--ui-panel", "--ui-subtle", "--ui-readonly-bg", "--ui-disabled-bg"]],
  ["Text", ["--ui-text-strong", "--ui-text", "--ui-text-muted", "--ui-disabled-text"]],
  ["Borders", ["--ui-border", "--ui-border-subtle", "--ui-border-control", "--ui-border-control-hover"]],
];

// [label, foreground token, background token, minimum ratio]. Text pairs need 4.5:1; control boundaries 3:1.
const PAIRS = [
  ["Strong text on panel", "--ui-text-strong", "--ui-panel", WCAG_TEXT_AA],
  ["Body text on canvas", "--ui-text", "--ui-canvas", WCAG_TEXT_AA],
  ["Muted text on canvas", "--ui-text-muted", "--ui-canvas", WCAG_TEXT_AA],
  ["Action text on panel", "--ui-action", "--ui-panel", WCAG_TEXT_AA],
  ["Label on primary button", "--ui-on-action", "--ui-action", WCAG_TEXT_AA],
  ["Label on danger button", "--ui-on-danger", "--ui-danger", WCAG_TEXT_AA],
  ["Control border on panel", "--ui-border-control", "--ui-panel", WCAG_NON_TEXT_AA],
  ["Focus ring on canvas", "--ui-focus", "--ui-canvas", WCAG_NON_TEXT_AA],
  ["Decorative divider on panel (not a control boundary)", "--ui-border", "--ui-panel", 0],
];

const BUTTON_VARIANTS = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["danger", "Danger"],
  ["outline-primary", "Outline"],
];
const BUTTON_STATES = [
  ["default", "Default", ""],
  ["hover", "Hover", "is-hover"],
  ["focus", "Focus", "is-focus"],
  ["active", "Active", "is-active"],
  ["disabled", "Disabled", ""],
  ["busy", "Busy", ""],
];

const TARGETS = [["--ui-target-min", "Minimum (AA)"], ["--ui-control-h-compact", "Compact"], ["--ui-control-h", "Default"], ["--ui-target-touch", "Touch aim"]];

// Active and Approved share a colour on purpose: the label, not the colour, distinguishes them.
const STATUSES = [
  ["Active", "success"], ["Inactive", "neutral"], ["Pending", "warning"], ["Approved", "success"], ["Rejected", "danger"],
  ["Draft", "draft"], ["Locked", "locked"], ["Needs rules", "needs-rules"], ["Local only", "local-only"],
];

function tokenValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function StateButton({ variant, state, children }) {
  const mirror = BUTTON_STATES.find(([key]) => key === state)[2];
  const busy = state === "busy";
  return (
    <Button
      variant={variant}
      className={mirror}
      disabled={state === "disabled"}
      aria-busy={busy ? "true" : undefined}
      data-ds={`button-${variant}:${state}`}
    >
      {busy && <Spinner animation="border" size="sm" aria-hidden="true" />}
      {children}
    </Button>
  );
}

export default function DesignSystem() {
  const [tokens, setTokens] = useState({});

  useEffect(() => {
    const names = [...SWATCHES.flatMap(([, list]) => list), ...PAIRS.flatMap(([, a, b]) => [a, b]), ...TARGETS.map(([name]) => name)];
    setTokens(Object.fromEntries([...new Set(names)].map((name) => [name, tokenValue(name)])));
  }, []);

  return (
    <div className={`bfcl-ui ${styles.page}`}>
      <h1>Design system reference</h1>
      <p className={styles.lede}>
        Tokens and component states for the Modern BFCL workspace redesign. This page is a development reference for
        wave W0: it uses illustrative values, makes no API calls and writes nothing. Component theming applies only
        inside the <code>.bfcl-ui</code> scope, so existing screens are unchanged until they adopt it.
      </p>
      <Alert variant="info" className="mb-0">
        The palette is the plan's proposed direction, not an approved BFCL brand manual. Contrast ratios below are
        computed live from the loaded tokens.
      </Alert>

      <section className={styles.section} aria-labelledby="ds-colour">
        <h2 id="ds-colour">Colour tokens</h2>
        <p className={styles.note}>Values are read from the stylesheet at runtime, not copied into this page.</p>
        {SWATCHES.map(([group, names]) => (
          <div key={group} className="mb-3">
            <h3 className="h6">{group}</h3>
            <div className={styles.swatches}>
              {names.map((name) => (
                <div key={name} className={styles.swatch}>
                  <span className={styles.chip} style={{ background: `var(${name})` }} aria-hidden="true" />
                  <span className={styles.swatchText}>
                    <code>{name}</code>
                    <br />
                    {tokens[name] || "…"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="ds-contrast">
        <h2 id="ds-contrast">Contrast of key pairings</h2>
        <p className={styles.note}>
          Text needs 4.5:1; control boundaries and focus indicators need 3:1. The decorative divider is intentionally
          below 3:1 and is never used as the only boundary of a control.
        </p>
        <div className={styles.scroll}>
          <table className={`${styles.matrix} ${styles.pairs}`}>
            <caption className="visually-hidden">Foreground and background token pairs with measured contrast</caption>
            <thead>
              <tr><th scope="col">Pairing</th><th scope="col">Sample</th><th scope="col">Ratio</th><th scope="col">Requirement</th><th scope="col">Result</th></tr>
            </thead>
            <tbody>
              {PAIRS.map(([label, fg, bg, min]) => {
                const ready = tokens[fg] && tokens[bg];
                const ratio = ready ? contrastRatio(tokens[fg], tokens[bg]) : null;
                const ok = ratio !== null && ratio >= min;
                return (
                  <tr key={label} data-ds={`pair:${fg}/${bg}`}>
                    <th scope="row">{label}</th>
                    <td>
                      <span className={styles.sample} style={{ color: `var(${fg})`, background: `var(${bg})`, border: "1px solid var(--ui-border-subtle)" }}>Aa 123</span>
                    </td>
                    <td>{ratio === null ? "…" : `${ratio.toFixed(2)}:1`}</td>
                    <td>{min ? `${min}:1` : "informational"}</td>
                    <td className={min ? (ok ? styles.pass : styles.fail) : undefined}>{min ? (ok ? "Pass" : "Fail") : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-buttons">
        <h2 id="ds-buttons">Buttons</h2>
        <p className={styles.note}>
          Hover, focus and active are shown with mirrored classes; design-system-check.mjs verifies they compute the
          same as real pointer and keyboard interaction. Disabled controls are exempt from contrast rules but stay
          legible. Busy keeps focus and announces <code>aria-busy</code>.
        </p>
        <div className={styles.scroll}>
          <table className={styles.matrix}>
            <caption className="visually-hidden">Button variants by interaction state</caption>
            <thead>
              <tr>
                <th scope="col">Variant</th>
                {BUTTON_STATES.map(([key, label]) => <th key={key} scope="col">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {BUTTON_VARIANTS.map(([variant, label]) => (
                <tr key={variant}>
                  <th scope="row">{label}</th>
                  {BUTTON_STATES.map(([state]) => (
                    <td key={state}>
                      <StateButton variant={variant} state={state}>{state === "busy" ? "Saving" : label}</StateButton>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-fields">
        <h2 id="ds-fields">Fields</h2>
        <p className={styles.note}>
          Read-only stays focusable with a dashed boundary; disabled is visibly inert. The invalid field links its
          message with <code>aria-describedby</code>.
        </p>
        <div className={styles.fieldGrid}>
          {[
            ["default", "Default", {}],
            ["hover", "Hover", { className: "is-hover" }],
            ["focus", "Focus", { className: "is-focus" }],
            ["disabled", "Disabled", { disabled: true }],
            ["readonly", "Read-only", { readOnly: true }],
            ["invalid", "Invalid", { className: "is-invalid", "aria-invalid": "true", "aria-describedby": "ds-invalid-msg" }],
          ].map(([key, label, props]) => (
            <Form.Group key={key} controlId={`ds-field-${key}`}>
              <Form.Label>{label}</Form.Label>
              <Form.Control type="text" defaultValue={key === "default" ? "" : "DEMO001"} placeholder="Employee code" data-ds={`field:${key}`} {...props} />
              {key === "invalid" ? (
                <Form.Control.Feedback type="invalid" id="ds-invalid-msg">Employee code already exists.</Form.Control.Feedback>
              ) : (
                <Form.Text>{key === "readonly" ? "Value is set by the system." : "Helper text uses the muted token."}</Form.Text>
              )}
            </Form.Group>
          ))}
          <Form.Group controlId="ds-select-default">
            <Form.Label>Select</Form.Label>
            <Form.Select data-ds="select:default" defaultValue="">
              <option value="">Choose a contractor</option>
              <option value="D01">Demo Fabrication Services</option>
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="ds-select-disabled">
            <Form.Label>Select (disabled)</Form.Label>
            <Form.Select data-ds="select:disabled" disabled defaultValue="">
              <option value="">Choose a contractor</option>
            </Form.Select>
          </Form.Group>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-status">
        <h2 id="ds-status">Status badges</h2>
        <p className={styles.note}>
          Each business state has its own label. Colour and border style only reinforce it: draft is dashed, and Active
          and Approved share a colour but never a label.
        </p>
        <div className={styles.statuses}>
          {STATUSES.map(([label, tone]) => (
            <span key={label} className={`ui-status ui-status--${tone}`} data-ds={`status:${tone}:${label}`}>{label}</span>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ds-targets">
        <h2 id="ds-targets">Control and target sizes</h2>
        <p className={styles.note}>
          WCAG 2.2 AA requires at least 24 × 24 CSS px. The redesign aims for 40 px controls and 44 px touch targets.
        </p>
        <div className={styles.targets}>
          {TARGETS.map(([name, label]) => (
            <div key={name} className={styles.targetBox}>
              <span className={styles.ruler} data-ds={`target:${name}`} style={{ width: `var(${name})`, height: `var(${name})` }} />
              <span>{label}: {tokens[name] || "…"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
