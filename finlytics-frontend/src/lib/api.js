const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const TOKEN_KEY = "finlytics_token";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function ngrokHeader() {
  return BASE_URL.includes("ngrok-free.app") ? { "ngrok-skip-browser-warning": "true" } : {};
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...ngrokHeader(),
    ...authHeader(),
    ...(options.headers || {}),
  };
  // Don't send Content-Type for FormData (browser sets boundary)
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = body;
    // Auto-logout on 401 (expired token)
    if (res.status === 401 && getToken()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("finlytics_user");
    }
    throw err;
  }

  return body;
}

export const api = {
  health: () => request("/health"),

  // Users — now with password + JWT
  createUser: (name, email, password) =>
    request("/users", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  login: (email, password) =>
    request("/users/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  getUser: (id) => request(`/users/${id}`),
  getMe: () => request("/users/me"),

  // Helpers for token storage (used by AuthContext)
  setToken: (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  },
  getToken,
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  // Transactions
  listTransactions: (userId, filters = {}) => {
    const params = new URLSearchParams({ user_id: userId, ...filters });
    return request(`/transactions?${params.toString()}`);
  },
  createTransaction: (payload) =>
    request("/transactions", { method: "POST", body: JSON.stringify(payload) }),
  updateTransactionCategory: (id, category) =>
    request(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ category }) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  // Uploads
  listUploads: (userId) => request(`/uploads?user_id=${userId}`),
  uploadCsv: async (userId, file) => {
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("file", file);

    const headers = { ...ngrokHeader(), ...authHeader() };
    const res = await fetch(`${BASE_URL}/uploads`, { method: "POST", headers, body: formData });
    let body = null;
    try {
      body = await res.json();
    } catch {
      // no JSON body
    }
    if (!res.ok) {
      const err = new Error(body?.error || `Upload failed (${res.status})`);
      err.status = res.status;
      err.details = body;
      throw err;
    }
    return body;
  },

  // Forecast
  getForecast: (userId) => request(`/forecast?user_id=${userId}`),
  scoreAnomalies: (userId) =>
    request("/transactions/score-anomalies", { method: "POST", body: JSON.stringify({ user_id: userId }) }),
};

export { BASE_URL, TOKEN_KEY };
