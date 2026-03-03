import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessPath, getDefaultPath } from "../lib/permissions";

export default function PrivateRoute() {
  const { token, user } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={getDefaultPath(user)} replace />;
  }

  return <Outlet />;
}
