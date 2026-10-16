# Design-system measurements (W0/U03, gate A04)

Measured from the rendered reference page `/development/design-system` against http://127.0.0.1:5173. Regenerate with `node docs/ui-redesign/w0/design-system-check.mjs`.

**Result: all requirements met** — 41 controls/badges measured, 18 state-parity comparisons, 9 live token pairings.

## Mirrored demo states vs real interaction

| Comparison | Result |
| --- | --- |
| button-primary focus | identical |
| button-secondary focus | identical |
| button-danger focus | identical |
| button-outline-primary focus | identical |
| field focus | identical |
| button-primary hover | identical |
| button-secondary hover | identical |
| button-danger hover | identical |
| button-outline-primary hover | identical |
| field hover | identical |
| button-primary active | identical |
| button-secondary active | identical |
| button-danger active | identical |
| button-outline-primary active | identical |
| button-primary focus+hover | identical |
| button-secondary focus+hover | identical |
| button-danger focus+hover | identical |
| button-outline-primary focus+hover | identical |

## Rendered controls

| Element | Size | Text contrast | Boundary / focus | Target aim |
| --- | --- | --- | --- | --- |
| `button-primary:default` | 87x40 | 6.7:1 | — | 40+ |
| `button-primary:hover` | 87x40 | 8.72:1 | — | 40+ |
| `button-primary:focus` | 87x40 | 6.7:1 | 2px solid, 6.7:1 | 40+ |
| `button-primary:active` | 87x40 | 10.36:1 | — | 40+ |
| `button-primary:disabled` | 87x40 | 3.86 (disabled, exempt) | — | 40+ |
| `button-primary:busy` | 104.1x40 | 6.7:1 | — | 40+ |
| `button-secondary:default` | 107.4x40 | 12.19:1 | — | 40+ |
| `button-secondary:hover` | 107.4x40 | 11.37:1 | — | 40+ |
| `button-secondary:focus` | 107.4x40 | 12.19:1 | 2px solid, 6.7:1 | 40+ |
| `button-secondary:active` | 107.4x40 | 9.89:1 | — | 40+ |
| `button-secondary:disabled` | 107.4x40 | 3.86 (disabled, exempt) | — | 40+ |
| `button-secondary:busy` | 104.1x40 | 12.19:1 | — | 40+ |
| `button-danger:default` | 83.3x40 | 6.47:1 | — | 40+ |
| `button-danger:hover` | 83.3x40 | 8.31:1 | — | 40+ |
| `button-danger:focus` | 83.3x40 | 6.47:1 | 2px solid, 6.7:1 | 40+ |
| `button-danger:active` | 83.3x40 | 8.31:1 | — | 40+ |
| `button-danger:disabled` | 83.3x40 | 3.86 (disabled, exempt) | — | 40+ |
| `button-danger:busy` | 104.1x40 | 6.47:1 | — | 40+ |
| `button-outline-primary:default` | 82.5x40 | 6.7:1 | — | 40+ |
| `button-outline-primary:hover` | 82.5x40 | 8.72:1 | — | 40+ |
| `button-outline-primary:focus` | 82.5x40 | 6.7:1 | 2px solid, 6.7:1 | 40+ |
| `button-outline-primary:active` | 82.5x40 | 10.36:1 | — | 40+ |
| `button-outline-primary:disabled` | 82.5x40 | 4.76 (disabled, exempt) | — | 40+ |
| `button-outline-primary:busy` | 104.1x40 | 6.7:1 | — | 40+ |
| `field:default` | 247.5x40 | 14.1:1 | 4.76:1 | 40+ |
| `field:hover` | 247.5x40 | 14.1:1 | 7.58:1 | 40+ |
| `field:focus` | 247.5x40 | 14.1:1 | 6.7:1 | 40+ |
| `field:disabled` | 247.5x40 | 3.86 (disabled, exempt) | 1.48:1 | 40+ |
| `field:readonly` | 247.5x40 | 13.48:1 | 4.76:1 | 40+ |
| `field:invalid` | 247.5x40 | 14.1:1 | 6.47:1 | 40+ |
| `select:default` | 247.5x40 | 14.1:1 | 4.76:1 | 40+ |
| `select:disabled` | 247.5x40 | 3.86 (disabled, exempt) | 1.48:1 | 40+ |
| `status:success:Active` | 57.9x24.2 | 6.49:1 | — | n/a |
| `status:neutral:Inactive` | 67.7x24.2 | 8.4:1 | — | n/a |
| `status:warning:Pending` | 69.5x24.2 | 6.38:1 | — | n/a |
| `status:success:Approved` | 79.4x24.2 | 6.49:1 | — | n/a |
| `status:danger:Rejected` | 72.9x24.2 | 6.8:1 | — | n/a |
| `status:draft:Draft` | 49x24.2 | 6.92:1 | — | n/a |
| `status:locked:Locked` | 63.8x24.2 | 8.23:1 | — | n/a |
| `status:needs-rules:Needs rules` | 93.1x24.2 | 8.18:1 | — | n/a |
| `status:local-only:Local only` | 82.1x24.2 | 9.23:1 | — | n/a |

## Failures

None.
