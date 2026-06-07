import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Publications from "@/pages/Publications";
import Attendance from "@/pages/Attendance";
import Scores from "@/pages/Scores";
import Activities from "@/pages/Activities";
import Timeline from "@/pages/Timeline";
import Achievements from "@/pages/Achievements";
import JoinRequests from "@/pages/JoinRequests";
import MemberCV from "./pages/MemberCV";
import SRLSessions from "./pages/SRLSessions";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import VerifyOtp from "@/pages/VerifyOtp";
import ResetPassword from "@/pages/ResetPassword";
import GoogleSheetData from "@/pages/GoogleSheetData";
import SheetSync from "@/pages/SheetSync";
import NotFound from "./pages/NotFound";
import { getStoredUser, isAuthenticated } from "@/lib/auth";

// Wraps authentication-only pages (login, forgot-password, verify-otp, reset-password).
// If the user is already authenticated, immediately redirect them to their portal
// using `replace` so the auth page is removed from history — the back button cannot
// return to it.
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  if (isAuthenticated()) {
    const user = getStoredUser();
    return <Navigate to={user?.role === "admin" ? "/" : "/member-cv"} replace />;
  }
  return <>{children}</>;
};

const queryClient = new QueryClient();

// Admin-only route - only admins can access
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getStoredUser();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// View access route - both admin and members can view, members in read-only
const ViewAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // Pass viewOnly prop through context if needed by pages
  return <>{children}</>;
};

// Member-only restricted route - members can access /scores, /attendance, /member-cv only
const MemberRestrictedRoute = ({ allowedPaths, children }: { allowedPaths: string[], children: React.ReactNode }) => {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // If admin, allow access
  if (user.role === "admin") {
    return <>{children}</>;
  }
  // If member, check if current path is allowed
  if (user.role === "member" && !allowedPaths.includes(window.location.pathname)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Member or Admin route - both can access, but different features
const MemberAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
            <Route path="/verify-otp" element={<AuthRoute><VerifyOtp /></AuthRoute>} />
            <Route path="/reset-password" element={<AuthRoute><ResetPassword /></AuthRoute>} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                {/* Dashboard - accessible to both admin and members */}
                <Route path="/" element={<Dashboard />} />
                
                {/* Member CV - accessible to both, but members can only edit their own */}
                <Route
                  path="/member-cv"
                  element={
                    <MemberAccessRoute>
                      <MemberCV />
                    </MemberAccessRoute>
                  }
                />

                {/* Scores - accessible to admin and members (members view only) */}
                <Route
                  path="/scores"
                  element={
                    <ViewAccessRoute>
                      <Scores />
                    </ViewAccessRoute>
                  }
                />

                {/* Attendance - accessible to admin and members (members view only) */}
                <Route
                  path="/attendance"
                  element={
                    <ViewAccessRoute>
                      <Attendance />
                    </ViewAccessRoute>
                  }
                />

                {/* Admin-only routes - members get redirected to dashboard */}
                <Route
                  path="/students"
                  element={
                    <AdminOnlyRoute>
                      <Students />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/publications"
                  element={
                    <AdminOnlyRoute>
                      <Publications />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/activities"
                  element={
                    <AdminOnlyRoute>
                      <Activities />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/timeline"
                  element={
                    <AdminOnlyRoute>
                      <Timeline />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/achievements"
                  element={
                    <AdminOnlyRoute>
                      <Achievements />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/sessions"
                  element={
                    <AdminOnlyRoute>
                      <SRLSessions />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/join-requests"
                  element={
                    <AdminOnlyRoute>
                      <JoinRequests />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/google-sheets"
                  element={
                    <AdminOnlyRoute>
                      <GoogleSheetData />
                    </AdminOnlyRoute>
                  }
                />
                <Route
                  path="/sheet-sync"
                  element={
                    <AdminOnlyRoute>
                      <SheetSync />
                    </AdminOnlyRoute>
                  }
                />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
