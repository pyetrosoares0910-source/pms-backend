const VIEWER_ROLE = "VIEWER";

const VIEWER_ALLOWED_PATHS = new Set([
  "/dashboard",
  "/map",
  "/performance-report",
]);

export function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

export function isViewer(user) {
  return normalizeRole(user?.role) === VIEWER_ROLE;
}

export function canAccessPath(user, path) {
  if (!isViewer(user)) return true;
  return VIEWER_ALLOWED_PATHS.has(path);
}

export function getDefaultPath(user) {
  return isViewer(user) ? "/dashboard" : "/map";
}
