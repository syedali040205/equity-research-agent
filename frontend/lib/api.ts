export const API =
  typeof window === "undefined"
    ? process.env.BACKEND_URL || "http://localhost:8000"
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
