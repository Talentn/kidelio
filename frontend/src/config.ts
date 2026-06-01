/** Empty in dev (CRA proxy → Rails). Set REACT_APP_API_URL in production builds. */
export const API_ORIGIN = process.env.REACT_APP_API_URL || "";
export const API_V1 = `${API_ORIGIN}/api/v1`;
