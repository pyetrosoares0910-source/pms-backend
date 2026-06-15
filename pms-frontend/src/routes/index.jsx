import { createElement, lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";

import PrivateRoute from "./PrivateRoute";

const Login = lazy(() => import("../pages/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Reservations = lazy(() => import("../pages/Reservations"));
const Guests = lazy(() => import("../pages/Guests"));
const CleaningStaff = lazy(() => import("../pages/CleaningStaff"));
const Maintenance = lazy(() => import("../pages/Maintenance"));
const Rooms = lazy(() => import("../pages/Rooms"));
const Staff = lazy(() => import("../pages/Staff"));
const Stays = lazy(() => import("../pages/Stays"));
const MapView = lazy(() => import("../pages/MapView"));
const CleaningDashboard = lazy(() => import("../pages/CleaningDashboard"));
const CleaningSchedule = lazy(() => import("../pages/CleaningSchedule"));
const Maids = lazy(() => import("../pages/Maids"));
const CleaningReport = lazy(() => import("../pages/CleaningReport"));
const PerformanceReport = lazy(() => import("../pages/PerformanceReport"));
const PerformanceReport2 = lazy(() => import("../pages/PerformanceReport2"));
const MaintenanceCalendar = lazy(() => import("../pages/MaintenanceCalendar"));
const MaintenanceCollaborators = lazy(() => import("../pages/MaintenanceCollaborators"));
const MaidAssignments = lazy(() => import("../pages/MaidAssignments"));
const Products = lazy(() => import("../pages/Products"));
const Inventory = lazy(() => import("../pages/Inventory"));
const Purchases = lazy(() => import("../pages/Purchases"));
const ConsumptionProfiles = lazy(() => import("../pages/ConsumptionProfiles"));
const GuestCheckins = lazy(() => import("../pages/GuestCheckins"));
const GuestCheckouts = lazy(() => import("../pages/GuestCheckouts"));
const CleaningIntegrity = lazy(() => import("../pages/CleaningIntegrity"));
const ApresentacaoHospedes = lazy(() => import("../pages/ApresentacaoHospedes"));
const CleaningReminders = lazy(() => import("../pages/CleaningReminders"));

const page = (PageComponent) => (
  <Suspense
    fallback={
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500 dark:text-slate-300">
        Carregando...
      </div>
    }
  >
    {createElement(PageComponent)}
  </Suspense>
);

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/", element: page(Login) }],
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: "/dashboard", element: page(Dashboard) },
          { path: "/reservations", element: page(Reservations) },
          { path: "/guests", element: page(Guests) },
          { path: "/cleaning-staff", element: page(CleaningStaff) },
          { path: "/maintenance", element: page(Maintenance) },
          { path: "/rooms", element: page(Rooms) },
          { path: "/staff", element: page(Staff) },
          { path: "/stays", element: page(Stays) },
          { path: "/map", element: page(MapView) },
          { path: "/cleaning-dashboard", element: page(CleaningDashboard) },
          { path: "/cleaning-schedule", element: page(CleaningSchedule) },
          { path: "/maids", element: page(Maids) },
          { path: "/cleaning-report", element: page(CleaningReport) },
          { path: "/performance-report", element: page(PerformanceReport) },
          { path: "/performance-report-2", element: page(PerformanceReport2) },
          { path: "/maintenance-calendar", element: page(MaintenanceCalendar) },
          { path: "/maintenance-collaborators", element: page(MaintenanceCollaborators) },
          { path: "/maid-assignments", element: page(MaidAssignments) },
          { path: "/apresentacao-hospedes", element: page(ApresentacaoHospedes) },
          { path: "/guest-checkins", element: page(GuestCheckins) },
          { path: "/guest-checkouts", element: page(GuestCheckouts) },
          { path: "/cleaning-integrity", element: page(CleaningIntegrity) },
          { path: "/cleaning-reminders", element: page(CleaningReminders) },
          { path: "/products", element: page(Products) },
          { path: "/inventory", element: page(Inventory) },
          { path: "/purchases", element: page(Purchases) },
          { path: "/consumption", element: page(ConsumptionProfiles) },
        ],
      },
    ],
  },
]);

export default router;
