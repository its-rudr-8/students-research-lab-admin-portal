import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, Edit2, Check, X } from "lucide-react";
import StudentAvatar from "@/components/StudentAvatar";
import { hasWriteAccess } from "@/lib/auth";
import { adminAPI } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScoreRow {
  id: string;
  enrollment_no: string;
  points: number;
  name: string;
  initials: string;
  photo_url?: string;
}

export default function Scores() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [students, setStudents] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [cachedLeaderboardStats, setCachedLeaderboardStats] = useState<any[]>([]);
  const [cachedStudentsData, setCachedStudentsData] = useState<any[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [isAddingScore, setIsAddingScore] = useState(false);
  const [newScoreEnrollment, setNewScoreEnrollment] = useState("");
  const [newScorePoints, setNewScorePoints] = useState(0);
  const [searchName, setSearchName] = useState("");

  const canEdit = hasWriteAccess();
  const { toast } = useToast();

  const normalizeText = (value: unknown) => String(value || "").trim();
  const monthRank = (value: string) => {
    const raw = normalizeText(value);
    const match = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return 0;

    const monthLookup: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12,
    };

    const monthNumber = monthLookup[match[1].toLowerCase()] || 0;
    const yearNumber = Number(match[2]) || 0;
    return yearNumber * 100 + monthNumber;
  };

  const buildMonthOptions = (data: any, leaderboardStats: any[]): string[] => {
    const availableMonths = Array.isArray(data?.availableMonths) ? data.availableMonths : [];
    const monthsFromAvailable: string[] = availableMonths
      .map((item: any) => normalizeText(item?.label || item?.value || item?.period))
      .filter((period: string) => period && !/^all\s*time$/i.test(period));

    if (monthsFromAvailable.length > 0) {
      return Array.from(new Set<string>(monthsFromAvailable)).sort((a: string, b: string) => monthRank(b) - monthRank(a));
    }

    const monthsFromLeaderboard: string[] = leaderboardStats
      .map((row: any) => normalizeText(row.period))
      .filter((period: string) => period && !/^all\s*time$/i.test(period));

    return Array.from(new Set<string>(monthsFromLeaderboard)).sort((a: string, b: string) => monthRank(b) - monthRank(a));
  };

  const pickLatestRowsByEnrollment = (rows: any[]) => {
    const latestByEnrollment = new Map<string, any>();

    rows.forEach((row: any) => {
      const enrollment = normalizeText(row.enrollment_no);
      if (!enrollment) return;

      const nextTime = new Date(row.created_at || 0).getTime();
      const current = latestByEnrollment.get(enrollment);
      const currentTime = current ? new Date(current.created_at || 0).getTime() : -1;

      if (!current || nextTime >= currentTime) {
        latestByEnrollment.set(enrollment, row);
      }
    });

    return Array.from(latestByEnrollment.values());
  };

  // Fetch all available data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [scoresResponse, studentsResponse] = await Promise.all([
          adminAPI.getScores(),
          adminAPI.getStudents()
        ]);

        if (!scoresResponse.success) {
          setFetchError("Failed to fetch scores from backend");
          setLoading(false);
          return;
        }

        const data = scoresResponse.data;
        const leaderboardStats = Array.isArray(data.leaderboardStats) ? data.leaderboardStats : [];

        // Build student name map
        const nameMap = new Map<string, string>();
        if (Array.isArray(studentsResponse.data)) {
          studentsResponse.data.forEach((stu: any) => {
            const enrollment = normalizeText(stu.enrollment_no);
            const name = normalizeText(stu.student_name);
            if (enrollment && name) {
              nameMap.set(enrollment, name);
            }
          });
        }
        setStudents(nameMap);
        setCachedStudentsData(studentsResponse.data || []);

        const monthsArr = buildMonthOptions(data, leaderboardStats);
        setMonthOptions(monthsArr);

        // Cache leaderboard stats
        setCachedLeaderboardStats(leaderboardStats);

        // Set default to first/most recent month
        if (monthsArr.length > 0) {
          setSelectedMonth(monthsArr[0]);
        }

        setLoading(false);
      } catch (error: any) {
        setFetchError(error.message || "Failed to fetch scores");
        console.error("Error fetching scores:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to fetch scores",
        });
        setLoading(false);
      }
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Process data for selected month - uses cached data
  useEffect(() => {
    if (!selectedMonth || cachedLeaderboardStats.length === 0) {
      setScores([]);
      return;
    }

    try {
      const monthlyScores = cachedLeaderboardStats.filter((score: any) => {
        return normalizeText(score.period) === selectedMonth;
      });

      const uniqueMonthlyScores = pickLatestRowsByEnrollment(monthlyScores);

      const nameMap = new Map<string, string>();
      cachedStudentsData.forEach((stu: any) => {
        const enrollment = normalizeText(stu.enrollment_no);
        const name = normalizeText(stu.student_name);
        if (enrollment && name) {
          nameMap.set(enrollment, name);
        }
      });

      const scoreRows: ScoreRow[] = uniqueMonthlyScores
        .map((score: any) => {
          const enrollment = normalizeText(score.enrollment_no);
          const name = nameMap.get(enrollment) || enrollment;
          const initials = typeof name === "string" && name.length > 0
            ? name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
            : enrollment.slice(0, 2).toUpperCase();

          return {
            id: normalizeText(score.id),
            enrollment_no: enrollment,
            points: Number(score.debate_score) || 0,
            name,
            initials,
            photo_url: undefined,
          };
        })
        .sort((a, b) => b.points - a.points);

      setScores(scoreRows);
      setCurrentPage(1); // Reset to page 1 when month changes
    } catch (error: any) {
      console.error("Error processing scores:", error);
      setScores([]);
    }
  }, [selectedMonth, cachedLeaderboardStats, cachedStudentsData]);

  const handleAddScore = async () => {
    if (!newScoreEnrollment || newScorePoints < 0 || !selectedMonth) {
      toast({
        variant: "destructive",
        title: "Invalid input",
        description: "Please select a student and enter a valid score",
      });
      return;
    }

    try {
      const response = await adminAPI.createScore({
        enrollment_no: newScoreEnrollment,
        points: newScorePoints,
        period: selectedMonth,
      });

      if (response.success) {
        toast({
          title: "Success",
          description: "Score added successfully",
        });
        setNewScoreEnrollment("");
        setNewScorePoints(0);
        setIsAddingScore(false);

        const scoresResponse = await adminAPI.getScores();
        if (scoresResponse.success) {
          const leaderboardStats = Array.isArray(scoresResponse.data.leaderboardStats) ? scoresResponse.data.leaderboardStats : [];
          setCachedLeaderboardStats(leaderboardStats);

          const monthsArr = buildMonthOptions(scoresResponse.data, leaderboardStats);
          setMonthOptions(monthsArr);
          if (monthsArr.length > 0 && !monthsArr.includes(selectedMonth)) {
            setSelectedMonth(monthsArr[0]);
          }
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: response.error || "Failed to add score",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add score",
      });
    }
  };

  const handleUpdateScore = async (id: string, newPoints: number) => {
    try {
      const response = await adminAPI.updateScore(id, { points: newPoints });

      if (response.success) {
        toast({
          title: "Success",
          description: "Score updated successfully",
        });
        setEditingId(null);

        const scoresResponse = await adminAPI.getScores();
        if (scoresResponse.success) {
          const leaderboardStats = Array.isArray(scoresResponse.data.leaderboardStats) ? scoresResponse.data.leaderboardStats : [];
          setCachedLeaderboardStats(leaderboardStats);

          const monthsArr = buildMonthOptions(scoresResponse.data, leaderboardStats);
          setMonthOptions(monthsArr);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: response.error || "Failed to update score",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update score",
      });
    }
  };

  return (
    <div className="space-y-3 max-w-full pl-6 md:pl-10 pr-4 -mt-2">
      {/* Month Selection Filter */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <h2 className="text-base sm:text-lg font-bold text-[#8B735B] shrink-0">
            Scores for
          </h2>
          {!canEdit && <p className="text-xs text-muted-foreground sm:ml-2">You have read-only access.</p>}
          <Select
            value={selectedMonth || ""}
            onValueChange={(value) => setSelectedMonth(value || null)}
            disabled={monthOptions.length === 0}
          >
            <SelectTrigger className="px-3 py-1.5 h-auto rounded-lg border-2 border-[#EAD8C0] bg-[#FAF7F2] text-[#8B735B] text-sm font-bold w-32 sm:w-auto hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#EAD8C0]/30">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent className="bg-[#FAF7F2] border-2 border-[#EAD8C0]">
              {monthOptions.map((month, index) => (
                <SelectItem 
                  key={`month-${index}`} 
                  value={month}
                  className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer text-[#8B735B] font-medium"
                >
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsAddingScore(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-full text-sm font-bold transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Score
          </button>
        )}
      </motion.div>

      {/* Add Score Form */}
      <AnimatePresence>
        {isAddingScore && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-4 sm:p-6 border-2 border-[#EAD8C0]/50 rounded-2xl bg-gradient-to-br from-[#FAF7F2]/30 to-stone-50/20 flex flex-col gap-4 max-w-4xl mx-auto w-full glass-card">
              <div className="flex flex-col md:flex-row gap-4 md:items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-bold text-[#8B735B]">Student Enrollment</label>
                  <Select
                    value={newScoreEnrollment}
                    onValueChange={(value) => setNewScoreEnrollment(value)}
                  >
                    <SelectTrigger className="w-full border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 h-auto rounded-lg text-sm text-[#8B735B] font-medium focus:outline-none focus:ring-2 focus:ring-[#EAD8C0]/20">
                      <SelectValue placeholder="Select Student" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#FAF7F2] border-2 border-[#EAD8C0]">
                      {cachedStudentsData.map((stu) => (
                        <SelectItem 
                          key={stu.enrollment_no} 
                          value={stu.enrollment_no}
                          className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer"
                        >
                          {stu.student_name} ({stu.enrollment_no})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-32 space-y-2">
                  <label className="text-sm font-bold text-[#8B735B]">Points</label>
                  <input
                    type="number"
                    min="0"
                    value={newScorePoints}
                    onChange={(e) => setNewScorePoints(Number(e.target.value))}
                    className="w-full border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 rounded-lg text-sm text-[#8B735B] font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddScore}
                    className="px-4 py-2 bg-teal-700 text-white rounded-full text-sm font-bold hover:bg-teal-800 transition-colors shadow-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsAddingScore(false)}
                    className="px-4 py-2 bg-stone-100 text-stone-600 rounded-full text-sm font-semibold hover:bg-stone-200 transition-colors border border-stone-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-6 items-start"
      >
        <div className="max-w-full flex-1">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-5 py-2 border-b-2 border-[#EAD8C0]/50 bg-gradient-to-r from-[#EAD8C0]/30 to-stone-100/30">
              <h2 className="flex items-center gap-2 text-xs font-bold text-[#8B735B] uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5 text-[#f97316]" /> Scores
                {selectedMonth && ` - ${selectedMonth}`}
              </h2>
            </div>
            <div className="flex border-b border-[#EAD8C0]/30 bg-[#FAF7F2]/50 px-5 py-1.5 gap-8">
              <span className="flex-1 text-[10px] font-bold text-[#8B735B]/60 uppercase tracking-wider">Student</span>
              <span className="w-20 text-center text-[10px] font-bold text-[#8B735B]/60 uppercase tracking-wider">Marks</span>
              {canEdit && <span className="w-16 text-center text-[10px] font-bold text-[#8B735B]/60 uppercase tracking-wider">Edit</span>}
            </div>
            <div className="divide-y divide-yellow-100/50">
              {loading ? (
                <div className="p-6 text-center text-muted-foreground">Loading scores...</div>
              ) : fetchError ? (
                <div className="p-6 text-center text-destructive text-sm">{fetchError}</div>
              ) : scores.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No scores found for this month.</div>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {scores.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((student, i) => (
                      <motion.div
                        key={`${student.enrollment_no}-${i}`}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ layout: { duration: 0.3 } }}
                        className={`flex items-center gap-8 px-5 py-1.5 border-b border-[#EAD8C0]/20 hover:bg-[#EAD8C0]/10 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F2]/50'}`}
                      >
                        <StudentAvatar
                          name={student.name}
                          enrollmentNo={student.enrollment_no}
                          photoUrl={student.photo_url}
                          className="w-8 h-8 shrink-0 ml-1"
                          fallbackClassName="bg-[#EAD8C0]/30 text-[#8B735B] text-[10px] font-medium"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#8B735B]">{student.name}</p>
                          <p className="text-xs text-[#8B735B]/70">{student.enrollment_no}</p>
                        </div>

                        <div className="w-20 flex justify-center">
                          {editingId === student.id ? (
                            <input
                              type="number"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(Number(e.target.value))}
                              className="w-16 border-2 border-[#EAD8C0] px-1 py-0.5 rounded text-xs text-center font-bold focus:outline-none focus:border-[#8B735B]"
                              autoFocus
                            />
                          ) : (
                            <motion.span
                              key={student.points}
                              initial={{ scale: 1.15, color: "#8B735B" }}
                              animate={{ scale: 1, color: "#8B735B" }}
                              transition={{ duration: 0.2 }}
                              className="font-mono text-sm font-bold text-[#8B735B] bg-[#EAD8C0]/30 px-2 py-0.5 rounded"
                            >
                              {student.points}
                            </motion.span>
                          )}
                        </div>

                        {canEdit && (
                          <div className="w-16 flex justify-center gap-1">
                            {editingId === student.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdateScore(student.id, editValue)}
                                  className="p-1 text-green-700 hover:bg-green-100 rounded transition-colors"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 text-red-700 hover:bg-red-100 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingId(student.id);
                                  setEditValue(student.points);
                                }}
                                className="p-1 text-muted-foreground hover:text-[#8B735B] hover:bg-[#EAD8C0]/20 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Footer with Pagination and Add Score */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[#EAD8C0]/20 bg-[#FAF7F2]/50">
                    <div className="text-sm text-muted-foreground hidden sm:block">
                      Showing {Math.min((currentPage - 1) * itemsPerPage + 1, scores.length)}-{Math.min(currentPage * itemsPerPage, scores.length)} of {scores.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ←
                      </button>
                      {Array.from({ length: Math.ceil(scores.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2 py-1 rounded text-sm ${currentPage === page
                              ? 'bg-teal-700 text-white font-bold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-[#EAD8C0]/20'
                            }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(scores.length / itemsPerPage), p + 1))}
                        disabled={currentPage === Math.ceil(scores.length / itemsPerPage)}
                        className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        →
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground hidden md:block">
                        Page {currentPage} of {Math.ceil(scores.length / itemsPerPage)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="hidden lg:flex flex-col items-end justify-center pt-36 pr-12 flex-[0.3]">
          <img src="/Score1.jpg" alt="Scores" className="max-w-xs rounded-lg shadow-[0_0_50px_rgba(234,216,192,1),0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#EAD8C0] transform hover:scale-[1.02] transition-transform duration-500" />        </div>
      </motion.div>
    </div>
  );
}