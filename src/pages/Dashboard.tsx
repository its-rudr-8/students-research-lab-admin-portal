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
  Trophy,
  HelpCircle,
  Crown,
  ArrowUpRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Cell, LabelList, LineChart, Line
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Particles from "@/components/ui/Particles";
import { getStoredUser } from "@/lib/auth";
import { adminAPI } from "@/lib/adminApi";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GRN = "linear-gradient(135deg,#1e4a34,#122a1e)";
const DARK_GRN = "#1a3a2a";
const BORDER = "#e0dbd2";
const SHADOW = "0 6px 32px rgba(26,74,52,0.08)";


function Dashboard() {
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
  const [researchCount, setResearchCount] = useState(0);
  const [recentAchievements, setRecentAchievements] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentMonthIdx = MONTHS.indexOf(selectedMonth);
        const apiMonth = currentMonthIdx + 1;

        const [
          studentsResponse, 
          activitiesResponse, 
          leaderboardResponse,
          monthlyResponse,
          researchResponse,
          achievementsResponse
        ] = await Promise.all([
          adminAPI.getStudents().catch(() => ({ success: false, data: [] })),
          adminAPI.getActivities().catch(() => ({ success: false, data: [] })),
          adminAPI.getLeaderboard().catch(() => ({ leaderboard: [] })),
          adminAPI.getMonthlyLeaderboard(apiMonth, selectedYear).catch(() => ({ leaderboard: [] })),
          adminAPI.getResearch().catch(() => ({ success: false, data: [] })),
          adminAPI.getAchievements().catch(() => ({ success: false, data: [] }))
        ]);

        let nameMap: Record<string, string> = {};
        
        const studentList = Array.isArray(studentsResponse) ? studentsResponse : studentsResponse?.data;
        if (Array.isArray(studentList)) {
          const visibleStudents = studentList.filter(
            (student: any) => String(student.role || student.member_type || "member").toLowerCase() !== "admin"
          );
          setTotalStudents(visibleStudents.length);
          visibleStudents.forEach((student: any) => {
            const en = String(student.enrollment_no || "").trim();
            if (en) nameMap[en] = String(student.student_name || "").trim();
          });
        }
        
        const activityList = Array.isArray(activitiesResponse) ? activitiesResponse : activitiesResponse?.data;
        if (Array.isArray(activityList)) setSessionsConducted(activityList.length);

        const researchList = Array.isArray(researchResponse) ? researchResponse : researchResponse?.data;
        if (Array.isArray(researchList)) setResearchCount(researchList.length);

        const achieveList = Array.isArray(achievementsResponse) ? achievementsResponse : achievementsResponse?.data;
        if (Array.isArray(achieveList)) setRecentAchievements(achieveList.slice(0, 3));

        const formatName = (fullName: string) => fullName; // Preserve full name
        const isValidMember = (s: any) => String(s.role || s.member_type || "member").toLowerCase() !== "admin";

        const rawCumulative = leaderboardResponse?.leaderboard || (Array.isArray(leaderboardResponse) ? leaderboardResponse : []);
        if (Array.isArray(rawCumulative)) {
          const map = new Map();
          rawCumulative.forEach(s => {
            const id = s.enrollment_no || s.student_name || s.name;
            const score = Number(s.debate_score || s.points || s.total_score || 0);
            if (!map.has(id)) map.set(id, { ...s, score });
            else map.get(id).score += score;
          });
          const aggregatedCumulative = Array.from(map.values()).sort((a, b) => b.score - a.score);
          const formattedCumulative = aggregatedCumulative.filter(isValidMember).slice(0, 5).map((s: any) => {
            const fullName = s.student_name || s.name || nameMap[s.enrollment_no] || s.enrollment_no;
            return { name: formatName(fullName), score: Math.round(s.score), originalName: fullName, image: s.image || s.photo_url || s.photoUrl || s.photo };
          });
          setCumulativeData(formattedCumulative);
        }

        const rawMonthly = monthlyResponse?.leaderboard || (Array.isArray(monthlyResponse) ? monthlyResponse : []);
        const monthlyList = Array.isArray(rawMonthly) ? (() => {
          const map = new Map();
          rawMonthly.forEach(s => {
            const id = s.enrollment_no || s.student_name || s.name;
            const score = Number(s.debate_score || s.points || s.total_score || s.monthly_score || 0);
            const hours = parseFloat(s.hours || s.total_hours || s.monthly_hours || "0") || 0;
            if (!map.has(id)) map.set(id, { ...s, score, hours });
            else {
              const ex = map.get(id);
              ex.score += score;
              ex.hours += hours;
            }
          });
          return Array.from(map.values());
        })() : [];

        if (monthlyList.length > 0) {
          const formattedMonthly = [...monthlyList]
            .filter(isValidMember)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((s: any, idx: number) => {
              const fullName = s.student_name || s.name || nameMap[s.enrollment_no] || s.enrollment_no;
              return { 
                name: formatName(fullName), 
                score: Math.round(s.score), 
                originalName: fullName, 
                image: s.image || s.photo_url || s.photoUrl || s.photo,
                rank: idx + 1
              };
            });
          if (formattedMonthly.length > 0) {
            setMonthlyScores(formattedMonthly);
            setAcademicLead(formattedMonthly[0]);
          } else {
            setAcademicLead({ name: "No Data", score: 0 });
            setMonthlyScores([]);
          }
        }

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
          const list = res?.leaderboard || (Array.isArray(res) ? res : []);
          if (Array.isArray(list) && list.length > 0) {
            const map = new Map();
            list.filter(isValidMember).forEach(s => {
              const id = s.enrollment_no || s.student_name || s.name;
              const score = Number(s.debate_score || s.points || s.total_score || s.monthly_score || 0);
              map.set(id, (map.get(id) || 0) + score);
            });
            const scores = Array.from(map.values());
            if (scores.length > 0) topScore = Math.max(...scores);
          }
          return { month: trendLabels[idx], score: Math.round(topScore) };
        });
        setTopScoreTrend(newTrendData);

        if (monthlyList.length > 0) {
          const formattedHours = [...monthlyList]
            .filter(isValidMember)
            .sort((a: any, b: any) => (b.hours || 0) - (a.hours || 0))
            .slice(0, 5)
            .map((s: any, index: number) => {
              const fullName = s.student_name || s.name || nameMap[s.enrollment_no] || s.enrollment_no;
              return { name: formatName(fullName), hours: s.hours || 0, fill: ["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"][index] || "#ccfbf1", originalName: fullName, image: s.image || s.photo_url || s.photoUrl || s.photo };
            });
          if (formattedHours.length > 0) {
            setTimeDedication(formattedHours);
            setTopContributor({ name: formattedHours[0].originalName, hours: formattedHours[0].hours, image: formattedHours[0].image });
            setHoursDedicated(monthlyList.reduce((sum: number, s: any) => sum + (s.hours || 0), 0));
          }
        }
        
        let prevMonthIdx = currentMonthIdx - 1;
        let prevYear = selectedYear;
        if (prevMonthIdx < 0) { prevMonthIdx = 11; prevYear -= 1; }
        const prevRes = await adminAPI.getMonthlyLeaderboard(prevMonthIdx + 1, prevYear).catch(() => ({ leaderboard: [] }));
        const prevList = prevRes?.leaderboard || (Array.isArray(prevRes) ? prevRes : []);
        setPrevHoursDedicated(Array.isArray(prevList) ? prevList.reduce((sum: number, s: any) => sum + (parseFloat(s.hours || s.total_hours || "0") || 0), 0) : 0);

      } catch (error) { console.error("Dashboard error:", error); }
    };
    fetchData();
  }, [selectedMonth, selectedYear]);

  const handleMonthChange = (m: string) => {
    if (m === selectedMonth) return;
    setIsAnimating(true);
    setSelectedMonth(m);
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <div className="flex flex-col gap-3 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-2 px-4 h-[calc(100vh-100px)] overflow-hidden font-sans">
      <motion.div 
        animate={{ opacity: isAnimating ? 0.4 : 1, filter: isAnimating ? "blur(4px)" : "blur(0px)" }}
        initial={{ opacity: 0, y: 10 }} 
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 h-full"
        style={{ fontFamily: "'Inter','Plus Jakarta Sans',sans-serif" }}
      >
        {/* Month Navigator: Students Section Tab Theme */}
        <div className="flex items-center justify-between bg-[#f8f6f1] border border-[#e0dbd2] rounded-full p-1.5 px-4 shadow-sm">
          <div className="flex items-center gap-1">
            <button onClick={() => setSelectedYear(y => y - 1)} className="p-1.5 hover:bg-[#1a3a2a]/10 rounded-full transition-colors"><ChevronLeft className="w-3.5 h-3.5 text-[#6a6050]" /></button>
            <span className="text-xs font-black text-[#1a3a2a] tracking-tight w-10 text-center">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className="p-1.5 hover:bg-[#1a3a2a]/10 rounded-full transition-colors"><ChevronRight className="w-3.5 h-3.5 text-[#6a6050]" /></button>
          </div>
          
          <div className="flex gap-1 flex-1 justify-center px-4">
            {MONTHS.map((m) => (
              <button 
                key={m} 
                onClick={() => handleMonthChange(m)} 
                className={`px-4 py-2 rounded-full text-[10px] font-bold transition-all ${
                  selectedMonth === m 
                    ? "bg-[#1a3a2a] text-white shadow-lg shadow-[#1a3a2a]/20" 
                    : "text-[#6a6050] hover:text-[#1a3a2a] hover:bg-white/40"
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1a3a2a]/5 border border-[#1a3a2a]/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Top Section: Refined Grid */}
        <div className="grid grid-cols-12 gap-4 h-[154px]">
          <div className="col-span-8 flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 flex-1">
              {[
                { label: "Students", val: totalStudents, icon: Users, color: "text-amber-500", bg: "bg-amber-50" },
                { label: "Hours", val: hoursDedicated.toLocaleString(), icon: Clock, color: "text-emerald-500", bg: "bg-emerald-50" },
                { label: "Sessions", val: sessionsConducted, icon: CalendarCheck, color: "text-indigo-500", bg: "bg-indigo-50" }
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_6px_32px_rgba(26,74,52,0.06)] flex flex-col justify-center relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className={`absolute top-0 right-0 w-12 h-12 ${kpi.bg} rounded-bl-3xl opacity-20 -mr-2 -mt-2 transition-transform group-hover:scale-110`} />
                  <div className="flex items-center gap-2 mb-1.5">
                    <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</h3>
                  </div>
                  <p className="text-2xl font-black text-slate-800 leading-none">{kpi.val}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1">
              <div className="bg-white border border-slate-100 rounded-2xl p-3 px-4 shadow-[0_6px_32px_rgba(26,74,52,0.06)] flex items-center justify-between group hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={academicLead?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(academicLead?.name || "L")}&background=random`} className="w-10 h-10 rounded-full border-2 border-white shadow-md" alt="" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center">
                      <Star className="w-2 h-2 text-white fill-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-bold uppercase text-amber-500 tracking-widest leading-none mb-1.5">Academic Lead</p>
                    <h2 className="text-[13px] font-black text-slate-800 truncate max-w-[180px]">{academicLead?.originalName || academicLead?.name}</h2>
                  </div>
                </div>
                <div className="text-right border-l border-slate-100 pl-6">
                  <p className="text-xl font-black text-slate-800 leading-none">{academicLead?.score}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Points</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-3 px-4 shadow-[0_6px_32px_rgba(26,74,52,0.06)] flex items-center justify-between group hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={topContributor?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(topContributor?.name || "C")}&background=random`} className="w-10 h-10 rounded-full border-2 border-white shadow-md" alt="" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
                      <TrendingUp className="w-2 h-2 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-bold uppercase text-emerald-500 tracking-widest leading-none mb-1.5">Top Contributor</p>
                    <h2 className="text-[13px] font-black text-slate-800 truncate max-w-[180px]">{topContributor?.name}</h2>
                  </div>
                </div>
                <div className="text-right border-l border-slate-100 pl-6">
                  <p className="text-xl font-black text-slate-800 leading-none">{Number(topContributor?.hours).toFixed(1)}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Hours</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Block: Luxury Impact Suite - Pastel Theme with Particles */}
          <div className="col-span-4 bg-[#f8f6f1] border border-[#e0dbd2] rounded-2xl p-5 shadow-[0_6px_24px_rgba(26,58,42,0.04)] relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute inset-0 z-0">
              <Particles
                particleCount={150}
                particleSpread={10}
                speed={0.15}
                particleColors={['#1a3a2a', '#6a6050', '#e0dbd2']}
                moveParticlesOnHover={false}
                alphaParticles={true}
                particleBaseSize={80}
                disableRotation={false}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-y-7 gap-x-4 relative z-10">
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-serif font-black text-[#1a3a2a]">4<span className="text-sm text-[#1a3a2a]/40 ml-0.5">+</span></span>
                </div>
                <p className="text-[9px] font-black text-[#6a6050] uppercase tracking-[0.2em] mt-1">Posters</p>
              </div>
              <div className="flex flex-col border-l border-[#e0dbd2] pl-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-serif font-black text-[#1a3a2a]">2<span className="text-sm text-[#1a3a2a]/40 ml-0.5">+</span></span>
                </div>
                <p className="text-[9px] font-black text-[#6a6050] uppercase tracking-[0.2em] mt-1">Awards</p>
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-serif font-black text-[#1a3a2a]">10<span className="text-sm text-[#1a3a2a]/40 ml-0.5">+</span></span>
                </div>
                <p className="text-[9px] font-black text-[#6a6050] uppercase tracking-[0.2em] mt-1">Papers</p>
              </div>
              <div className="flex flex-col border-l border-[#e0dbd2] pl-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-serif font-black text-[#1a3a2a]">20<span className="text-sm text-[#1a3a2a]/40 ml-0.5">+</span></span>
                </div>
                <p className="text-[9px] font-black text-[#6a6050] uppercase tracking-[0.2em] mt-1">Winners</p>
              </div>
            </div>

            <div className="pt-5 mt-2 border-t border-[#e0dbd2] flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-serif italic text-[#1a3a2a] font-black tracking-tight leading-none">Impact Suite</p>
                <p className="text-[8px] font-black text-[#6a6050] uppercase tracking-[0.15em] mt-1.5">Lab Results</p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1 bg-[#1a3a2a]/5 px-3 py-1.5 rounded-full border border-[#1a3a2a]/10 group-hover:bg-[#1a3a2a]/10 transition-all">
                  <span className="text-sm font-serif font-black text-[#1a3a2a]">70<span className="text-[10px] ml-0.5 opacity-50">+</span></span>
                  <span className="text-[9px] font-black text-[#1a3a2a]/60 uppercase tracking-tighter ml-1">Finalists</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 flex-1 min-h-0 pb-1">
          {/* Graph 1: Researchers - Vibrant Ranking */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col overflow-hidden group h-full">
            <div className="p-4 pb-0 flex justify-between items-center">
              <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <Users className="w-3.5 h-3.5 text-orange-500" /> Top 5 Researchers
              </h3>
            </div>
            
            <div className="flex-1 min-h-0 px-2 mt-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cumulativeData} margin={{ top: 35, bottom: 70, left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} interval={0} tick={(props: any) => {
                    const student = cumulativeData.find(d => d.name === props.payload.value);
                    const nameParts = props.payload.value.split(" ");
                    return (
                      <g transform={`translate(${props.x},${props.y})`}>
                        <image x="-10" y="8" width="20" height="20" href={student?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(student?.name || "U")}&background=random`} style={{ clipPath: 'circle(50%)' }} />
                        <g transform="rotate(-25, 0, 40)">
                          <text x="0" y="44" textAnchor="middle" fill="#64748b" fontSize={7} fontWeight={800}>{nameParts[0].toUpperCase()}</text>
                          {nameParts.length > 1 && (
                            <text x="0" y="52" textAnchor="middle" fill="#94a3b8" fontSize={5.5} fontWeight={600}>{nameParts.slice(1).join(" ").toUpperCase()}</text>
                          )}
                        </g>
                      </g>
                    );
                  }} />
                  <YAxis axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} width={25} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={26} fill="url(#vibrantGrad1)">
                    <LabelList dataKey="score" content={(props: any) => {
                      const { x, y, width, index, value } = props;
                      const isTop3 = index < 3;
                      const colors = ["#fbbf24", "#94a3b8", "#b45309"];
                      return (
                        <g>
                          {isTop3 && <Crown x={x + width / 2 - 6} y={y - 26} size={12} fill={colors[index]} stroke={colors[index]} />}
                          <text x={x + width / 2} y={y - 8} fill="#1e293b" fontSize={11} fontWeight={900} textAnchor="middle">{value}</text>
                        </g>
                      );
                    }} />
                  </Bar>
                  <defs>
                    <linearGradient id="vibrantGrad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-orange-50/30 p-2.5 px-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-orange-700/60 uppercase tracking-tight">Total Researchers</span>
                <span className="text-xs font-black text-orange-900">{researchCount}+</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600">
                <ArrowUpRight size={12} />
                <span className="text-[10px] font-black">+12.4%</span>
              </div>
            </div>
          </div>

          {/* Graph 2: Monthly Trends - Vibrant Teal */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col overflow-hidden group h-full">
            <div className="p-4 pb-0 flex justify-between items-center">
              <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <TrendingUp className="w-3.5 h-3.5 text-teal-500" /> Monthly Trends
              </h3>
            </div>
            <div className="flex-1 min-h-0 px-2 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyScores} margin={{ top: 25, bottom: 45, left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} interval={0} tick={(props: any) => {
                    const student = monthlyScores.find(d => d.name === props.payload.value);
                    const firstName = props.payload.value.split(" ")[0];
                    return (
                      <g transform={`translate(${props.x},${props.y})`}>
                        <image x="-9" y="8" width="18" height="18" href={student?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(student?.name || "U")}&background=random`} style={{ clipPath: 'circle(50%)' }} />
                        <text x="0" y="38" textAnchor="middle" fill="#64748b" fontSize={8} fontWeight={900}>{firstName.toUpperCase()}</text>
                      </g>
                    );
                  }} />
                  <YAxis axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} width={25} />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#1a3a2a] border border-[#e0dbd2]/20 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-2">
                              <img src={data.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.originalName || data.name)}&background=random`} className="w-8 h-8 rounded-full border border-white/20" alt="" />
                              <div>
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Rank #{data.rank}</p>
                                <p className="text-xs font-black text-white truncate max-w-[120px]">{data.originalName || data.name}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-white/10 pt-2">
                              <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Score</p>
                              <p className="text-lg font-serif font-black text-white">{data.score}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 8, fill: '#059669', strokeWidth: 2, stroke: '#fff' }}
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(16, 185, 129, 0.2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graph 3: Dedication - Vibrant Multi-Gradient */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col overflow-hidden group h-full">
            <div className="p-4 pb-4">
              <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5 text-indigo-500" /> Top Hours Dedicated
              </h3>
            </div>
            
            <div className="flex-1 px-5 space-y-4 overflow-y-auto no-scrollbar">
              {timeDedication.slice(0, 5).map((item, i) => {
                const gradients = [
                  "linear-gradient(90deg, #6366f1, #a855f7)", // Indigo -> Purple
                  "linear-gradient(90deg, #ec4899, #f43f5e)", // Pink -> Rose
                  "linear-gradient(90deg, #06b6d4, #10b981)", // Cyan -> Emerald
                  "linear-gradient(90deg, #f59e0b, #ef4444)", // Amber -> Red
                  "linear-gradient(90deg, #3b82f6, #06b6d4)"  // Blue -> Cyan
                ];
                const badgeColors = ["#6366f1", "#ec4899", "#06b6d4", "#f59e0b", "#3b82f6"];
                
                return (
                  <div key={i} className="flex items-center gap-3 group/row">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: `${badgeColors[i]}15`, color: badgeColors[i], border: `1px solid ${badgeColors[i]}30` }}>
                      {i + 1}
                    </div>
                    
                    <div className="relative shrink-0">
                      <img src={item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "U")}&background=random`} className="w-8 h-8 rounded-full border border-slate-100 shadow-sm" alt="" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] font-bold text-slate-700 truncate pr-2">{item.originalName || item.name}</p>
                        <p className="text-[10px] font-black text-slate-900 italic tracking-tight shrink-0">{item.hours.toFixed(1)} Hrs</p>
                      </div>
                      <div className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${Math.min(100, (item.hours / (timeDedication[0]?.hours || 1)) * 100)}%` }} 
                          className="h-full rounded-full"
                          style={{ background: gradients[i] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto bg-slate-50/50 p-3 px-5 border-t border-slate-100 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Hours</span>
                <span className="text-sm font-black text-slate-800">{hoursDedicated.toFixed(1)}</span>
              </div>
              <div className="flex flex-col items-end">
                <div className={`flex items-center gap-1 leading-none ${hoursDedicated >= prevHoursDedicated ? "text-emerald-600" : "text-rose-500"}`}>
                  <ArrowUpRight size={10} className={hoursDedicated < prevHoursDedicated ? "rotate-90" : ""} />
                  <span className="text-[9px] font-black">
                    {prevHoursDedicated > 0 
                      ? `${Math.abs(((hoursDedicated - prevHoursDedicated) / prevHoursDedicated) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </span>
                </div>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">vs last month</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Dashboard;
