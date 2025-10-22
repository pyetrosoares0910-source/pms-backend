import { createBrowserRouter } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Reservations from "../pages/Reservations";
import Guests from "../pages/Guests";
import CleaningStaff from "../pages/CleaningStaff";
import Maintenance from "../pages/Maintenance";
import Rooms from "../pages/Rooms";       
import Staff from "../pages/Staff";       
import Stays from "../pages/Stays";
import MapView from "../pages/MapView";
import CleaningDashboard from "../pages/CleaningDashboard";
import CleaningSchedule from "../pages/CleaningSchedule";
import PrivateRoute from "./PrivateRoute";
import Maids from "../pages/Maids";
import CleaningReport from "../pages/CleaningReport";
import PerformanceReport from "../pages/PerformanceReport";
import MaintenanceCalendar from "../pages/MaintenanceCalendar";
import { useParams } from "react-router-dom";

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/", element: <Login /> }],
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/reservations", element: <Reservations /> },
          { path: "/guests", element: <Guests /> },
          { path: "/cleaning-staff", element: <CleaningStaff /> },
          { path: "/maintenance", element: <Maintenance /> },
          { path: "/rooms", element: <Rooms /> },   
          { path: "/staff", element: <Staff /> },   
          { path: "/stays", element: <Stays /> },
          { path: "/map", element: <MapView /> },
          { path: "/cleaning-dashboard", element: <CleaningDashboard /> },
          { path: "/cleaning-schedule", element: <CleaningSchedule /> },
          { path: "/maids", element: <Maids /> },
          { path: "/cleaning-report", element: <CleaningReport /> },
          { path: "/performance-report", element: <PerformanceReport />,},
          { path: "/maintenance-calendar", element: <MaintenanceCalendar />},
        ],
      },
    ],
  },
]);

export default router;

