import { useState, useEffect } from "react";
import { Check, X, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { motion } from "framer-motion";
import StudentAvatar from "@/components/StudentAvatar";
import { cn } from "@/lib/utils";
import { getStoredUser, hasWriteAccess } from "@/lib/auth";
import { adminAPI, parseList } from "@/lib/adminApi";
import { API_BASE_URL } from "@/config/apiConfig";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function Attendance() {
  const [students, setStudents] = useState<Array<{ enrollment_no: string; name: string; initials: string; hours: number; profile_image?: string }>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchName, setSearchName] = useState("");
  const itemsPerPage = 10;
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addHours, setAddHours] = useState<{ [enrollment_no: string]: string }>({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState<string | null>(null);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [cachedAttendanceData, setCachedAttendanceData] = useState<any[]>([]);
  const [cachedStudentsData, setCachedStudentsData] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
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
        if (uniqueDates.length > 0) {
          setAttendanceDate(uniqueDates[0]);
        }

        setCachedStudentsData(parseList(stuResponse));

        setLoading(false);
      } catch (error) {
        console.error("Error fetching attendance data:", error);
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

  // Process data for selected date - uses cached data
  useEffect(() => {
    if (!attendanceDate || cachedAttendanceData.length === 0) return;

    try {
      const attData = cachedAttendanceData.filter((row: any) => row.period === attendanceDate);
      const stuData = cachedStudentsData;

      const stuMap: { [enrollment_no: string]: { name: string; initials: string; profile_image?: string } } = {};
      stuData
        .filter((student: any) => String(student.member_type || "member").toLowerCase() !== "admin")
        .forEach((s: any) => {
          if (!canEdit && String(s.enrollment_no || "").trim() !== ownEnrollment) {
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

      const studentsList = attData
        .filter((row: any) => stuMap[row.enrollment_no])
        .map((row: any) => {
          const details = stuMap[row.enrollment_no];
          return {
            enrollment_no: row.enrollment_no,
            name: details ? details.name : row.enrollment_no,
            initials: details ? details.initials : row.enrollment_no.slice(0, 2).toUpperCase(),
            profile_image: details?.profile_image,
            hours: row.hours,
          };
        });
      setStudents(studentsList);
    } catch (error) {
      console.error("Error processing attendance data:", error);
    }
  }, [attendanceDate, cachedAttendanceData]);

  // Reset to page 1 when attendance date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [attendanceDate]);

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
        <Select
          value={attendanceDate || ''}
          onValueChange={(value) => setAttendanceDate(value)}
        >
          <SelectTrigger className="px-3 py-1.5 h-auto rounded border-2 border-[#EAD8C0] bg-[#FAF7F2] text-stone-800 text-sm font-medium w-32 sm:w-auto hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#EAD8C0]/30">
            <SelectValue placeholder="Select Date" />
          </SelectTrigger>
          <SelectContent className="bg-[#FAF7F2] border-2 border-[#EAD8C0] max-h-60 overflow-y-auto">
            {allDates.map((date, index) => {
              const displayDate = formatDateToISO(date) || 'Invalid date';
              return (
                <SelectItem
                  key={`date-${index}`}
                  value={date}
                  className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer text-stone-800 font-medium"
                >
                  {displayDate}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
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
                    <div className="flex-1 text-center text-xs font-bold text-[#8B735B] uppercase tracking-wider py-2 px-2">Present</div>
                    <div className="flex-1 text-center text-xs font-bold text-[#8B735B] uppercase tracking-wider py-2 px-2">Hours</div>
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
                        const present = student.hours !== 0;
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
                              {present ? (
                                <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Present</span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Absent</span>
                              )}
                            </div>
                            <div className="flex-1 py-2 px-2 text-center">
                              <span className="inline-block bg-[#EAD8C0]/30 px-2 py-0.5 rounded text-sm font-bold text-[#8B735B]">{Number(student.hours).toFixed(1)}</span>
                            </div>
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
          <img src="/Attendance.jpg" alt="Attendance" className="max-w-xs rounded-lg shadow-[0_0_50px_rgba(234,216,192,1),0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#EAD8C0] transform hover:scale-[1.02] transition-transform duration-500" />
        </div>
      </motion.div>
    </div>
  );
}