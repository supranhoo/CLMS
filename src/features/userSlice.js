import { createSlice, createAsyncThunk, nanoid } from "@reduxjs/toolkit";
//import axios from "../api/axios.js";
import api from "../api/axios";

/* =========================================================
   CONTRACTOR / EMPLOYEE THUNKS (UNCHANGED)
   ========================================================= */

export const registerContractor = createAsyncThunk(
  "contractor/register",
  async (formData, thunkAPI) => {
    try {
      const { data } = await api.post(
        "/api/contractor/addContractor",
        formData,
        { headers: { "Content-type": "application/json" } }
      );
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { message: "Contractor registration failed" }
      );
    }
  }
);

export const getAllContractors = createAsyncThunk(
  "contractor/manage",
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get("/api/contractor/getAllContractors");
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { message: "Failed to load contractors" }
      );
    }
  }
);

export const registerEmployee = createAsyncThunk(
  "employee/register",
  async (formData, thunkAPI) => {
    try {
      const { data } = await api.post("/api/employee/addEmployee", formData, {
        headers: { "Content-type": "application/json" },
      });
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { message: "Employee registration failed" }
      );
    }
  }
);

/* =========================================================
   USER REGISTRATION (UNCHANGED LOGIC, SAFER ERROR)
   ========================================================= */

export const registerUser = createAsyncThunk(
  "user/registerUser",
  async (userCredentials, thunkAPI) => {
    try {
      const { data } = await api.post("/api/users/register", userCredentials, {
        headers: { "Content-type": "application/json" },
      });
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { message: "User registration failed" }
      );
    }
  }
);

/* =========================================================
   🔒 LOGIN USER (IMPORTANT FIX HERE)
   ========================================================= */
export const loginUser = createAsyncThunk(
  "user/loginUser",
  async (userCredentials, thunkAPI) => {
    try {
      const { data } = await api.post("/api/users/login", userCredentials, {
        headers: { "Content-type": "application/json" },
      });

      localStorage.setItem("user", JSON.stringify(data));
      return data;
    } catch (error) {
      // 🔥 THIS IS THE FIX
      return thunkAPI.rejectWithValue(
        error.response?.data || { message: "Login failed" }
      );
    }
  }
);

export const getAllUsers = createAsyncThunk(
  "user/manage",
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get("/api/users/getallusers");
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { message: "Failed to load users" }
      );
    }
  }
);

/* =========================================================
   USER SLICE
   ========================================================= */

const restoreDevelopmentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

export const userSlice = createSlice({
  name: "user",
  initialState: {
    loading: false,
    user: restoreDevelopmentUser(),
    error: null,
  },
  reducers: {
    logoutUser: (state) => {
      state.loading = false;
      state.user = null;
      state.error = null;
      localStorage.clear();
    },
  },
  extraReducers: (builder) => {
    builder

      /* ---------------- LOGIN ---------------- */

      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.user = null;
        state.error = null;
      })

      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.error = null;
      })

      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null;

        /* 🔒 LICENSE ERRORS */
        if (action.payload?.code === "LICENSE_EXPIRED") {
          state.error =
            "Application license has expired. Please contact administrator.";
          return;
        }

        if (action.payload?.code === "LICENSE_INVALID") {
          state.error =
            "Application license is invalid. Please contact administrator.";
          return;
        }

        /* ❌ AUTH / OTHER ERRORS */
        state.error =
          action.payload?.message ||
          "Access Denied! Invalid User ID or Password";
      })

      /* ---------------- REGISTER USER ---------------- */

      .addCase(registerUser.pending, (state) => {
        state.loading = true;
      })

      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.userInfo = action.payload;
        localStorage.setItem("userInfo", JSON.stringify(action.payload));
      })

      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "User registration failed";
      });
  },
});

/* =========================================================
   EXPORTS
   ========================================================= */

export const { logoutUser } = userSlice.actions;
export default userSlice.reducer;
export const selectUser = (state) => state.user;
