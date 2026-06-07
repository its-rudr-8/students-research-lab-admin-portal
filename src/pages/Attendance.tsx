import { useState, useEffect, useMemo } from "react";
import { Check, X, Calendar as CalendarIcon, Pencil } from "lucide-react";
import { Button } from "../components/ui/button";
import { motion } from "framer-motion";
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import StudentAvatar from "@/components/StudentAvatar";
import { cn } from "@/lib/utils";
import { getStoredUser, hasWriteAccess } from "@/lib/auth";
import { adminAPI, parseList } from "@/lib/adminApi";
import { API_BASE_URL } from "@/config/apiConfig";
import { useToast } from "@/hooks/use-toast";
import { eachDayOfInterval, endOfMonth, format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Helper function to safely format dates
const formatDateToISO = (date: any): string | null => {
  try {
    if (typeof date === 'string' && date.trim()) {
      return date.includes('T') ? date.split('T')[0] : date;
    }
    if (date instanceof Date || typeof date === 'number') {
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split('T')[0];
      }
    }
    return null;
  } catch {
    return null;
  }
};

const getPresentStatus = (hours: number | string | null | undefined, attendance: number | string | null | undefined) => {
  const parsedHours = Number(hours ?? 0);
  const parsedAttendance = Number(attendance ?? 0);

  return parsedHours > 0 || parsedAttendance > 0;
};

type AttendanceRow = {
  id?: number;
  enrollment_no: string;
  name: string;
  initials: string;
  hours: number;
  attendance: number;
  daysPresent: number;
  profile_image?: string;
  hasRecord: boolean;
};

type AttendanceViewMode = "day" | "month";

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getMonthKey = (value: string | Date) => format(new Date(value), "yyyy-MM");

const getMonthLabel = (monthKey: string) => format(new Date(`${monthKey}-01`), "MMMM yyyy");

const getMonthRows = (records: any[], monthKey: string) =>
  records.filter((row: any) => String(row.period || "").startsWith(monthKey));

const isVisibleStudent = (student: any) => String(student.member_type || "member").toLowerCase() !== "admin";

const buildAttendanceRows = (
  studentsData: any[],
  attendanceRecords: any[],
  canEdit: boolean,
  ownEnrollment: string,
  filterBy: (row: any) => boolean,
) => {
  const attendanceByEnrollment = new Map<string, { row?: any; totalHours: number; totalAttendance: number; recordCount: number; presentPeriods: Set<string> }>();

  attendanceRecords.forEach((row: any) => {
    const enrollmentNo = String(row.enrollment_no || "");
    const current = attendanceByEnrollment.get(enrollmentNo) || {
      row: undefined,
      totalHours: 0,
      totalAttendance: 0,
      recordCount: 0,
      presentPeriods: new Set<string>(),
    };

    current.row = current.row || row;
    current.totalHours += Number(row.hours || 0);
    current.totalAttendance += Number(row.attendance || 0);
    current.recordCount += 1;
    if (getPresentStatus(row.hours, row.attendance)) {
      current.presentPeriods.add(String(row.period || ""));
    }
    attendanceByEnrollment.set(enrollmentNo, current);
  });

  const stuMap: { [enrollment_no: string]: { name: string; initials: string; profile_image?: string } } = {};
  studentsData
    .filter((student: any) => String(student.member_type || "member").toLowerCase() !== "admin")
    .forEach((s: any) => {
      if (!canEdit && String(s.enrollment_no || "").trim() !== ownEnrollment) {
        return;
      }

      if (!filterBy(s)) {
        return;
      }

      stuMap[s.enrollment_no] = {
        name: s.student_name,
        initials: s.student_name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase(),
        profile_image: undefined,
      };
    });

  return Object.entries(stuMap).map(([enrollmentNo, details]) => {
    const summary = attendanceByEnrollment.get(enrollmentNo);
    const hours = Number(summary?.totalHours || 0);
    const daysPresent = Number(summary?.presentPeriods?.size || 0);

    return {
      id: summary?.row ? Number(summary.row.id) : undefined,
      enrollment_no: enrollmentNo,
      name: details.name,
      initials: details.initials,
      profile_image: details.profile_image,
      hours,
      attendance: hours > 0 ? 1 : 0,
      daysPresent,
      hasRecord: Number(summary?.recordCount || 0) > 0,
    } as AttendanceRow;
  });
};

export default function Attendance() {
  const [students, setStudents] = useState<AttendanceRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchName, setSearchName] = useState("");
  const [viewMode, setViewMode] = useState<AttendanceViewMode>("day");
  const itemsPerPage = 10;
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addHours, setAddHours] = useState<{ [enrollment_no: string]: string }>({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthKey(new Date()));
  const [allDates, setAllDates] = useState<string[]>([]);
  const [cachedAttendanceData, setCachedAttendanceData] = useState<any[]>([]);
  const [cachedStudentsData, setCachedStudentsData] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AttendanceRow | null>(null);
  const [editHours, setEditHours] = useState("0");
  const [updatingAttendance, setUpdatingAttendance] = useState(false);
  const canEdit = hasWriteAccess();
  const currentUser = getStoredUser();
  const ownEnrollment = String(currentUser?.enrollmentNo || "").trim();

  const { toast } = useToast();

  // Fetch all available attendance data on mount - optimized single API call
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [attResponse, stuResponse] = await Promise.all([
          adminAPI.getAttendance(),
          adminAPI.getStudents()
        ]);

        const attList = parseList(attResponse);
        const uniqueDates = Array.from(new Set(attList.map((row: any) => row.period))).sort((a, b) => String(b).localeCompare(String(a))) as string[];
        setAllDates(uniqueDates);
        setCachedAttendanceData(attList);
        setAttendanceDate(uniqueDates.length > 0 ? uniqueDates[0] : format(new Date(), "yyyy-MM-dd"));
        setSelectedMonth(uniqueDates.length > 0 ? getMonthKey(uniqueDates[0]) : getMonthKey(new Date()));

        setCachedStudentsData(parseList(stuResponse));

        setLoading(false);
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch attendance data",
        });
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [refreshKey]);

  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/api/events`);
    es.addEventListener("student_changed", () => setRefreshKey((k) => k + 1));
    es.onerror = () => {};
    return () => es.close();
  }, []);

  // Process data for selected date/month - uses cached data
  useEffect(() => {
    if (viewMode === "day" && !attendanceDate) return;

    try {
      if (viewMode === "day") {
        const attData = cachedAttendanceData.filter((row: any) => row.period === attendanceDate);
        setStudents(
          buildAttendanceRows(
            cachedStudentsData,
            attData,
            canEdit,
            ownEnrollment,
            () => true,
          ),
        );
        return;
      }

      const monthRecords = getMonthRows(cachedAttendanceData, selectedMonth);
      setStudents(
        buildAttendanceRows(
          cachedStudentsData,
          monthRecords,
          canEdit,
          ownEnrollment,
          () => true,
        ),
      );
    } catch { }
  }, [attendanceDate, cachedAttendanceData, cachedStudentsData, canEdit, ownEnrollment, selectedMonth, viewMode]);

  // Reset to page 1 when attendance date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [attendanceDate, selectedMonth, viewMode]);

  const analysisData = useMemo(() => {
    const visibleEnrollments = new Set<string>();

    cachedStudentsData
      .filter(isVisibleStudent)
      .forEach((student: any) => {
        const enrollmentNo = String(student.enrollment_no || "").trim();
        if (!enrollmentNo) return;
        if (!canEdit && enrollmentNo !== ownEnrollment) return;
        visibleEnrollments.add(enrollmentNo);
      });

    if (viewMode === "day") {
      const dayRecords = cachedAttendanceData.filter((row: any) => {
        const enrollmentNo = String(row.enrollment_no || "").trim();
        return row.period === attendanceDate && visibleEnrollments.has(enrollmentNo);
      });

      const presentCount = dayRecords.filter((row: any) => getPresentStatus(row.hours, row.attendance)).length;
      const absentCount = Math.max(visibleEnrollments.size - presentCount, 0);

      return {
        title: "Selected Day Attendance Analysis",
        subtitle: attendanceDate ? format(new Date(attendanceDate), "do MMMM yyyy") : "Choose a day to see the attendance breakdown.",
        mode: "day" as const,
        totalStudents: visibleEnrollments.size,
        presentCount,
        absentCount,
        totalHours: Number(dayRecords.reduce((sum, row: any) => sum + Number(row.hours || 0), 0).toFixed(1)),
        chartData: [
          { name: "Present", value: presentCount, fill: "#0f766e" },
          { name: "Absent", value: absentCount, fill: "#dc2626" },
        ],
      };
    }

    const monthStart = parseISO(`${selectedMonth}-01`);
    const monthEnd = endOfMonth(monthStart);
    const dayMap = new Map<string, { present: number; hours: number }>();
    const studentMonthTotals = new Map<string, number>();

    cachedAttendanceData.forEach((row: any) => {
      const period = String(row.period || "");
      const enrollmentNo = String(row.enrollment_no || "").trim();

      if (!period.startsWith(selectedMonth) || !visibleEnrollments.has(enrollmentNo)) return;

      const key = period.slice(0, 10);
      const bucket = dayMap.get(key) || { present: 0, hours: 0 };
      if (getPresentStatus(row.hours, row.attendance)) {
        bucket.present += 1;
      }
      bucket.hours += Number(row.hours || 0);
      dayMap.set(key, bucket);

      if (getPresentStatus(row.hours, row.attendance)) {
        studentMonthTotals.set(enrollmentNo, (studentMonthTotals.get(enrollmentNo) || 0) + Number(row.hours || 0));
      }
    });

    const chartData = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((date) => {
      const key = format(date, "yyyy-MM-dd");
      const bucket = dayMap.get(key) || { present: 0, hours: 0 };

      return {
        name: format(date, "d"),
        dateLabel: format(date, "EEE, do MMM"),
        present: bucket.present,
        hours: Number(bucket.hours.toFixed(1)),
      };
    });

    const presentCount = studentMonthTotals.size;
    const absentCount = Math.max(visibleEnrollments.size - presentCount, 0);
    const highestHours = Array.from(studentMonthTotals.values()).reduce((max, hours) => Math.max(max, hours), 0);

    return {
      title: "Selected Month Attendance Analysis",
      subtitle: getMonthLabel(selectedMonth),
      mode: "month" as const,
      totalStudents: visibleEnrollments.size,
      presentCount,
      absentCount,
      totalHours: Number(highestHours.toFixed(1)),
      chartData,
    };
  }, [attendanceDate, cachedAttendanceData, cachedStudentsData, canEdit, ownEnrollment, selectedMonth, viewMode]);

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setAddError("Only admin can add attendance.");
      return;
    }
    setAdding(true);
    setAddError("");
    if (!addDate) {
      setAddError("Please select a date.");
      setAdding(false);
      return;
    }
    // Prepare rows for students with entered hours
    const rows = Object.entries(addHours)
      .filter(([_, hours]) => hours !== "" && !isNaN(Number(hours)))
      .map(([enrollment_no, hours]) => ({
        enrollment_no,
        date: addDate,
        hours: parseFloat(hours),
      }));
    if (rows.length === 0) {
      setAddError("Please enter hours for at least one student.");
      setAdding(false);
      return;
    }

    try {
      // Insert attendance records
      for (const row of rows) {
        await adminAPI.markAttendance(row);
      }

      toast({
        title: "Attendance added successfully",
      });

      setShowAddForm(false);
      setAddHours({});
      setAddDate("");
      setAttendanceDate(addDate);

      // Refresh the dates list
      const response = await adminAPI.getAttendance();
      const refreshedList = parseList(response);
      const uniqueDates = Array.from(new Set(refreshedList.map((row: any) => row.period))).sort((a, b) => String(b).localeCompare(String(a))) as string[];
      setAllDates(uniqueDates);
      setCachedAttendanceData(refreshedList);
    } catch (error: any) {
      setAddError(error.message || "Failed to add attendance");
    }
    setAdding(false);
  };

  const handleOpenEdit = (student: AttendanceRow) => {
    setEditingStudent(student);
    setEditHours(String(Number(student.hours || 0)));
    setIsEditOpen(true);
  };

  const handleUpdateAttendance = async () => {
    if (!editingStudent || !canEdit) return;
    const parsedHours = Number(editHours);

    if (Number.isNaN(parsedHours) || parsedHours < 0) {
      toast({ variant: "destructive", title: "Invalid hours", description: "Hours must be 0 or greater." });
      return;
    }
    if (!attendanceDate) {
      toast({ variant: "destructive", title: "Missing date", description: "Select an attendance date first." });
      return;
    }

    try {
      setUpdatingAttendance(true);
      await adminAPI.markAttendance({
        enrollment_no: editingStudent.enrollment_no,
        date: attendanceDate,
        hours: parsedHours,
      });

      toast({ title: "Attendance updated" });
      setIsEditOpen(false);
      setEditingStudent(null);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update attendance",
      });
    } finally {
      setUpdatingAttendance(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl">
      <div className="flex justify-start sm:justify-end">
        {canEdit && !showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="bg-teal-800 hover:bg-teal-900 text-white font-semibold text-sm sm:text-base">
            Add Attendance
          </Button>
        )}
      </div>
      {!canEdit && <p className="text-xs text-muted-foreground">You have read-only access. Only admin can add attendance.</p>}
      {showAddForm && (
        <form onSubmit={handleAddAttendance} className="mb-4 p-4 sm:p-6 border-2 border-[#EAD8C0]/50 rounded-2xl bg-gradient-to-br from-[#FAF7F2]/30 to-stone-50/20 flex flex-col gap-4 max-w-4xl mx-auto w-full glass-card">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
              <label htmlFor="attendance-date" className="font-semibold text-sm text-stone-700 shrink-0">Date:</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "calendar-beige border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 rounded-lg text-sm flex-1 text-stone-700 font-medium justify-between text-left",
                      !addDate && "text-muted-foreground"
                    )}
                  >
                    {addDate ? format(new Date(addDate), "do MMMM yyyy") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={addDate ? new Date(addDate) : undefined}
                    onSelect={(date) => setAddDate(date ? format(date, "yyyy-MM-dd") : "")}
                    disabled={{ after: new Date() }}
                    initialFocus
                    className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-xl"
                    classNames={{
                      day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                      day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                      day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                      head_cell: "text-[#8B735B] font-bold",
                      cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
              <label htmlFor="search-name" className="font-semibold text-sm text-stone-700 shrink-0">Search Name:</label>
              <input
                id="search-name"
                name="search-name"
                type="text"
                placeholder="Search by student name..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 rounded-lg text-sm flex-1 text-stone-700 font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-96 -mx-4 sm:-mx-6 px-4 sm:px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#EAD8C0]/30 to-stone-100/30 border-b-2 border-[#EAD8C0]/50">
                  <th className="text-left px-4 py-3 text-[#8B735B] font-bold">Student</th>
                  <th className="text-center px-4 py-3 text-[#8B735B] font-bold">Enrollment No.</th>
                  <th className="text-center px-4 py-3 text-[#8B735B] font-bold">Hours</th>
                </tr>
              </thead>
              <tbody>
                {cachedStudentsData
                  .filter((s: any) => String(s.member_type || "member").toLowerCase() !== "admin")
                  .filter((s: any) => s.student_name?.toLowerCase().includes(searchName.toLowerCase()))
                  .map((student: any, idx: number) => (
                  <tr key={student.enrollment_no} className={`border-b border-[#EAD8C0]/20 hover:bg-[#EAD8C0]/10 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F2]/50'}`}>
                    <td className="px-4 py-3 text-stone-700 font-medium">{student.student_name}</td>
                    <td className="px-4 py-3 text-center text-stone-600 font-mono text-xs">{student.enrollment_no}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        id={`hours-${student.enrollment_no}`}
                        name={`hours-${student.enrollment_no}`}
                        type="number"
                        step="0.5"
                        min="0"
                        value={addHours[student.enrollment_no] || ""}
                        onChange={e => setAddHours({ ...addHours, [student.enrollment_no]: e.target.value })}
                        className="border-2 border-[#EAD8C0]/40 bg-white px-2 py-2 rounded-md w-28 text-center text-stone-700 font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
                        placeholder="0.0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {addError && <div className="text-red-700 text-sm mt-2 p-2 bg-red-50 rounded-md border border-red-300">{addError}</div>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={adding} className="bg-teal-700 hover:bg-teal-800 text-white font-semibold py-2 rounded-lg transition-colors flex-1">
              {adding ? "Adding..." : "Submit Attendance"}
            </Button>
            <Button type="button" onClick={() => setShowAddForm(false)} className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold py-2 rounded-lg transition-colors">
              Close
            </Button>
          </div>
          <style>{`
            /* Calendar picker theme styling */
            #attendance-date::-webkit-calendar-picker-indicator {
              filter: invert(0.7) sepia(0.4) hue-rotate(30deg);
              cursor: pointer;
            }
            
            /* Target calendar popup styles */
            input[type="date"] {
              accent-color: #78350f;
            }
          `}</style>
        </form>
      )}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-stone-800 shrink-0">
          Attendance for
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={viewMode === "day" ? "default" : "outline"}
            onClick={() => setViewMode("day")}
            className={viewMode === "day" ? "bg-teal-700 hover:bg-teal-800 text-white" : "border-[#EAD8C0]/60 text-stone-700"}
          >
            Day View
          </Button>
          <Button
            type="button"
            variant={viewMode === "month" ? "default" : "outline"}
            onClick={() => setViewMode("month")}
            className={viewMode === "month" ? "bg-teal-700 hover:bg-teal-800 text-white" : "border-[#EAD8C0]/60 text-stone-700"}
          >
            Month View
          </Button>
        </div>
        {viewMode === "day" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "min-w-[220px] justify-between border-2 border-[#EAD8C0]/60 bg-white/90 px-4 py-2 text-left font-medium text-stone-700 shadow-sm hover:bg-[#FAF7F2]",
                  !attendanceDate && "text-muted-foreground",
                )}
              >
                {attendanceDate ? format(new Date(attendanceDate), "do MMMM yyyy") : <span>Select a date</span>}
                <CalendarIcon className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
              <Calendar
                mode="single"
                selected={attendanceDate ? new Date(attendanceDate) : undefined}
                onSelect={(date) => setAttendanceDate(date ? format(date, "yyyy-MM-dd") : null)}
                disabled={{ after: new Date() }}
                initialFocus
                className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-xl"
                classNames={{
                  day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                  day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                  day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                  head_cell: "text-[#8B735B] font-bold",
                  cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                }}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="min-w-[220px] justify-between border-2 border-[#EAD8C0]/60 bg-white/90 px-4 py-2 text-left font-medium text-stone-700 shadow-sm hover:bg-[#FAF7F2]"
              >
                {getMonthLabel(selectedMonth)}
                <CalendarIcon className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-4 border-2 border-[#EAD8C0]/50 shadow-2xl bg-[#FAF7F2]" align="start">
              <MonthPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
              />
            </PopoverContent>
          </Popover>
        )}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-[#EAD8C0]/60 bg-gradient-to-br from-white to-[#FAF7F2] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-stone-800">{analysisData.title}</h3>
            <p className="text-sm text-muted-foreground">{analysisData.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[340px]">
            <div className="rounded-xl border border-[#EAD8C0]/50 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Students</div>
              <div className="text-lg font-semibold text-stone-800">{analysisData.totalStudents}</div>
            </div>
            <div className="rounded-xl border border-[#EAD8C0]/50 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Present</div>
              <div className="text-lg font-semibold text-teal-700">
                {analysisData.mode === "day" ? analysisData.presentCount : analysisData.presentCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#EAD8C0]/50 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Absent</div>
              <div className="text-lg font-semibold text-red-600">
                {analysisData.mode === "day" ? analysisData.absentCount : analysisData.absentCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#EAD8C0]/50 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Hours</div>
              <div className="text-lg font-semibold text-stone-800">{analysisData.totalHours}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 h-64 w-full rounded-xl border border-[#EAD8C0]/40 bg-white/80 p-2 sm:p-3">
          {analysisData.chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No attendance data available for the selected {viewMode}.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysisData.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ead8c0" />
                <XAxis dataKey="name" tick={{ fill: "#8b735b", fontSize: 12 }} axisLine={{ stroke: "#ead8c0" }} tickLine={false} />
                <YAxis tick={{ fill: "#8b735b", fontSize: 12 }} axisLine={{ stroke: "#ead8c0" }} tickLine={false} allowDecimals={false} />
                <RechartsTooltip
                  cursor={{ fill: "rgba(234, 216, 192, 0.18)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;

                    const point = payload[0]?.payload as any;

                    return (
                      <div className="rounded-lg border border-[#EAD8C0]/60 bg-white px-3 py-2 shadow-lg">
                        <div className="text-sm font-semibold text-stone-800">
                          {analysisData.mode === "month" ? point?.dateLabel || label : label}
                        </div>
                        <div className="mt-1 space-y-1 text-xs text-stone-600">
                          {analysisData.mode === "day" ? (
                            <>
                              <div>Present: {point?.name === "Present" ? point?.value : analysisData.presentCount}</div>
                              <div>Absent: {point?.name === "Absent" ? point?.value : analysisData.absentCount}</div>
                            </>
                          ) : (
                            <>
                              <div>Present students: {point?.present ?? 0}</div>
                              <div>Total hours: {point?.hours ?? 0}</div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey={analysisData.mode === "day" ? "value" : "present"} radius={[8, 8, 0, 0]} fill="#0f766e">
                  {analysisData.mode === "day"
                    ? analysisData.chartData.map((entry: any, index: number) => (
                        <Cell key={`day-${index}`} fill={entry.fill} />
                      ))
                    : null}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:max-w-3xl flex-1">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-6 text-center text-muted-foreground">Loading attendance...</div>
              ) : (
                <div className="w-full">
                  {/* Header Row */}
                  <div className="flex border-b border-[#EAD8C0]/50 bg-[#EAD8C0]/40">
                    <div className="flex-1 text-left text-xs font-bold text-[#8B735B] uppercase tracking-wider py-2 px-2">Student</div>
                    <div className="flex-1 text-center text-xs font-bold text-[#8B735B] uppercase tracking-wider py-2 px-2">
                      {viewMode === "month" ? "Days Present" : "Present"}
                    </div>
                    <div className="flex-1 text-center text-xs font-bold text-[#8B735B] uppercase tracking-wider py-2 px-2">
                      {viewMode === "month" ? "Total Hours" : "Hours"}
                    </div>
                    {canEdit && viewMode === "day" && <div className="w-24 text-center text-xs font-bold text-[#8B735B] uppercase tracking-wider py-2 px-2">Edit</div>}
                  </div>
                  {/* Data Rows */}
                  {students.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">No attendance data found.</div>
                  ) : (
                    (() => {
                      const startIdx = (currentPage - 1) * itemsPerPage;
                      const endIdx = startIdx + itemsPerPage;
                      const paginatedStudents = students.slice(startIdx, endIdx);
                      return paginatedStudents.map((student, i) => {
                        const present = getPresentStatus(student.hours, student.attendance);
                        return (
                          <motion.div key={student.enrollment_no} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="flex border-b border-[#EAD8C0]/20 last:border-0 hover:bg-[#EAD8C0]/5 transition-colors">
                            <div className="flex-1 py-2 px-2 bg-white flex items-center gap-1">
                              <StudentAvatar
                                name={student.name}
                                enrollmentNo={student.enrollment_no}
                                photoUrl={student.profile_image}
                                className="w-7 h-7"
                                fallbackClassName="bg-[#EAD8C0]/30 text-[#8B735B] text-[10px] font-medium"
                              />
                              <span className="text-sm font-medium text-foreground">{student.name}</span>
                            </div>
                            <div className="flex-1 py-2 px-2 flex items-center justify-center">
                              {viewMode === "month" ? (
                                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                                  {student.daysPresent} day{student.daysPresent === 1 ? "" : "s"}
                                </span>
                              ) : present ? (
                                <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Present</span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Absent</span>
                              )}
                            </div>
                            <div className="flex-1 py-2 px-2 text-center">
                              <span className="inline-block bg-[#EAD8C0]/30 px-2 py-0.5 rounded text-sm font-bold text-[#8B735B]">{Number(student.hours).toFixed(1)}</span>
                            </div>
                            {canEdit && viewMode === "day" && (
                              <div className="w-24 py-2 px-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-teal-700 hover:bg-teal-50"
                                  onClick={() => handleOpenEdit(student)}
                                >
                                  <Pencil className="w-4 h-4 mr-1" />
                                  {student.hasRecord ? "Edit" : "Add"}
                                </Button>
                              </div>
                            )}
                          </motion.div>
                        );
                      });
                    })()
                  )}
                  {/* Footer with Pagination */}
                  {students.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[#EAD8C0]/20 bg-[#FAF7F2]/50">
                      <div className="text-sm text-muted-foreground">
                        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, students.length)}-{Math.min(currentPage * itemsPerPage, students.length)} of {students.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ←
                        </button>
                        {Array.from({ length: Math.ceil(students.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-2 py-1 rounded ${currentPage === page
                              ? 'bg-teal-700 text-white'
                              : 'text-muted-foreground hover:text-foreground'
                              }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(students.length / itemsPerPage), p + 1))}
                          disabled={currentPage === Math.ceil(students.length / itemsPerPage)}
                          className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          →
                        </button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {Math.ceil(students.length / itemsPerPage)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="hidden lg:flex flex-col items-center justify-start pt-20 pr-10">
          <img src="/Attendance.webp" alt="Attendance" className="max-w-xs rounded-lg shadow-[0_0_50px_rgba(234,216,192,1),0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#EAD8C0] transform hover:scale-[1.02] transition-transform duration-500" />
        </div>
      </motion.div>

      <Dialog open={isEditOpen} onOpenChange={(o) => { if (!updatingAttendance) setIsEditOpen(o); }}>
        <DialogContent className="rounded-2xl sm:max-w-md bg-[#FAF7F2] border-[#EAD8C0]">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-stone-700">
              <p className="font-semibold">{editingStudent?.name}</p>
              <p className="text-xs text-muted-foreground">{editingStudent?.enrollment_no}</p>
              <p className="text-xs text-muted-foreground">Date: {attendanceDate || "-"}</p>
              <p className="text-xs text-muted-foreground">
                Status: {Number(editHours || 0) > 0 ? "Present" : "Absent"}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Hours</label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={updatingAttendance}>Cancel</Button>
              <Button onClick={handleUpdateAttendance} disabled={updatingAttendance} className="bg-teal-700 hover:bg-teal-800 text-white">
                {updatingAttendance ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const currentMonth = Number(value.split("-")[1] || new Date().getMonth() + 1) - 1;
  const currentYear = Number(value.split("-")[0] || new Date().getFullYear());

  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    setYear(currentYear);
  }, [currentYear]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)} className="border-[#EAD8C0]/60 text-stone-700">
          ←
        </Button>
        <div className="font-semibold text-stone-800">{year}</div>
        <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)} className="border-[#EAD8C0]/60 text-stone-700">
          →
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MONTH_OPTIONS.map((month, index) => {
          const monthValue = `${year}-${String(index + 1).padStart(2, "0")}`;
          const active = monthValue === value;

          return (
            <button
              key={month}
              type="button"
              onClick={() => onChange(monthValue)}
              className={cn(
                "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-[#EAD8C0]/50 bg-white text-stone-700 hover:bg-[#EAD8C0]/20",
              )}
            >
              {month.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground text-center">Select a month to view cumulative attendance hours.</div>
    </div>
  );
}