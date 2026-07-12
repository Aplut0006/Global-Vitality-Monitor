import { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Search,
  TrendingUp,
  TrendingDown,
  Heart,
  Calendar,
  Clock,
  Globe,
  Users,
  Activity,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  Plane,
  Baby,
  Skull,
  SlidersHorizontal,
  Sparkles,
  Zap,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { countries, CountryData, WORLD_STATS } from "./data/countries";
import {
  calculateCountryLiveStats,
  calculateGlobalLiveStats,
  getInitialElapsedSeconds,
  formatSimulatedDate,
  getSecondsSinceStartOfSimulatedDay,
  LiveStats,
} from "./utils/demographics";

const SECONDS_IN_YEAR = 31536000;

export default function App() {
  // --- STATE ---
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"population" | "birthRate" | "deathRate" | "growthRate" | "lifeExpectancy">(
    "population"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Simulation Controls
  const [speed, setSpeed] = useState<number>(1); // 1 = Realtime, 3600 = 1 hour/sec, 86400 = 1 day/sec, etc.
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(getInitialElapsedSeconds());

  // Interactive UI States
  const [mobileTab, setMobileTab] = useState<"directory" | "details" | "live">("directory");
  const [isWarpEngineExpanded, setIsWarpEngineExpanded] = useState<boolean>(false);
  const [showSelectedToast, setShowSelectedToast] = useState<boolean>(false);
  const [toastCountryName, setToastCountryName] = useState<string>("");

  // Recent Event Logs
  interface EventLog {
    id: string;
    type: "birth" | "death" | "migration";
    countryName: string;
    flag: string;
    timeStr: string;
  }
  const [liveEvents, setLiveEvents] = useState<EventLog[]>([]);

  // Page size for lazy loading list items
  const [pageSize, setPageSize] = useState<number>(15);

  // --- REFS FOR ACCURATE TICKING ---
  const lastTimeRef = useRef<number>(Date.now());
  const elapsedSecondsRef = useRef<number>(elapsedSeconds);
  elapsedSecondsRef.current = elapsedSeconds;

  // --- EFFECT: MAIN TIME TICKER ---
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      const now = Date.now();
      const realDelta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlaying) {
        setElapsedSeconds((prev) => prev + realDelta * speed);
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    lastTimeRef.current = Date.now();
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, speed]);

  // --- EFFECT: LIVE GLOBAL EVENTS FEED ---
  useEffect(() => {
    if (!isPlaying) return;

    // The event log tick frequency increases as speed increases, capped at 100ms
    const baseInterval = 1200; // ms
    const intervalTime = Math.max(100, baseInterval / Math.log10(speed + 9));

    const interval = setInterval(() => {
      const activeCountries = countries.filter((c) => c.population2026 > 10000000);
      if (activeCountries.length === 0) return;

      const randomCountry = activeCountries[Math.floor(Math.random() * activeCountries.length)];

      const birthWeight = randomCountry.birthRate;
      const deathWeight = randomCountry.deathRate;
      const netMigrationWeight = Math.abs(randomCountry.growthRate * 10 - (birthWeight - deathWeight));
      
      const totalWeight = birthWeight + deathWeight + netMigrationWeight;
      const roll = Math.random() * totalWeight;

      let type: "birth" | "death" | "migration" = "birth";
      if (roll < birthWeight) {
        type = "birth";
      } else if (roll < birthWeight + deathWeight) {
        type = "death";
      } else {
        type = "migration";
      }

      const { timeString } = formatSimulatedDate(elapsedSecondsRef.current);

      const newEvent: EventLog = {
        id: Math.random().toString(36).substring(2, 11),
        type,
        countryName: randomCountry.name,
        flag: randomCountry.flag,
        timeStr: timeString,
      };

      setLiveEvents((prev) => [newEvent, ...prev.slice(0, 14)]);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // --- CALCULATIONS ---
  const elapsedSecondsToday = useMemo(() => {
    return getSecondsSinceStartOfSimulatedDay(elapsedSeconds);
  }, [elapsedSeconds]);

  // Global aggregate stats
  const globalStats = useMemo(() => {
    return calculateGlobalLiveStats(countries, elapsedSeconds, elapsedSecondsToday);
  }, [elapsedSeconds, elapsedSecondsToday]);

  // Selected country profile or global overview fallback
  const selectedCountry = useMemo(() => {
    if (!selectedCountryCode) return null;
    return countries.find((c) => c.code === selectedCountryCode) || null;
  }, [selectedCountryCode]);

  const activeProfileStats = useMemo(() => {
    if (selectedCountry) {
      return calculateCountryLiveStats(selectedCountry, elapsedSeconds, elapsedSecondsToday);
    }
    return globalStats;
  }, [selectedCountry, globalStats, elapsedSeconds, elapsedSecondsToday]);

  // Simulated Calendar values
  const simulatedClock = useMemo(() => {
    return formatSimulatedDate(elapsedSeconds);
  }, [elapsedSeconds]);

  // Distinct region categories for filtering
  const regions = useMemo(() => {
    const list = ["All"];
    countries.forEach((c) => {
      if (!list.includes(c.region)) list.push(c.region);
    });
    return list;
  }, []);

  // Live region distribution calculations for interactive dashboard chart
  const regionDistribution = useMemo(() => {
    const counts: { [key: string]: { population: number; growthSum: number; count: number } } = {};
    
    countries.forEach((c) => {
      const stats = calculateCountryLiveStats(c, elapsedSeconds, elapsedSecondsToday);
      if (!counts[c.region]) {
        counts[c.region] = { population: 0, growthSum: 0, count: 0 };
      }
      counts[c.region].population += stats.currentPopulation;
      counts[c.region].growthSum += c.growthRate;
      counts[c.region].count += 1;
    });

    return Object.entries(counts).map(([name, data]) => ({
      name,
      population: Math.floor(data.population),
      avgGrowth: data.growthSum / data.count,
    }));
  }, [elapsedSeconds, elapsedSecondsToday]);

  const totalRegionalPop = useMemo(() => {
    return regionDistribution.reduce((acc, r) => acc + r.population, 0);
  }, [regionDistribution]);

  // Filter and sort country listing
  const filteredCountries = useMemo(() => {
    return countries
      .filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRegion = selectedRegion === "All" || c.region === selectedRegion;
        return matchesSearch && matchesRegion;
      })
      .map((c) => {
        const stats = calculateCountryLiveStats(c, elapsedSeconds, elapsedSecondsToday);
        return {
          ...c,
          livePop: stats.currentPopulation,
          liveBirthsToday: stats.birthsToday,
          liveDeathsToday: stats.deathsToday,
          netDailyGrowth: (stats.yearlyNetGrowth / 365.25),
        };
      })
      .sort((a, b) => {
        let fieldA: number = 0;
        let fieldB: number = 0;

        switch (sortBy) {
          case "population":
            fieldA = a.livePop;
            fieldB = b.livePop;
            break;
          case "birthRate":
            fieldA = a.birthRate;
            fieldB = b.birthRate;
            break;
          case "deathRate":
            fieldA = a.deathRate;
            fieldB = b.deathRate;
            break;
          case "growthRate":
            fieldA = a.growthRate;
            fieldB = b.growthRate;
            break;
          case "lifeExpectancy":
            fieldA = a.lifeExpectancy;
            fieldB = b.lifeExpectancy;
            break;
        }

        return sortDirection === "desc" ? fieldB - fieldA : fieldA - fieldB;
      });
  }, [searchQuery, selectedRegion, sortBy, sortDirection, elapsedSeconds, elapsedSecondsToday]);

  // Paginated visible country set
  const visibleCountries = useMemo(() => {
    return filteredCountries.slice(0, pageSize);
  }, [filteredCountries, pageSize]);

  // Reset simulation handler
  const handleReset = () => {
    setElapsedSeconds(getInitialElapsedSeconds());
    setSpeed(1);
    setIsPlaying(true);
    setLiveEvents([]);
  };

  // Select country action (with automated switch & notification for smartphones)
  const handleCountrySelect = (code: string, name: string) => {
    const isAlreadySelected = selectedCountryCode === code;
    setSelectedCountryCode(isAlreadySelected ? null : code);
    
    if (!isAlreadySelected) {
      setToastCountryName(name);
      setShowSelectedToast(true);
      // Auto-hide toast after a short period
      setTimeout(() => setShowSelectedToast(false), 4000);
      
      // Auto-switch to Details Tab on Mobile to show immediate feedback!
      setTimeout(() => {
        setMobileTab("details");
      }, 400);
    }
  };

  // Demographic classification helper
  const getDemographicTag = (growthRate: number, medianAge: number) => {
    if (growthRate < 0) {
      return { text: "Contracting Population", color: "bg-rose-50 text-rose-700 border-rose-100" };
    }
    if (growthRate > 2.0) {
      return { text: "Hyper-Growth (Youthful)", color: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    }
    if (medianAge > 42.0) {
      return { text: "Super-Aging Society", color: "bg-indigo-50 text-indigo-700 border-indigo-100" };
    }
    if (growthRate > 0.8 && growthRate <= 2.0) {
      return { text: "Expanding Population", color: "bg-sky-50 text-sky-700 border-sky-100" };
    }
    return { text: "Demographic Equilibrium", color: "bg-slate-50 text-slate-700 border-slate-100" };
  };

  return (
    <div
      id="app-root"
      className="min-h-screen bg-slate-50/70 text-slate-900 font-sans antialiased selection:bg-indigo-100 flex flex-col"
    >
      {/* Heartbeat pulse styles injection */}
      <style>{`
        @keyframes heart-pulse-green {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { transform: scale(1.15); box-shadow: 0 0 14px 6px rgba(16, 185, 129, 0); }
        }
        @keyframes heart-pulse-red {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { transform: scale(1.15); box-shadow: 0 0 14px 6px rgba(239, 68, 68, 0); }
        }
        @keyframes text-blink {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-pulse-green {
          animation: heart-pulse-green 1.5s infinite cubic-bezier(0.25, 1, 0.5, 1);
        }
        .animate-pulse-red {
          animation: heart-pulse-red 1.5s infinite cubic-bezier(0.25, 1, 0.5, 1);
        }
        .text-blink {
          animation: text-blink 2s infinite ease-in-out;
        }
      `}</style>

      {/* --- PREMIUM STICKY HEADER NAVIGATION --- */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-xs px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Global Vitality Monitor
              </h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">High-Fidelity Demographics</p>
            </div>
          </div>
          
          {/* Quick status dot on mobile */}
          <div className="sm:hidden flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">LIVE</span>
          </div>
        </div>

        {/* Live System Time / Simulated Clock Bar */}
        <div className="flex items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-100 pt-2.5 sm:pt-0">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50/60 px-3 py-1 rounded-full border border-emerald-100/70">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">Downlink Stream Active</span>
          </div>
          
          <div className="flex items-center gap-2 font-mono text-xs bg-slate-900/5 px-3 py-1.5 rounded-lg border border-slate-100 w-full sm:w-auto justify-center">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-slate-600 font-medium whitespace-nowrap">{simulatedClock.dateString}</span>
            <span className="text-indigo-600 font-extrabold ml-1.5 tracking-tight">{simulatedClock.timeString}</span>
          </div>
        </div>
      </header>

      {/* --- HERO STATS CAROUSEL / RESPONSIVE GRID --- */}
      <section className="bg-white border-b border-slate-100 py-5 px-4 sm:px-8 select-none">
        <div className="max-w-7xl mx-auto">
          {/* Layout changes from 2x2 compact on mobile to 4-col on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Stat 1: Global Population */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-3 sm:p-4 border border-slate-100 bg-slate-50/50 rounded-xl hover:border-indigo-100 hover:bg-white transition-all shadow-xs relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                <Globe className="w-16 h-16 text-indigo-600" />
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                World Population
              </p>
              <div className="text-base sm:text-2xl font-black text-slate-800 tabular-nums tracking-tight leading-none flex flex-wrap items-baseline gap-0.5">
                <span>{Math.floor(globalStats.currentPopulation).toLocaleString()}</span>
                <span className="text-indigo-600 text-xs sm:text-sm font-semibold">
                  .{(globalStats.currentPopulation % 1).toFixed(4).substring(2)}
                </span>
              </div>
              <p className="text-[9px] sm:text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +0.92% annual growth
              </p>
            </motion.div>

            {/* Stat 2: Daily Births */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-3 sm:p-4 border border-slate-100 bg-slate-50/50 rounded-xl hover:border-emerald-100 hover:bg-white transition-all shadow-xs relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                <Baby className="w-16 h-16 text-emerald-600" />
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Baby className="w-3.5 h-3.5 text-emerald-500" />
                Daily Births
              </p>
              <p className="text-base sm:text-2xl font-black text-emerald-600 tabular-nums tracking-tight leading-none">
                {Math.floor(globalStats.birthsToday).toLocaleString()}
              </p>
              <p className="text-[9px] sm:text-xs text-slate-400 mt-1">Avg. 168 births/min</p>
            </motion.div>

            {/* Stat 3: Daily Deaths */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-3 sm:p-4 border border-slate-100 bg-slate-50/50 rounded-xl hover:border-rose-100 hover:bg-white transition-all shadow-xs relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                <Skull className="w-16 h-16 text-rose-600" />
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Skull className="w-3.5 h-3.5 text-rose-500" />
                Daily Deaths
              </p>
              <p className="text-base sm:text-2xl font-black text-rose-600 tabular-nums tracking-tight leading-none">
                {Math.floor(globalStats.deathsToday).toLocaleString()}
              </p>
              <p className="text-[9px] sm:text-xs text-slate-400 mt-1">Global mortality: 7.6 / 1K</p>
            </motion.div>

            {/* Stat 4: Net Gain Today */}
            <motion.div
              whileHover={{ y: -2 }}
              className="p-3 sm:p-4 border border-slate-100 bg-slate-50/50 rounded-xl hover:border-sky-100 hover:bg-white transition-all shadow-xs relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp className="w-16 h-16 text-sky-600" />
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
                Net Growth Today
              </p>
              <p className="text-base sm:text-2xl font-black text-slate-800 tabular-nums tracking-tight leading-none">
                +{Math.floor(globalStats.netGrowthToday).toLocaleString()}
              </p>
              <p className="text-[9px] sm:text-xs text-indigo-500 font-semibold mt-1">Projected 8.16B base</p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* --- DASHBOARD CONTROLLER AREA --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-5 space-y-5 flex-1 w-full">
        
        {/* --- EXPANDABLE TIME WARP ENGINE (SPRING REACTION) --- */}
        <section id="simulator-panel" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Header Action Button */}
          <button
            onClick={() => setIsWarpEngineExpanded(!isWarpEngineExpanded)}
            className="w-full flex items-center justify-between p-4 bg-slate-50/60 hover:bg-slate-50 transition text-left cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${isPlaying ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                <Sliders className={`w-4 h-4 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "12s" }} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  Time Warp Projection Engine
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Currently running at <span className="font-bold font-mono text-indigo-600">
                    {speed === 1 ? "1x Realtime" : `${(speed).toLocaleString()}x Speed`}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase tracking-widest hidden sm:inline-block">
                Configure
              </span>
              {isWarpEngineExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {/* Collapsible Content */}
          <AnimatePresence initial={false}>
            {isWarpEngineExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 bg-white select-none">
                  <div className="space-y-1.5 max-w-md">
                    <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Predictive Modeling Array
                    </span>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">
                      Witness demographics shift across multiple virtual generations. Select custom multipliers below to watch rapid compound projections.
                    </p>
                  </div>

                  {/* Core controls */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Pause / Resume Button */}
                    <button
                      id="sim-toggle"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`px-4 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-xs cursor-pointer ${
                        isPlaying
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100"
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4.5 h-4.5 fill-current" /> : <Play className="w-4.5 h-4.5 fill-current" />}
                      <span>{isPlaying ? "Pause Timeline" : "Resume Timeline"}</span>
                    </button>

                    {/* Reset Button */}
                    <button
                      id="sim-reset"
                      onClick={handleReset}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                      title="Reset Timeline to Real System Time"
                    >
                      <RotateCcw className="w-4.5 h-4.5" />
                    </button>

                    <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                    {/* Speed Multipliers Grid */}
                    <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 w-full sm:w-auto">
                      {[
                        { label: "1x", val: 1 },
                        { label: "1 Hour/s", val: 3600 },
                        { label: "1 Day/s", val: 86400 },
                        { label: "1 Week/s", val: 604800 },
                        { label: "1 Month/s", val: 2592000 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          onClick={() => {
                            setSpeed(preset.val);
                            setIsPlaying(true);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold font-mono transition-all cursor-pointer ${
                            speed === preset.val && isPlaying
                              ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                              : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* --- INTERACTIVE SMARTPHONE SEGMENTED TABS (Only Visible on Mobile) --- */}
        <div className="block lg:hidden w-full select-none">
          <div className="flex bg-slate-200/80 p-1 rounded-xl gap-0.5 border border-slate-200">
            
            {/* Tab 1: Directory */}
            <button
              onClick={() => setMobileTab("directory")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative ${
                mobileTab === "directory" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Census</span>
              {mobileTab === "directory" && (
                <motion.div layoutId="mobileTabPill" className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>

            {/* Tab 2: Details */}
            <button
              onClick={() => setMobileTab("details")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative ${
                mobileTab === "details" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>DNA Profile</span>
              {selectedCountryCode && (
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></span>
              )}
              {mobileTab === "details" && (
                <motion.div layoutId="mobileTabPill" className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>

            {/* Tab 3: Satellite Feed */}
            <button
              onClick={() => setMobileTab("live")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative ${
                mobileTab === "live" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span>Downlink</span>
              {mobileTab === "live" && (
                <motion.div layoutId="mobileTabPill" className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>

          </div>
        </div>

        {/* --- CORE RESPONSIVE GRID LAYOUT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* --- LEFT HAND SECTION: CENSUS DIRECTORY --- */}
          {/* Responsive rule: Always block on desktop, only display on mobile when 'directory' tab is active */}
          <section
            id="country-directory"
            className={`${
              mobileTab === "directory" ? "block animate-fadeIn" : "hidden"
            } lg:block lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all`}
          >
            {/* Header & Controls Area */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 select-none">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-indigo-500" />
                    Global Demographic Database
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    Select a territory to synchronize the satellite telemetry and witness live growth.
                  </p>
                </div>
                
                {/* Active counters */}
                <div className="text-[10px] sm:text-xs font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100/60 self-start sm:self-auto shadow-xs">
                  {filteredCountries.length} reporting countries
                </div>
              </div>

              {/* Advanced Search & Filtering Panels */}
              <div className="space-y-3">
                {/* Search & Sort Panel */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  {/* Search Bar */}
                  <div className="relative sm:col-span-7">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, region or country code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                    />
                  </div>

                  {/* Sort Selection Box */}
                  <div className="sm:col-span-5 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0 select-none">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full text-xs font-bold text-slate-700 bg-transparent outline-none border-none cursor-pointer focus:ring-0"
                    >
                      <option value="population">Population (Live)</option>
                      <option value="birthRate">Birth Rate</option>
                      <option value="deathRate">Death Rate</option>
                      <option value="growthRate">Growth Rate %</option>
                      <option value="lifeExpectancy">Life Expectancy</option>
                    </select>
                    <button
                      onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                      className="text-slate-400 hover:text-indigo-600 transition-colors text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-slate-100 shrink-0 cursor-pointer"
                      title="Toggle direction"
                    >
                      {sortDirection === "desc" ? "▼" : "▲"}
                    </button>
                  </div>
                </div>

                {/* Continental Horizontal Scroller Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 select-none scrollbar-none">
                  {regions.map((tab) => {
                    const count = tab === "All" 
                      ? countries.length 
                      : countries.filter((c) => c.region === tab).length;
                    const isActive = selectedRegion === tab;

                    return (
                      <button
                        key={tab}
                        onClick={() => setSelectedRegion(tab)}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap border shrink-0 transition-all cursor-pointer ${
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-sm shadow-indigo-100"
                            : "bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 border-slate-200"
                        }`}
                      >
                        {tab}
                        <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-md ${
                          isActive ? "bg-indigo-700/60 text-indigo-100" : "bg-slate-100 text-slate-400 font-extrabold"
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* SMARTPHONE CARDS vs DESKTOP TABLE */}
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto select-none">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                    <th className="py-3.5 px-6 w-16 text-center">Rank</th>
                    <th className="py-3.5 px-6">Country / Region</th>
                    <th className="py-3.5 px-6 text-right">Current Population</th>
                    <th className="py-3.5 px-6 text-right text-rose-500">Deaths (24h)</th>
                    <th className="py-3.5 px-6 text-right">Daily Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibleCountries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-bold bg-slate-50/10">
                        No territories match your filtering criteria.
                      </td>
                    </tr>
                  ) : (
                    visibleCountries.map((c) => {
                      const isSelected = selectedCountryCode === c.code;
                      const globalRank = countries.findIndex((co) => co.code === c.code) + 1;
                      const roundedPop = Math.floor(c.livePop);
                      const roundedDeaths = Math.floor(c.liveDeathsToday);
                      const growthColor = c.netDailyGrowth >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold";

                      return (
                        <tr
                          key={c.code}
                          onClick={() => handleCountrySelect(c.code, c.name)}
                          className={`cursor-pointer transition-all border-l-4 ${
                            isSelected
                              ? "bg-indigo-50/40 hover:bg-indigo-50/60 border-l-indigo-600 font-semibold"
                              : "hover:bg-slate-50 border-l-transparent"
                          }`}
                        >
                          <td className="py-4 px-6 text-center font-mono text-xs text-slate-400 font-bold">
                            {globalRank.toString().padStart(2, "0")}
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl leading-none filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">{c.flag}</span>
                              <div className="flex flex-col">
                                <span className="leading-tight text-slate-900 font-extrabold">{c.name}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">{c.region}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-slate-700 tabular-nums">
                            {roundedPop.toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-rose-500 tabular-nums">
                            {roundedDeaths.toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-xs tabular-nums">
                            <span className={growthColor}>
                              {c.netDailyGrowth >= 0 ? "+" : ""}
                              {Math.floor(c.netDailyGrowth).toLocaleString()} / day
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View (Only shown on mobile screen sizes) */}
            <div className="block sm:hidden divide-y divide-slate-100 p-3 select-none">
              {visibleCountries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                  No territories match your filter.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleCountries.map((c) => {
                    const isSelected = selectedCountryCode === c.code;
                    const globalRank = countries.findIndex((co) => co.code === c.code) + 1;
                    const roundedPop = Math.floor(c.livePop);
                    const roundedDeaths = Math.floor(c.liveDeathsToday);
                    const isPositive = c.netDailyGrowth >= 0;

                    return (
                      <motion.div
                        key={c.code}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCountrySelect(c.code, c.name)}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col gap-3 cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/50 border-indigo-200 shadow-xs"
                            : "bg-white border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        {/* Title Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{c.flag}</span>
                            <div>
                              <h4 className="text-xs font-black text-slate-800 leading-tight">
                                {c.name}
                              </h4>
                              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                                {c.region}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                              #{globalRank}
                            </span>
                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? "rotate-90 text-indigo-500" : ""}`} />
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">LIVE POPULATION</span>
                            <span className="text-xs font-black font-mono text-slate-700 tabular-nums mt-0.5 block">
                              {roundedPop.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">DAILY CHANGE</span>
                            <span className={`text-xs font-black font-mono tabular-nums mt-0.5 block ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                              {isPositive ? "+" : ""}
                              {Math.floor(c.netDailyGrowth).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination Button */}
            {filteredCountries.length > pageSize && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
                <button
                  onClick={() => setPageSize((prev) => Math.min(filteredCountries.length, prev + 25))}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white text-slate-700 text-xs font-bold border border-slate-200 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/30 rounded-xl transition-all shadow-xs cursor-pointer select-none"
                >
                  Load Next 25 Territories
                </button>
              </div>
            )}
          </section>

          {/* --- RIGHT HAND SECTION: DETAILED STATS & BROADCUST FEED --- */}
          {/* Responsive rule: On desktop, this is visual column span 5. On mobile, shown under separate tabs */}
          <div className="lg:col-span-5 space-y-6 w-full">
            
            {/* --- MOBILE TAB DETAILS --- */}
            <section
              className={`${
                mobileTab === "details" ? "block animate-fadeIn" : "hidden"
              } lg:block space-y-6`}
            >
              
              {/* Profile card view */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-6">
                
                {/* Active Country Title Badge */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4 select-none">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl leading-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
                      {selectedCountry ? selectedCountry.flag : "🌎"}
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                        {selectedCountry ? selectedCountry.name : "Global Aggregate Overview"}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest font-mono">
                        {selectedCountry ? `${selectedCountry.region} Territory` : "Integrated Earth Telemetry"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Tag Indicator */}
                  {selectedCountry ? (
                    <span className={`px-2.5 py-1 text-[9px] font-bold border rounded-lg self-start sm:self-auto ${
                      getDemographicTag(selectedCountry.growthRate, selectedCountry.medianAge).color
                    }`}>
                      {getDemographicTag(selectedCountry.growthRate, selectedCountry.medianAge).text}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-[9px] font-bold border bg-indigo-50 border-indigo-100 text-indigo-700 rounded-lg self-start sm:self-auto">
                      All 241 Reporting Territories
                    </span>
                  )}
                </div>

                {/* Country core metadata columns */}
                <div className="grid grid-cols-3 gap-2.5 select-none">
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Median Age</span>
                    <span className="text-xs sm:text-sm font-black text-slate-800 mt-1 block">
                      {selectedCountry ? `${selectedCountry.medianAge} yrs` : `${WORLD_STATS.medianAge} yrs`}
                    </span>
                  </div>
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Life Expectancy</span>
                    <span className="text-xs sm:text-sm font-black text-slate-800 mt-1 block">
                      {selectedCountry ? `${selectedCountry.lifeExpectancy} yrs` : `${WORLD_STATS.lifeExpectancy} yrs`}
                    </span>
                  </div>
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">GDP Per Capita</span>
                    <span className="text-xs sm:text-sm font-black text-slate-800 mt-1 block">
                      {selectedCountry ? `$${selectedCountry.gdpPerCapita.toLocaleString()}` : "$14,200 avg"}
                    </span>
                  </div>
                </div>

                {/* Satellite Ticker Readout Panel */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-4 shadow-md font-mono border border-slate-800 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-5">
                    <Zap className="w-24 h-24 text-indigo-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                      Real-Time Streaming Ticker
                    </h4>
                    <span className="text-[8px] font-bold bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 px-1.5 py-0.5 rounded uppercase">
                      Telemetry Sync
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Live population ticker */}
                    <div>
                      <span className="text-[9px] text-slate-400 font-extrabold tracking-widest block uppercase">CURRENT LIVE POPULATION</span>
                      <div className="text-xl sm:text-3xl font-black leading-tight flex items-baseline tracking-tight mt-1">
                        <span className="text-slate-100">{Math.floor(activeProfileStats.currentPopulation).toLocaleString()}</span>
                        <span className="text-indigo-400 text-xs sm:text-base font-bold">
                          .{(activeProfileStats.currentPopulation % 1).toFixed(4).substring(2)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-800"></div>

                    {/* Rates Grid today */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          BIRTHS TODAY
                        </div>
                        <div className="text-sm sm:text-base font-bold text-slate-100 mt-0.5 tabular-nums">
                          {Math.floor(activeProfileStats.birthsToday).toLocaleString()}
                          <span className="text-emerald-500/60 text-xs font-semibold">
                            .{(activeProfileStats.birthsToday % 1).toFixed(2).substring(2)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          DEATHS TODAY
                        </div>
                        <div className="text-sm sm:text-base font-bold text-slate-100 mt-0.5 tabular-nums">
                          {Math.floor(activeProfileStats.deathsToday).toLocaleString()}
                          <span className="text-rose-500/60 text-xs font-semibold">
                            .{(activeProfileStats.deathsToday % 1).toFixed(2).substring(2)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                          <Plane className="w-3.5 h-3.5 text-sky-400" />
                          NET MIGRATION TODAY
                        </div>
                        <div className="text-sm sm:text-base font-bold text-slate-100 mt-0.5 tabular-nums">
                          {activeProfileStats.migrationToday >= 0 ? "+" : ""}
                          {Math.floor(activeProfileStats.migrationToday).toLocaleString()}
                          <span className="text-sky-400/60 text-xs font-semibold">
                            .{(Math.abs(activeProfileStats.migrationToday) % 1).toFixed(2).substring(2)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                          NET SEED GAIN TODAY
                        </div>
                        <div className="text-sm sm:text-base font-bold text-slate-100 mt-0.5 tabular-nums">
                          {activeProfileStats.netGrowthToday >= 0 ? "+" : ""}
                          {Math.floor(activeProfileStats.netGrowthToday).toLocaleString()}
                          <span className="text-amber-400/60 text-xs font-semibold">
                            .{(Math.abs(activeProfileStats.netGrowthToday) % 1).toFixed(2).substring(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Animated metronome */}
                <div className="bg-slate-50/80 border border-slate-150 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between select-none">
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      Demographic Metronomes
                    </h4>
                    <Info className="w-3.5 h-3.5 text-slate-400" title="Pulses in sync with mathematical probability" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Birth ticker metronome */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                      <div
                        className="h-10 w-10 shrink-0 bg-emerald-50 rounded-full flex items-center justify-center animate-pulse-green"
                        style={{
                          animationDuration: `${Math.max(0.1, activeProfileStats.secondsPerBirth / speed)}s`,
                        }}
                      >
                        <Heart className="w-4.5 h-4.5 text-emerald-600 fill-emerald-500" />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Birth Metronome</span>
                        <span className="text-xs font-bold text-slate-700 font-mono mt-0.5 block">
                          {activeProfileStats.secondsPerBirth < 0.1 
                            ? `${(1 / activeProfileStats.secondsPerBirth).toFixed(1)} births/sec`
                            : `1 every ${activeProfileStats.secondsPerBirth.toFixed(1)}s`}
                        </span>
                      </div>
                    </div>

                    {/* Death ticker metronome */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                      <div
                        className="h-10 w-10 shrink-0 bg-rose-50 rounded-full flex items-center justify-center animate-pulse-red"
                        style={{
                          animationDuration: `${Math.max(0.1, activeProfileStats.secondsPerDeath / speed)}s`,
                        }}
                      >
                        <Heart className="w-4.5 h-4.5 text-rose-600 fill-rose-500" />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Death Metronome</span>
                        <span className="text-xs font-bold text-slate-700 font-mono mt-0.5 block">
                          {activeProfileStats.secondsPerDeath < 0.1 
                            ? `${(1 / activeProfileStats.secondsPerDeath).toFixed(1)} deaths/sec`
                            : `1 every ${activeProfileStats.secondsPerDeath.toFixed(1)}s`}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Natural Births vs Deaths Balance Meter */}
                {selectedCountry && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-extrabold text-slate-700 uppercase select-none">
                      <span>Crude Demographics Balance</span>
                      <span className="font-mono text-slate-400 text-[10px]">per 1K citizens / yr</span>
                    </div>
                    
                    <div className="space-y-3 bg-slate-50/50 p-4 border border-slate-150 rounded-2xl">
                      {/* Birth Rate Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Birth Rate</span>
                          <span className="font-mono">{selectedCountry.birthRate.toFixed(1)} / 1K</span>
                        </div>
                        <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (selectedCountry.birthRate / 45) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Death Rate Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Death Rate</span>
                          <span className="font-mono">{selectedCountry.deathRate.toFixed(1)} / 1K</span>
                        </div>
                        <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (selectedCountry.deathRate / 45) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Net Gap Insight */}
                      <div className="text-xs text-slate-500 pt-2 border-t border-slate-200/60 flex justify-between">
                        <span>Natural Gap:</span>
                        <span className={`font-mono font-bold ${
                          selectedCountry.birthRate - selectedCountry.deathRate >= 0 
                            ? "text-emerald-600" 
                            : "text-rose-600"
                        }`}>
                          {(selectedCountry.birthRate - selectedCountry.deathRate) >= 0 ? "+" : ""}
                          {(selectedCountry.birthRate - selectedCountry.deathRate).toFixed(1)} per 1K citizens
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Projections table inside */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider select-none">
                    Statistical Forecast Modeling
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-200 select-none">
                          <th className="py-2.5 px-3">Horizon</th>
                          <th className="py-2.5 px-3 text-right">Population Outcome</th>
                          <th className="py-2.5 px-3 text-right">Deaths Cum.</th>
                          <th className="py-2.5 px-3 text-right">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {[
                          { label: "In 1 Hour", seconds: 3600 },
                          { label: "In 24 Hours", seconds: 86400 },
                          { label: "In 1 Year", seconds: 31536000 },
                          { label: "In 10 Years", seconds: 315360000 },
                          { label: "In 25 Years", seconds: 788400000 },
                        ].map((item) => {
                          const netGrowthPerSec = activeProfileStats.yearlyNetGrowth / SECONDS_IN_YEAR;
                          const deathsPerSec = activeProfileStats.yearlyDeaths / SECONDS_IN_YEAR;
                          
                          const populationInHorizon = activeProfileStats.currentPopulation + item.seconds * netGrowthPerSec;
                          const deathsInHorizon = item.seconds * deathsPerSec;
                          const absoluteChange = item.seconds * netGrowthPerSec;
                          
                          const textStyle = absoluteChange >= 0 ? "text-emerald-600" : "text-rose-600";

                          return (
                            <tr key={item.label} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2 px-3 text-slate-600 font-sans font-extrabold">{item.label}</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-800">
                                {Math.floor(populationInHorizon).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right text-rose-500 font-semibold">
                                {Math.floor(deathsInHorizon).toLocaleString()}
                              </td>
                              <td className={`py-2 px-3 text-right font-bold ${textStyle}`}>
                                {absoluteChange >= 0 ? "+" : ""}
                                {Math.floor(absoluteChange).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </section>

            {/* --- MOBILE TAB SATELLITE BROADCAST / LIVE SENSORS --- */}
            <section
              className={`${
                mobileTab === "live" ? "block animate-fadeIn" : "hidden"
              } lg:block space-y-6`}
            >
              
              {/* Regional Population Distribution interactive chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 select-none">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                      Global Regional Distribution
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Click on any region to filter the database</p>
                  </div>
                  <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                    Aggregate
                  </span>
                </div>

                <div className="space-y-3">
                  {regionDistribution.map((region) => {
                    const percent = (region.population / totalRegionalPop) * 100;
                    const isSelected = selectedRegion === region.name;
                    return (
                      <motion.div
                        whileTap={{ scale: 0.99 }}
                        key={region.name}
                        onClick={() => setSelectedRegion(region.name)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-indigo-50/50 border-indigo-200" 
                            : "bg-slate-50/40 border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1 font-bold">
                          <span className="text-slate-700">{region.name}</span>
                          <span className="font-mono text-slate-400 text-[10px]">
                            {region.population.toLocaleString()} ({percent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200/50 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Shift Analysis Highlight Alerts */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-md border border-slate-800 relative overflow-hidden select-none">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                  <Sparkles className="w-20 h-20 text-indigo-400" />
                </div>
                
                <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  Demographic Shift Alerts
                </h3>
                
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] text-emerald-400 font-extrabold tracking-wider uppercase block">Rapid Growth Alert</span>
                    <h4 className="text-sm font-extrabold text-slate-100">Sub-Saharan Africa expansion</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">
                      Birth rates in this region currently lead global baselines by 3.4x compared to Western Europe estimates.
                    </p>
                  </div>
                  <div className="h-px bg-slate-800 w-full"></div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-rose-400 font-extrabold tracking-wider uppercase block">Negative Growth Concern</span>
                    <h4 className="text-sm font-extrabold text-slate-100 font-sans">Eastern Europe decline</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">
                      Mortality rates currently exceed incoming natural births by 14% across 8 reporting Eastern territories.
                    </p>
                  </div>
                </div>
              </div>

              {/* Real-Time Log Broadcast array */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                      Live Downlink Broadcast
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">Real-time demographic calculations</p>
                  </div>
                  <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-900 text-slate-300">
                    SATELLITE SYNC
                  </span>
                </div>

                {/* Event stream list container */}
                <div className="relative h-44 overflow-y-hidden border border-slate-150 rounded-xl bg-slate-50/50 shadow-inner p-3">
                  <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none"></div>
                  <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none"></div>
                  
                  <div className="space-y-2 h-full overflow-y-hidden select-none">
                    <AnimatePresence initial={false}>
                      {liveEvents.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs font-bold font-sans text-slate-400 text-blink">
                          Connecting to satellite grid array...
                        </div>
                      ) : (
                        liveEvents.map((log) => (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{log.flag}</span>
                              <span className="font-extrabold text-slate-700">{log.countryName}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 font-mono">
                              {log.type === "birth" && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-black border border-emerald-100 text-[9px] flex items-center gap-0.5">
                                  🟢 BIRTH
                                </span>
                              )}
                              {log.type === "death" && (
                                <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-black border border-rose-100 text-[9px] flex items-center gap-0.5">
                                  🔴 DEATH
                                </span>
                              )}
                              {log.type === "migration" && (
                                <span className="px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 font-black border border-sky-100 text-[9px] flex items-center gap-0.5">
                                  ✈️ MIGRANT
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 font-bold">{log.timeStr}</span>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

            </section>

          </div>

        </div>

      </main>

      {/* --- FLOATING INTUITIVE SMARTPHONE TOAST (SPRING ASSISTANCE) --- */}
      <AnimatePresence>
        {showSelectedToast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-slate-900 text-white rounded-2xl shadow-xl p-3.5 border border-slate-800 flex items-center justify-between select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/40">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" style={{ animationDuration: "6s" }} />
              </div>
              <div>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest leading-none">Telemetry Selected</p>
                <p className="text-xs font-black text-slate-100 mt-0.5">{toastCountryName}</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setMobileTab("details");
                setShowSelectedToast(false);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold rounded-lg transition-all"
            >
              View DNA
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FOOTER CREDITS --- */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-xs text-slate-400 font-bold">
            World Population & Mortality Tracker © 2026. Built with high-fidelity demographic projection algorithms.
          </p>
          <p className="text-[10px] text-slate-400 font-mono font-medium">
            Baseline Estimates: UN Population Prospects & WHO Mortality Statistics (Reference Year: 2026)
          </p>
          <p className="text-xs font-extrabold text-indigo-600 mt-2">
            Created By: Aplut
          </p>
        </div>
      </footer>
    </div>
  );
}
