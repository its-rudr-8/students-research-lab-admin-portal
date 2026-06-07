import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated, getStoredUser } from "@/lib/auth";

// Pages that require admin access only
const ADMIN_ONLY_PAGES = [
	"/students",
	"/activities",
	"/timeline",
	"/achievements",
	"/join-requests",
	"/google-sheets",
	"/sheet-sync",
];

// Pages that both admin and members can access
const SHARED_ACCESS_PAGES = [
	"/",
	"/attendance",
	"/scores",
	"/member-cv",
];

export default function ProtectedRoute() {
	const location = useLocation();

	// If not authenticated, redirect to login
	if (!isAuthenticated()) {
		return <Navigate to="/login" replace />;
	}

	// Check if current page requires admin access
	const currentPath = location.pathname;
	const requiresAdmin = ADMIN_ONLY_PAGES.includes(currentPath);
	const isSharedAccess = SHARED_ACCESS_PAGES.includes(currentPath);

	// If page requires admin access, check user role
	if (requiresAdmin) {
		const user = getStoredUser();
		if (user?.role !== "admin") {
			return <Navigate to="/" replace />;
		}
	}

	// Shared access pages are allowed for both admin and members
	if (isSharedAccess) {
		const user = getStoredUser();
		if (!user) {
			return <Navigate to="/login" replace />;
		}
	}

	return <Outlet />;
}
