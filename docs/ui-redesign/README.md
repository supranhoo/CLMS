# Review the CLMS UI redesign

The user selected **Modern BFCL workspace** on 16 October 2026. This folder contains the complete planning package plus the first implemented UI wave. The current feature branch implements the shared shell and dashboard only; it does not change production/local business records.

## Current implementation status

- **W1 shell and dashboard:** implemented on `ui/modern-bfcl-shell-dashboard` for review. The new shell uses the existing permission-filtered menu API, adds screen search, responsive drawer semantics, account actions, public-shell separation and a task-oriented dashboard.
- **W2–W6 route migration:** pending. Existing screen implementations remain inside the new shell and still require the planned family-by-family redesign.
- **Business behavior:** unchanged. The application remains an isolated local replica with synthetic data and rules-gated payroll/statutory behavior.

1. Read [UI_REDESIGN_PLAN.md](UI_REDESIGN_PLAN.md) for the proposed experience, complete scope, work packages, dependencies and estimated effort.
2. Open [design-preview.html](design-preview.html) for an interactive visual direction. It is an illustrative standalone proposal with synthetic data, no API calls and no application writes.
3. Use [route-inventory.csv](route-inventory.csv) when implementing: all73 declarations,66 routed screens and their migration waves are included. [route-audit.md](route-audit.md) explains the82 named static/configuration cases and current navigation gaps.
4. Use [acceptance-checklist.md](acceptance-checklist.md) for implementation verification. The first-wave evidence is recorded there; the remaining route-family gates are still pending.

[Browser audit](browser-audit.md), [style/component audit](style-and-component-audit.md) and [workflow requirements](workflow-requirements.md) provide current-state evidence and detailed screen requirements. The master plan's W0–W6 sequence governs the delivery; lower priority findings in audits do not remove current screens from scope.

Begin implementation with CSS containment, tokens and the app shell, then prove four reference screen types before converting the remaining families. The whole redesign is complete only after all routes, states, field/action parity and release gates pass.
