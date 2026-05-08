import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Clock, 
  CalendarCheck, 
  Calendar, 
  Award,
  ChevronDown,
  Star,
  Activity,
  ChevronLeft,
  ChevronRight,
  Info,
  TrendingUp,
  Target,
  Trophy
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Cell, LabelList
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getStoredUser } from "@/lib/auth";
import { adminAPI } from "@/lib/adminApi";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthNavigator({ 
  selectedMonth, 
  onMonthChange, 
  selectedYear, 
  setSelectedYear 
}: { 
  selectedMonth: string, 
  onMonthChange: (m: string) => void, 
  selectedYear: number, 
  setSelectedYear: (y: number) => void 
}) {
  return (
    <div className="bg-[#EAE1D2]/40 backdrop-blur-md border border-[#D4C9B6]/60 p-1 rounded-full shadow-sm flex items-center justify-between gap-1 w-full relative z-20 mb-2">
      {/* Left: Year Navigator */}
      <div className="flex items-center gap-1 shrink-0 px-2 sm:px-3">
        <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 hover:bg-[#D4C9B6]/40 rounded-full transition-colors text-[#8B8476] hover:text-[#21493A]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-[#21493A] w-10 text-center">{selectedYear}</span>
        <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 hover:bg-[#D4C9B6]/40 rounded-full transition-colors text-[#8B8476] hover:text-[#21493A]">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center: All Months Row */}
      <div className="flex-1 flex items-center justify-between gap-0.5 sm:gap-1 px-1 md:px-2">
        {MONTHS.map(month => {
          const isActive = selectedMonth === month;
          return (
            <button
              key={month}
              onClick={() => onMonthChange(month)}
              className={`flex-1 px-1 sm:px-2 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-300 text-center ${
                isActive 
                  ? "bg-[#1A3B2F] text-white shadow-md" 
                  : "text-[#8B8476] hover:text-[#1A3B2F] hover:bg-[#D4C9B6]/30"
              }`}
            >
              {month}
            </button>
          )
        })}
      </div>

      {/* Right: Dropdown Picker */}
      <div className="shrink-0 pr-1">
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-2 sm:p-2.5 bg-white/50 hover:bg-white border border-[#D4C9B6]/50 text-[#1A3B2F] rounded-full shadow-sm transition-colors">
              <Calendar className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3 rounded-2xl bg-[#fdfdfc] border-[#D4C9B6] shadow-xl">
             <div className="grid grid-cols-3 gap-2">
               {MONTHS.map(month => (
                 <button
                   key={month}
                   onClick={() => onMonthChange(month)}
                   className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
                     selectedMonth === month 
                       ? "bg-[#1A3B2F] text-white" 
                       : "hover:bg-[#EAE1D2]/50 text-[#8B8476]"
                   }`}
                 >
                   {month}
                 </button>
               ))}
             </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = getStoredUser();
  const [selectedMonth, setSelectedMonth] = useState("May");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [isAnimating, setIsAnimating] = useState(false);

  // Data States
  const [totalStudents, setTotalStudents] = useState(0);
  const [hoursDedicated, setHoursDedicated] = useState(0);
  const [sessionsConducted, setSessionsConducted] = useState(0);
  const [academicLead, setAcademicLead] = useState<any>({ name: "Loading...", score: 0 });
  const [topContributor, setTopContributor] = useState<any>({ name: "Loading...", hours: 0 });

  const [cumulativeData, setCumulativeData] = useState<any[]>([]);
  const [monthlyScores, setMonthlyScores] = useState<any[]>([]);
  const [topScoreTrend, setTopScoreTrend] = useState<any[]>([]);
  const [timeDedication, setTimeDedication] = useState<any[]>([]);
  const [prevHoursDedicated, setPrevHoursDedicated] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentMonthIdx = MONTHS.indexOf(selectedMonth);
        const apiMonth = currentMonthIdx + 1;

        const [
          studentsResponse, 
          activitiesResponse, 
          leaderboardResponse,
          monthlyResponse
        ] = await Promise.all([
          adminAPI.getStudents().catch(() => ({ success: false, data: [] })),
          adminAPI.getActivities().catch(() => ({ success: false, data: [] })),
          adminAPI.getLeaderboard().catch(() => ({ leaderboard: [] })),
          adminAPI.getMonthlyLeaderboard(apiMonth, selectedYear).catch(() => ({ leaderboard: [] }))
        ]);

        let nameMap: Record<string, string> = {};
        
        // --- Process Students ---
        if (studentsResponse.success && Array.isArray(studentsResponse.data)) {
          const visibleStudents = studentsResponse.data.filter(
            (student: any) => String(student.member_type || "member").toLowerCase() !== "admin"
          );
          setTotalStudents(visibleStudents.length);
          
          visibleStudents.forEach((student: any) => {
            const en = String(student.enrollment_no || "").trim();
            if (en) nameMap[en] = String(student.student_name || "").trim();
          });
        }
        
        // --- Process Sessions ---
        if (activitiesResponse.success && Array.isArray(activitiesResponse.data)) {
          setSessionsConducted(activitiesResponse.data.length);
        }

        const formatName = (fullName: string) => fullName.split(" ").slice(0, 2).join(" ");
        const isValidMember = (s: any) => String(s.role || s.member_type || "member").toLowerCase() !== "admin";

        // --- Process Cumulative Leaderboard (Graph 1) ---
        if (leaderboardResponse && Array.isArray(leaderboardResponse.leaderboard)) {
          const formattedCumulative = leaderboardResponse.leaderboard
            .filter(isValidMember)
            .slice(0, 5)
            .map((s: any) => {
              const fullName = s.student_name || s.name || nameMap[s.enrollment_no] || s.enrollment_no;
              return { 
                name: formatName(fullName), 
                score: Math.round(Number(s.debate_score || s.points || s.total_score || 0)), 
                originalName: fullName,
                image: s.image || s.photo_url || s.photoUrl || s.photo
              };
            });
          setCumulativeData(formattedCumulative);
        }

        // --- Process Monthly Leaderboard (Graph 2 & Academic Lead MVP) ---
        if (monthlyResponse && Array.isArray(monthlyResponse.leaderboard)) {
          const formattedMonthly = monthlyResponse.leaderboard
            .filter(isValidMember)
            .slice(0, 5)
            .map((s: any) => {
              const fullName = s.student_name || s.name || nameMap[s.enrollment_no] || s.enrollment_no;
              return { 
                name: formatName(fullName), 
                score: Math.round(Number(s.debate_score || s.points || s.total_score || s.monthly_score || 0)), 
                originalName: fullName,
                image: s.image || s.photo_url || s.photoUrl || s.photo
              };
            });
            
          if (formattedMonthly.length > 0) {
            setMonthlyScores(formattedMonthly);
            setAcademicLead(formattedMonthly[0]);
          } else {
            setAcademicLead({ name: "No Data", score: 0 });
            setMonthlyScores([]);
          }
        } else {
            setAcademicLead({ name: "No Data", score: 0 });
            setMonthlyScores([]);
        }

        // --- Fetch 6-Month Trend for Graph 2 ---
        const trendPromises = [];
        const trendLabels: string[] = [];
        for (let i = 5; i >= 0; i--) {
          let m = currentMonthIdx - i;
          let y = selectedYear;
          if (m < 0) { m += 12; y -= 1; }
          trendLabels.push(`${MONTHS[m]} ${y}`);
          trendPromises.push(adminAPI.getMonthlyLeaderboard(m + 1, y).catch(() => ({ leaderboard: [] })));
        }
        
        const trendResponses = await Promise.all(trendPromises);
        const newTrendData = trendResponses.map((res, idx) => {
          let topScore = 0;
          if (res && Array.isArray(res.leaderboard) && res.leaderboard.length > 0) {
            const topStudent = res.leaderboard.filter(isValidMember)[0];
            if (topStudent) {
              topScore = Number(topStudent.debate_score || topStudent.points || topStudent.total_score || topStudent.monthly_score || 0);
            }
          }
          return { month: trendLabels[idx], score: Math.round(topScore) };
        });
        setTopScoreTrend(newTrendData);

        // --- Process Top Hours (Graph 3 & Top Contributor MVP) ---
        // Backend top-hours endpoint doesn't support month filtering, so we sort monthlyResponse by hours
        let sourceHours = [];
        if (monthlyResponse && Array.isArray(monthlyResponse.leaderboard)) {
            sourceHours = [...monthlyResponse.leaderboard].sort((a: any, b: any) => {
                const aHours = parseFloat(a.hours || a.total_hours || "0") || 0;
                const bHours = parseFloat(b.hours || b.total_hours || "0") || 0;
                return bHours - aHours;
            });
        }

        if (sourceHours.length > 0) {
          const formattedHours = sourceHours
            .filter(isValidMember)
            .slice(0, 5)
            .map((s: any, index: number) => {
              const fullName = s.student_name || s.name || nameMap[s.enrollment_no] || s.enrollment_no;
              const fills = ["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"];
              return { 
                name: formatName(fullName), 
                hours: parseFloat(s.hours || s.total_hours || "0") || 0, 
                fill: fills[index] || "#ccfbf1", 
                originalName: fullName,
                image: s.image || s.photo_url || s.photoUrl || s.photo
              };
            });
            
          if (formattedHours.length > 0) {
            setTimeDedication(formattedHours);
            setTopContributor({ name: formattedHours[0].originalName, hours: formattedHours[0].hours, image: formattedHours[0].image });
            
            const total = sourceHours.reduce((sum: number, s: any) => sum + (parseFloat(s.hours || s.total_hours || "0") || 0), 0);
            setHoursDedicated(total);
          } else {
            setTimeDedication([{ name: "No Data", hours: 0, fill: "#ccfbf1" }]);
            setTopContributor({ name: "No Data", hours: 0 });
            setHoursDedicated(0);
          }
        } else {
            setTimeDedication([{ name: "No Data", hours: 0, fill: "#ccfbf1" }]);
            setTopContributor({ name: "No Data", hours: 0 });
            setHoursDedicated(0);
        }
        
        // --- Fetch Previous Month Hours for % Change ---
        let prevMonthIdx = currentMonthIdx - 1;
        let prevYear = selectedYear;
        if (prevMonthIdx < 0) { prevMonthIdx = 11; prevYear -= 1; }
        const prevMonthResponse = await adminAPI.getMonthlyLeaderboard(prevMonthIdx + 1, prevYear).catch(() => ({ leaderboard: [] }));
        if (prevMonthResponse && Array.isArray(prevMonthResponse.leaderboard)) {
          const prevTotal = prevMonthResponse.leaderboard.reduce((sum: number, s: any) => sum + (parseFloat(s.hours || s.total_hours || "0") || 0), 0);
          setPrevHoursDedicated(prevTotal);
        } else {
          setPrevHoursDedicated(0);
        }

      } catch (error) {
        console.error("Dashboard fetch error:", error);
      }
    };
    fetchData();
  }, [selectedMonth, selectedYear]);

  const handleMonthChange = (m: string) => {
    if (m === selectedMonth) return;
    setIsAnimating(true);
    setSelectedMonth(m);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const currentMonthTop = topScoreTrend.length > 0 ? topScoreTrend[topScoreTrend.length - 1].score : 0;
  const previousMonthTop = topScoreTrend.length > 1 ? topScoreTrend[topScoreTrend.length - 2].score : 0;
  
  let topScoreChange = 0;
  if (previousMonthTop > 0) {
    topScoreChange = ((currentMonthTop - previousMonthTop) / previousMonthTop) * 100;
  }
  
  const avgTopScore = topScoreTrend.length > 0 ? Math.round(topScoreTrend.reduce((acc, curr) => acc + curr.score, 0) / topScoreTrend.length) : 0;

  let hoursChange = 0;
  if (prevHoursDedicated > 0) {
    hoursChange = ((hoursDedicated - prevHoursDedicated) / prevHoursDedicated) * 100;
  }


  return (
    <div className="flex flex-col gap-3 sm:gap-4 max-w-7xl animate-in fade-in duration-700 pb-2 relative z-0">
      <MonthNavigator 
        selectedMonth={selectedMonth} 
        onMonthChange={handleMonthChange} 
        selectedYear={selectedYear} 
        setSelectedYear={setSelectedYear} 
      />

      <motion.div 
        animate={{ opacity: isAnimating ? 0.3 : 1, filter: isAnimating ? "blur(4px)" : "blur(0px)" }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:gap-4"
      >
        {/* Row 1: Performance Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[1rem] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:bg-white/70 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-amber-500/20 transition-colors" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-amber-100/50">
              <Users className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Students</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{totalStudents}</span>
            <span className="text-xs font-bold text-amber-600 mb-1 flex items-center">Total</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[1rem] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:bg-white/70 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-teal-500/20 transition-colors" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-teal-100/50">
              <Clock className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hours Dedicated</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{hoursDedicated.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-500 mb-1">Hrs</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[1rem] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:bg-white/70 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-indigo-500/20 transition-colors" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-indigo-100/50">
              <CalendarCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sessions Conducted</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{sessionsConducted}</span>
            <span className="text-xs font-bold text-slate-500 mb-1">Sessions</span>
          </div>
        </motion.div>
      </div>

      {/* Row 2: Monthly MVPs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[1rem] p-3 sm:p-4 shadow-lg shadow-amber-900/5 relative overflow-hidden flex items-center justify-between gap-3 text-left"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-br from-amber-200/30 to-yellow-400/10 rounded-full blur-3xl" />
          
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-600 shadow-lg">
                <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                  <img src={academicLead?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(academicLead?.originalName || academicLead?.name || "No Data")}&background=random`} alt={academicLead?.name} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-amber-100">
                <Award className="w-3 h-3 text-amber-500" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 mb-0.5 flex items-center gap-1 truncate">
                Academic Lead
              </p>
              <h2 className="text-base font-black text-slate-800 tracking-tight leading-none mt-0.5 truncate">{academicLead?.originalName || academicLead?.name}</h2>
            </div>
          </div>

          <div className="relative z-10 shrink-0 pl-3 sm:pl-4 border-l border-amber-200/50 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1 text-amber-500 mb-0.5">
              <Star className="w-3 h-3 fill-amber-500" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-amber-600 leading-none">{academicLead?.score}</span>
            <span className="text-[9px] sm:text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mt-0.5">Points</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[1rem] p-3 sm:p-4 shadow-lg shadow-teal-900/5 relative overflow-hidden flex items-center justify-between gap-3 text-left"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-br from-teal-200/30 to-emerald-400/10 rounded-full blur-3xl" />
          
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-teal-400 via-emerald-200 to-teal-600 shadow-lg">
                <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                  <img src={topContributor?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(topContributor?.originalName || topContributor?.name || "No Data")}&background=random`} alt={topContributor?.name} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-teal-100">
                <Activity className="w-3 h-3 text-teal-500" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-600 mb-0.5 flex items-center gap-1 truncate">
                 Top Contributor
              </p>
              <h2 className="text-base font-black text-slate-800 tracking-tight leading-none mt-0.5 truncate">{topContributor?.name}</h2>
            </div>
          </div>

          <div className="relative z-10 shrink-0 pl-3 sm:pl-4 border-l border-teal-200/50 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1 text-teal-500 mb-0.5">
              <Clock className="w-3 h-3" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-teal-600 leading-none">{Number(topContributor?.hours).toFixed(1)}</span>
            <span className="text-[9px] sm:text-[10px] font-bold text-teal-600/70 uppercase tracking-wider mt-0.5">Hours</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Graph 1: Top 5 Cumulative Researchers */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-[1rem] p-4 shadow-sm min-w-0 flex flex-col relative"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              Top 5 Researchers
            </h3>
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-semibold mb-3">
            Total Research Contributions <Info className="w-3 h-3 ml-0.5" />
          </div>

          <div className="h-[170px] w-full shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cumulativeData.length > 0 ? cumulativeData : [{name: "No Data", score: 0}]} margin={{ top: 45, right: 0, left: 0, bottom: 45 }}>
                <defs>
                  <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#fcd34d" stopOpacity={0.8}/>
                  </linearGradient>
                  <clipPath id="avatarClip">
                    <circle cx="0" cy="20" r="15" />
                  </clipPath>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const nameParts = payload.value.split(" ");
                    const studentData = cumulativeData.find(s => s.name === payload.value);
                    const imgUrl = studentData?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.value)}&background=random&rounded=true`;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <image x={-15} y={5} width={30} height={30} href={imgUrl} clipPath="url(#avatarClip)" />
                        <text x={0} y={45} textAnchor="middle" fill="#334155" fontSize={10} fontWeight={800}>{nameParts[0]}</text>
                        <text x={0} y={57} textAnchor="middle" fill="#334155" fontSize={10} fontWeight={800}>{nameParts[1] || ""}</text>
                      </g>
                    );
                  }} 
                  interval={0}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dx={-10} width={30} />
                <Bar dataKey="score" fill="url(#colorOrange)" radius={[8, 8, 0, 0]} barSize={40}>
                  <LabelList 
                    dataKey="score" 
                    position="top" 
                    content={(props: any) => {
                      const { x, y, value, index } = props;
                      const colors = ["#fbbf24", "#94a3b8", "#b45309"];
                      return (
                        <g transform={`translate(${x + 20},${y - 12})`}>
                          {index < 3 && (
                            <svg width="24" height="24" x="-12" y="-32" viewBox="0 0 24 24" fill={colors[index]} opacity="0.8">
                              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                            </svg>
                          )}
                          <text x={0} y={0} fill="#1e293b" fontSize={12} fontWeight={900} textAnchor="middle">{value}</text>
                        </g>
                      );
                    }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 bg-[#F8FAF9] rounded-xl p-2 flex items-center justify-between border border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100/50 flex items-center justify-center text-amber-600"><Users className="w-3 h-3" /></div>
              <div>
                <p className="text-[9px] text-slate-500 font-bold uppercase">Total Researchers</p>
                <p className="text-sm font-black text-slate-800 leading-none">{totalStudents}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-600 flex items-center justify-end gap-0.5"><TrendingUp className="w-3.5 h-3.5" /> 12.4%</p>
              <p className="text-[10px] text-slate-400 font-bold">vs Mar 2026</p>
            </div>
          </div>
        </motion.div>

        {/* Graph 2: Monthly Top Scores Trend */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-[1rem] p-4 shadow-sm min-w-0 flex flex-col relative"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Monthly Top Scores
            </h3>
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-semibold mb-3">
            Top Score Trend (Points) <Info className="w-3 h-3 ml-0.5" />
          </div>

          <div className="h-[170px] w-full shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={topScoreTrend} margin={{ top: 20, right: 10, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={(props: any) => {
                    const { x, y, payload } = props;
                    const parts = payload.value.split(" ");
                    return (
                      <g transform={`translate(${x},${y+10})`}>
                        <text x={0} y={0} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={700}>{parts[0]}</text>
                        <text x={0} y={12} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>{parts[1]}</text>
                      </g>
                    );
                  }} dy={10} interval={0} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dx={-10} width={30} />
                <RechartsTooltip cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 600 }} />
                <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGreen)" activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} >
                   <LabelList dataKey="score" position="top" offset={10} style={{ fill: '#1e293b', fontSize: 11, fontWeight: 800 }} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 bg-[#F8FAF9] rounded-xl p-2 flex items-center justify-between border border-slate-100">
            <div>
              <p className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-0.5"><Award className="w-3 h-3 text-emerald-600" /> Top Score ({selectedMonth})</p>
              <p className="text-sm font-black text-slate-800 leading-none mt-0.5">{currentMonthTop} <span className="text-[9px] text-slate-500">pts</span></p>
            </div>
            <div className="px-2 border-x border-slate-200">
              <p className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-0.5"><TrendingUp className="w-3 h-3 text-emerald-600" /> Change</p>
              <p className={`text-[11px] font-bold mt-0.5 ${topScoreChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {topScoreChange >= 0 ? "↑" : "↓"} {Math.abs(topScoreChange).toFixed(1)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-500 font-bold uppercase flex items-center justify-end gap-0.5"><Target className="w-3 h-3 text-emerald-600" /> Avg</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{avgTopScore} <span className="text-[9px] text-slate-500">pts</span></p>
            </div>
          </div>
        </motion.div>

        {/* Graph 3: Top Hours Dedicated */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-[1rem] p-4 shadow-sm min-w-0 flex flex-col relative"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Top Hours Dedicated
            </h3>
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-semibold mb-3">
            Total Hours Contributed <Info className="w-3 h-3 ml-0.5" />
          </div>

          <div className="h-[170px] w-full flex flex-col justify-between py-1 shrink-0">
            {timeDedication.slice(0, 5).map((item, i) => {
              const maxHours = timeDedication[0]?.hours || 1;
              const percent = Math.min(100, (item.hours / maxHours) * 100);
              
              let rankColor = "bg-slate-200 text-slate-600";
              if (i === 0) rankColor = "bg-amber-400 text-white shadow-md shadow-amber-400/20";
              if (i === 1) rankColor = "bg-slate-300 text-white shadow-md shadow-slate-300/20";
              if (i === 2) rankColor = "bg-orange-400 text-white shadow-md shadow-orange-400/20";

              return (
                <div key={i} className="flex items-center gap-2 w-full">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${rankColor}`}>
                    {i + 1}
                  </div>
                  <img src={item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`} alt={item.name} className="w-6 h-6 rounded-full border border-slate-100 shadow-sm shrink-0 object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-extrabold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[11px] font-black text-indigo-600 shrink-0">{item.hours.toFixed(1)} Hrs</p>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 bg-[#F8FAF9] rounded-xl p-2 flex items-center justify-between border border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-100/50 flex items-center justify-center text-indigo-600"><Clock className="w-3 h-3" /></div>
              <div>
                <p className="text-[9px] text-slate-500 font-bold uppercase">Total Hours</p>
                <p className="text-sm font-black text-slate-800 leading-none">{hoursDedicated.toFixed(1)} Hrs</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold flex items-center justify-end gap-0.5 ${hoursChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                <TrendingUp className={`w-3.5 h-3.5 ${hoursChange < 0 && "rotate-180"}`} /> {Math.abs(hoursChange).toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 font-bold">vs Prev Month</p>
            </div>
          </div>
        </motion.div>
      </div>
      </motion.div>
    </div>
  );
}
