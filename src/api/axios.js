import axios from "axios";
import { licenseBus } from "../utils/licenseBus";

// All recovered screens share this same-origin client. Vite forwards /api
// exclusively to the local sample server; there is no production fallback.
const api = axios.create({ baseURL: "", timeout: 30000 });

api.interceptors.request.use((config) => {
  const target = new URL(config.url || "", window.location.origin);
  if (target.origin !== window.location.origin || !target.pathname.startsWith("/api/")) {
    return Promise.reject(new Error("The development replica only permits local /api requests."));
  }
  config.baseURL = window.location.origin;
  config.url = target.pathname + target.search;
  try {
    const savedUser = JSON.parse(localStorage.getItem("user") || "null");
    if (savedUser?.sessionAuth === 'cookie') {
      delete config.headers.Authorization;
      if (savedUser.csrfToken) config.headers['X-CSRF-Token'] = savedUser.csrfToken;
    } else if (savedUser?.token) config.headers.Authorization = `Bearer ${savedUser.token}`;
  } catch {
    localStorage.removeItem("user");
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    // Demo server restarts invalidate its in-memory tokens. Re-enter the demo
    // workspace instead of retaining a browser session that can no longer save.
    if (error.response?.status === 401 && !error.config?.url?.endsWith("/api/users/login")) {
      localStorage.removeItem("user");
      window.location.assign("/login");
    }
    if (data?.code === "LICENSE_EXPIRED" || data?.message === "LICENSE_EXPIRED") {
      licenseBus.emit({
        code: "LICENSE_EXPIRED",
        message: "Application license has expired. Please contact administrator.",
      });
    }
    return Promise.reject(error);
  }
);

export default api;
