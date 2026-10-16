# CLMS replica development

Work in this directory for replica features. The parent directory contains the installed application and is outside the development scope.

- This application is a local sandbox. Keep UI and API servers bound to loopback.
- Use the shared client in `src/api/axios.js`; add `/api/...` contracts in `server/`. Do not add a fallback or connection to the production server or database.
- Use fictional sample data only. Do not copy parent `.env`, SQL credentials, logs, licence files, keys, executables, or live employee data.
- Preserve the recovered screen conventions unless the requested feature needs a UI change. Identify simulator behavior clearly, particularly for wages, attendance processing and statutory calculations.
- Unsupported functionality must report that it is unavailable. Do not return a fake successful business operation.
- For changes to data behavior, add meaningful contract tests under `tests/`. Run `npm.cmd test`, `npm.cmd run check` and `npm.cmd run build` as appropriate. Inspect changed UI in the local browser.
- `.local-demo/` contains disposable local sample state and must stay out of version control.

See `README.md`, `DEVELOPMENT.md`, and `VERIFICATION.md` before extending a module.
