import { createContext, useContext, useEffect, useState } from 'react';

const Runtime = createContext({ mode: 'unknown', demo: false });
export const useRuntime = () => useContext(Runtime);

export default function RuntimeEnvironment({ children }) {
  const [runtime, setRuntime] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => { if (runtime && !runtime.demo) document.title = `CLMS | ${runtime.mode} server`; }, [runtime]);
  useEffect(() => {
    let active = true;
    fetch('/api/runtime', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(value => {
      if (!['demo', 'staging', 'production'].includes(value.mode) || value.demo !== (value.mode === 'demo')) throw new Error();
      if (active) setRuntime(value);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  if (!runtime) return <main className="p-4"><p role="status">{error ? 'Application configuration could not be loaded. Check the server connection and reload.' : 'Connecting to CLMS…'}</p>{error && <button onClick={() => window.location.reload()}>Reload</button>}</main>;
  return <Runtime.Provider value={runtime}>{children}</Runtime.Provider>;
}
