import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarCheck,
  Trophy,
  UserCog,
  Calendar,
  Bell,
  Menu,
  X,
  ChevronRight,
  Beaker,
  LogOut,
  FileSpreadsheet,
  RefreshCw,
  FileUser,
  Milestone,
  ShieldCheck,
  Award,
  Presentation,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { clearSession, getStoredUser, hasWriteAccess } from "@/lib/auth";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { useServerEventsConnection } from "@/hooks/useServerEvents";

const allNavItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard, requiresAdmin: false },
  { title: "Students", path: "/students", icon: Users, requiresAdmin: true },
  { title: "Publications", path: "/publications", icon: BookOpen, requiresAdmin: true },
  { title: "Attendance", path: "/attendance", icon: CalendarCheck, requiresAdmin: false },
  { title: "Scores", path: "/scores", icon: Trophy, requiresAdmin: false },
  { title: "Activities", path: "/activities", icon: Calendar, requiresAdmin: true },
  { title: "Timeline", path: "/timeline", icon: Milestone, requiresAdmin: true },
  { title: "Achievements", path: "/achievements", icon: Award, requiresAdmin: true },
  { title: "SRL Sessions", path: "/sessions", icon: Presentation, requiresAdmin: true },
  { title: "Member CV", path: "/member-cv", icon: FileUser, requiresAdmin: false },
  { title: "Join Requests", path: "/join-requests", icon: ShieldCheck, requiresAdmin: true },
];

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/students": "Student Management",
  "/publications": "Publications",
  "/attendance": "Attendance",
  "/scores": "Live Scores",
  "/activities": "Activities & Events",
  "/timeline": "Journey Timeline",
  "/achievements": "Achievements",
  "/sessions": "SRL Sessions",
  "/member-cv": "Member CV Profiles",
  "/sheet-sync": "Sync Google Sheets",
  "/google-sheets": "Google Sheets Data",
  "/join-requests": "Join Us Requests",
};

export default function AdminLayout() {
  // Single persistent SSE connection for all admin pages (join requests, publications, etc.)
  useServerEventsConnection();

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = getStoredUser();
  const currentPage = pageNames[location.pathname] || "Dashboard";
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      setSidebarOpen(event.matches);
    };

    setIsDesktop(mediaQuery.matches);
    setSidebarOpen(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  // Only auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  }, [isDesktop, location.pathname]);

  const handleLogout = async () => {
    try {
      clearSession();

      toast({
        title: "Logged out",
        description: "Session cleared successfully.",
      });
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to logout",
      });
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full overflow-hidden bg-background">
      {/* Mobile overlay when sidebar is open */}
      <AnimatePresence>
        {sidebarOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Hidden on mobile unless opened */}
      <motion.aside
        initial={false}
        animate={{ width: isDesktop ? (sidebarOpen ? 260 : 72) : sidebarOpen ? 260 : 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col border-r border-border bg-sidebar h-full shrink-0 z-30 fixed top-0 left-0 lg:static"
      >
        {/* Logo */}
        <NavLink to="/" end className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <img src="/SRL Logo.svg" alt="SRL Logo" className="w-10 h-10 rounded-xl flex-shrink-0" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="text-sm font-bold text-foreground leading-tight block truncate max-w-[160px]">
                  {user?.role === "admin" ? "SRL Admin" : user?.name || "SRL Student"}
                </span>
                <span className="block text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">
                  {user?.role === "admin" ? "MMPSRPC, KSV" : "SRL Student Member"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </NavLink>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allNavItems
            .filter((item) => !item.requiresAdmin || hasWriteAccess())
            .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* Footer with Logout and Collapse button */}
        <div className="mt-auto border-t border-border bg-sidebar space-y-1 p-2">
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive gap-2 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span>Sign Out</span>}
          </Button>
          {isDesktop && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full inline-flex h-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <motion.div animate={{ rotate: sidebarOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronRight className="w-4 h-4" />
              </motion.div>
            </button>
          )}
        </div>
      </motion.aside>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 border-b border-border/70 bg-card/65 backdrop-blur-md shrink-0 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0 h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="page-title text-base sm:text-lg truncate">{currentPage}</h1>
                {/* <span className="hidden md:inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Live</span> */}
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground/90 truncate font-medium tracking-[0.08em] uppercase">Students Research Lab</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="hidden md:inline-flex items-center px-3 py-1 rounded-full border border-primary/15 bg-background/80 text-primary text-xs font-semibold shadow-sm">
              {today}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main data-scroll-container="app-main" className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </main>
        <ScrollToTopButton />
      </div>
    </div>
  );
}
