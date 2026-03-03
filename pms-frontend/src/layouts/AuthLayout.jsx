import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 text-slate-900">
      <Outlet />
    </div>
  );
}
