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
  Info,
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  Plane,
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
  const [speed, setSpeed] = useState<number>(1); // 1 = Realtime, 60 = 1 min/sec, 3600 = 1 hour/sec, 86400 = 1 day/sec, 604800 = 1 week/sec, 2592000 = 1 month/sec
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(getInitialElapsedSeconds());

  // Recent Event Logs
  interface EventLog {
    id: string;
    type: "birth" | "death" | "migration";
    countryName: string;
    flag: string;
    timeStr: string;
  }
  const [liveEvents, setLiveEvents] = useState<EventLog[]>([]);

  // Page selection for list to ensure ultra-smooth 60fps rendering
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
        // Advance virtual elapsed seconds based on speed
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

    // The event log tick frequency increases as the speed increases, capped at 100ms
    const baseInterval = 1200; // ms
    const intervalTime = Math.max(100, baseInterval / Math.log10(speed + 9));

    const interval = setInterval(() => {
      // Pick a random country from those with population > 10M to represent a realistic feed
      const activeCountries = countries.filter((c) => c.population2026 > 10000000);
      if (activeCountries.length === 0) return;

      const randomCountry = activeCountries[Math.floor(Math.random() * activeCountries.length)];

      // Decide if it is a birth, death, or migration based on weights
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

  // Active selected country or global fallback
  const selectedCountry = useMemo(() => {
    if (!selectedCountryCode) return null;
    return countries.find((c) => c.code === selectedCountryCode) || null;
  }, [selectedCountryCode]);

  const activeProfileStats = useMemo(() => {
    if (selectedCountry) {
      return calculateCountryLiveStats(selectedCountry, elapsedSeconds, elapsedSecondsToday);
    }
    return globalStats; // Fallback to Global Total
  }, [selectedCountry, globalStats, elapsedSeconds, elapsedSecondsToday]);

  // Simulated Calendar values
  const simulatedClock = useMemo(() => {
    return formatSimulatedDate(elapsedSeconds);
  }, [elapsedSeconds]);

  // Region Categories for tabs
  const regions = useMemo(() => {
    const list = ["All"];
    countries.forEach((c) => {
      if (!list.includes(c.region)) list.push(c.region);
    });
    return list;
  }, []);

  // Filter and sort country list
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
        // Embed their current dynamic stats so we can sort by live fields if needed
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

  // Paginated visible list for smooth performance
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

  // Helper: classify growth categories for insight badges
  const getDemographicTag = (growthRate: number, medianAge: number) => {
    if (growthRate < 0) {
      return { text: "Contracting Population", color: "bg-rose-100 text-rose-800 border-rose-200" };
    }
    if (growthRate > 2.0) {
      return { text: "Hyper-Growth (Youthful)", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    if (medianAge > 42.0) {
      return { text: "Super-Aging Society", color: "bg-indigo-100 text-indigo-800 border-indigo-200" };
    }
    if (growthRate > 0.8 && growthRate <= 2.0) {
      return { text: "Expanding Population", color: "bg-blue-100 text-blue-800 border-blue-200" };
    }
    return { text: "Demographic Equilibrium", color: "bg-slate-100 text-slate-800 border-slate-200" };
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-100">
      {/* Dynamic Blink Custom Animations injected directly */}
      <style>{`
        @keyframes heart-pulse-green {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { transform: scale(1.18); box-shadow: 0 0 12px 6px rgba(34, 197, 94, 0); }
        }
        @keyframes heart-pulse-red {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { transform: scale(1.18); box-shadow: 0 0 12px 6px rgba(239, 68, 68, 0); }
        }
        @keyframes text-blink {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .animate-pulse-green {
          animation: heart-pulse-green 1.5s infinite ease-in-out;
        }
        .animate-pulse-red {
          animation: heart-pulse-red 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* --- TOP HEADER NAVIGATION BANNER --- */}
      <header className="h-16 flex items-center justify-between px-4 sm:px-8 bg-white border-b border-slate-200 shrink-0 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Global Vitality Monitor</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Real-Time Feed Active</span>
          </div>
          <div className="text-sm text-slate-400 font-mono flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Simulated:</span>
            <span className="text-slate-700 font-semibold">{simulatedClock.dateString}</span>
            <span className="text-indigo-600 font-bold">{simulatedClock.timeString}</span>
          </div>
        </div>
      </header>

      {/* --- GLOBAL SUMMARY STATS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-8 py-6 shrink-0 bg-white border-b border-slate-200">
        {/* Card 1: Total Global Population */}
        <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Global Population</p>
          <div className="text-2xl font-black text-slate-900 tabular-nums leading-none flex items-baseline gap-0.5">
            <span>{Math.floor(globalStats.currentPopulation).toLocaleString()}</span>
            <span className="text-indigo-600 text-sm font-medium">
              .{(globalStats.currentPopulation % 1).toFixed(4).substring(2)}
            </span>
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-1">+0.84% annual growth</p>
        </div>

        {/* Card 2: Daily Births */}
        <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Daily Births (Today)</p>
          <p className="text-2xl font-black text-indigo-600 tabular-nums leading-none">
            {Math.floor(globalStats.birthsToday).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">Avg. 168 per minute</p>
        </div>

        {/* Card 3: Daily Deaths */}
        <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Daily Deaths (Today)</p>
          <p className="text-2xl font-black text-rose-600 tabular-nums leading-none">
            {Math.floor(globalStats.deathsToday).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">Global mortality rate: 7.7</p>
        </div>

        {/* Card 4: Net Growth */}
        <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Net Growth Today</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">
            +{Math.floor(globalStats.netGrowthToday).toLocaleString()}
          </p>
          <p className="text-xs text-indigo-500 font-medium mt-1">Projected 8.1B by Q4 2026</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">

        {/* --- DYNAMIC TIME WARP SIMULATOR CONTROLS --- */}
        <section id="simulator-panel" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Title & Speed Explanation */}
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" />
                Time Warp Engine
              </h2>
              <p className="text-sm text-slate-600">
                Speed up time to witness long-term projections and watch demographic trends play out rapidly.
              </p>
            </div>

            {/* Simulated Speed Selections */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Play Pause Button */}
              <button
                id="sim-toggle"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-2.5 rounded-lg flex items-center gap-2 font-medium transition ${
                  isPlaying
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                    : "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                }`}
                title={isPlaying ? "Pause Simulation" : "Resume Simulation"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                <span className="text-sm hidden sm:inline">{isPlaying ? "Pause" : "Resume"}</span>
              </button>

              {/* Reset Button */}
              <button
                id="sim-reset"
                onClick={handleReset}
                className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                title="Reset Simulation to Current System Time"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

              {/* Presets Grid */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto">
                {[
                  { label: "1x (Realtime)", val: 1 },
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
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition ${
                      speed === preset.val && isPlaying
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* --- CORE TWO-COLUMN CONTENT GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* --- LEFT HAND COL: COUNTRY LISTING (8 columns on lg) --- */}
          <section id="country-directory" className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            
            {/* Header & Search */}
            <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Country Demographic Census</h3>
                  <p className="text-xs text-slate-500">Search and filter active countries. Click on any row to load deep profiling stats.</p>
                </div>
                <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 self-start sm:self-auto">
                  Showing {filteredCountries.length} countries
                </div>
              </div>

              {/* Filters Box */}
              <div className="space-y-3">
                
                {/* Search & Sort Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  {/* Search */}
                  <div className="relative sm:col-span-7">
                    <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search country by name or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Sorting metric */}
                  <div className="sm:col-span-5 flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider shrink-0">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full text-xs font-semibold text-slate-700 bg-transparent outline-none border-none cursor-pointer"
                    >
                      <option value="population">Population (Live)</option>
                      <option value="birthRate">Birth Rate (Crude)</option>
                      <option value="deathRate">Death Rate (Crude)</option>
                      <option value="growthRate">Net Growth Rate %</option>
                      <option value="lifeExpectancy">Life Expectancy</option>
                    </select>
                    <button
                      onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                      className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-1 rounded-sm hover:bg-slate-100"
                      title="Toggle Sort Direction"
                    >
                      {sortDirection === "desc" ? "▼" : "▲"}
                    </button>
                  </div>
                </div>

                {/* Continental Tab Row */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
                  {regions.map((tab) => {
                    const count = tab === "All" 
                      ? countries.length 
                      : countries.filter((c) => c.region === tab).length;
                    return (
                      <button
                        key={tab}
                        onClick={() => setSelectedRegion(tab)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0 transition ${
                          selectedRegion === tab
                            ? "bg-slate-900 text-white border-slate-950 shadow-sm"
                            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200"
                        }`}
                      >
                        {tab}
                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                          selectedRegion === tab ? "bg-slate-800 text-indigo-300" : "bg-slate-100 text-slate-500"
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* List Body */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-widest font-sans">
                    <th className="py-3.5 px-6 w-16 text-center">Rank</th>
                    <th className="py-3.5 px-6">Country / Region</th>
                    <th className="py-3.5 px-6 text-right">Current Population</th>
                    <th className="py-3.5 px-6 text-right text-rose-600">Deaths (24h)</th>
                    <th className="py-3.5 px-6 text-right">Daily Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibleCountries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold bg-slate-50/50">
                        No countries found matching your search.
                      </td>
                    </tr>
                  ) : (
                    visibleCountries.map((c, index) => {
                      const isSelected = selectedCountryCode === c.code;
                      const globalRank = countries.findIndex((co) => co.code === c.code) + 1;
                      const roundedPop = Math.floor(c.livePop);
                      const roundedDeaths = Math.floor(c.liveDeathsToday);
                      const growthColor = c.netDailyGrowth >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium";

                      return (
                        <tr
                          key={c.code}
                          onClick={() => setSelectedCountryCode(isSelected ? null : c.code)}
                          className={`cursor-pointer transition-colors border-l-3 ${
                            isSelected
                              ? "bg-indigo-50/40 hover:bg-indigo-50/60 border-l-indigo-600"
                              : "hover:bg-slate-50 border-l-transparent"
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-4 px-6 text-center font-mono font-medium text-slate-400 text-xs">
                            {globalRank.toString().padStart(2, "0")}
                          </td>
                          {/* Country Name */}
                          <td className="py-4 px-6 font-bold text-slate-700">
                            <div className="flex items-center gap-3">
                              <span className="text-xl leading-none filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">{c.flag}</span>
                              <div className="flex flex-col">
                                <span className="leading-tight text-slate-900">{c.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">{c.region}</span>
                              </div>
                            </div>
                          </td>
                          {/* Population Live Ticker */}
                          <td className="py-4 px-6 text-right font-mono font-medium text-slate-700">
                            {roundedPop.toLocaleString()}
                          </td>
                          {/* Live Deaths Today */}
                          <td className="py-4 px-6 text-right font-mono font-medium text-rose-600">
                            {roundedDeaths.toLocaleString()}
                          </td>
                          {/* Growth Rate / Daily Increase */}
                          <td className="py-4 px-6 text-right font-mono text-xs">
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

            {/* Pagination / Expand control */}
            {filteredCountries.length > pageSize && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
                <button
                  onClick={() => setPageSize((prev) => Math.min(filteredCountries.length, prev + 20))}
                  className="px-4 py-2 bg-white text-slate-700 text-xs font-bold border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-lg transition shadow-xs cursor-pointer"
                >
                  Show More Countries
                </button>
              </div>
            )}

          </section>

          {/* --- RIGHT HAND COL: DETAILED INSIGHTS PROFILE (5 columns on lg) --- */}
          <section id="demographic-analytics" className="lg:col-span-5 space-y-6">
            
            {/* Shift Analysis Highlight */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-md border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Shift Analysis</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <span className="text-xs text-indigo-400 font-semibold tracking-wider">Rapid Growth Alert</span>
                  <h4 className="text-lg font-bold text-slate-100">Sub-Saharan Africa</h4>
                  <p className="text-sm text-slate-400 mt-1">Birth rates in this region are 3.4x higher than European averages this morning.</p>
                </div>
                <div className="h-px bg-slate-800 w-full"></div>
                <div>
                  <span className="text-xs text-rose-400 font-semibold tracking-wider">Negative Growth</span>
                  <h4 className="text-lg font-bold text-slate-100 font-sans">Eastern Europe</h4>
                  <p className="text-sm text-slate-400 mt-1">Mortality rates exceeding birth rates by 14% across 8 reporting countries.</p>
                </div>
              </div>
            </div>

            {/* Main Detailed Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-6">
              
              {/* Profile Header (Selected Country or Global) */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl leading-none filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">
                    {selectedCountry ? selectedCountry.flag : "🌎"}
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                      {selectedCountry ? selectedCountry.name : "Global Overview"}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest font-mono">
                      {selectedCountry ? `${selectedCountry.region} Territory` : "Earth Demographics"}
                    </p>
                  </div>
                </div>
                {/* Visual state badge */}
                {selectedCountry ? (
                  <span className={`px-2.5 py-1 text-[10px] font-bold border rounded-full ${
                    getDemographicTag(selectedCountry.growthRate, selectedCountry.medianAge).color
                  }`}>
                    {getDemographicTag(selectedCountry.growthRate, selectedCountry.medianAge).text}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-[10px] font-bold border bg-indigo-50 border-indigo-100 text-indigo-700 rounded-full">
                    Aggregate Planet Earth
                  </span>
                )}
              </div>

              {/* Core Country DNA Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Median Age</span>
                  <span className="text-base font-extrabold text-slate-800 mt-1 block">
                    {selectedCountry ? `${selectedCountry.medianAge} yrs` : `${WORLD_STATS.medianAge} yrs`}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Life Expectancy</span>
                  <span className="text-base font-extrabold text-slate-800 mt-1 block">
                    {selectedCountry ? `${selectedCountry.lifeExpectancy} yrs` : `${WORLD_STATS.lifeExpectancy} yrs`}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Wealth Indicator</span>
                  <span className="text-base font-extrabold text-slate-800 mt-1 block">
                    {selectedCountry ? `$${selectedCountry.gdpPerCapita.toLocaleString()}` : "N/A"}
                  </span>
                </div>
              </div>

              {/* High-Precision Real-Time Ticking Panel */}
              <div className="bg-slate-900 text-white rounded-xl p-4.5 space-y-4 shadow-sm font-mono border border-slate-800">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Live Stream Tickers
                </h4>
                
                <div className="space-y-3.5">
                  {/* Live Population */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5 font-bold">
                      <span>CURRENT POPULATION</span>
                      <span className="text-[9px] px-1 bg-indigo-900 text-indigo-200 border border-indigo-700 rounded-xs">ESTIMATED</span>
                    </div>
                    <div className="text-2xl font-bold leading-tight flex items-baseline tracking-tight">
                      <span>{Math.floor(activeProfileStats.currentPopulation).toLocaleString()}</span>
                      <span className="text-indigo-400 text-base">
                        .{(activeProfileStats.currentPopulation % 1).toFixed(4).substring(2)}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-800"></div>

                  {/* Sub Rates Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {/* Births Today */}
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                        BIRTHS TODAY
                      </div>
                      <div className="text-base font-bold text-slate-100 mt-0.5">
                        {Math.floor(activeProfileStats.birthsToday).toLocaleString()}
                        <span className="text-emerald-500/60 text-xs">
                          .{(activeProfileStats.birthsToday % 1).toFixed(2).substring(2)}
                        </span>
                      </div>
                    </div>

                    {/* Deaths Today */}
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                        DEATHS TODAY
                      </div>
                      <div className="text-base font-bold text-slate-100 mt-0.5">
                        {Math.floor(activeProfileStats.deathsToday).toLocaleString()}
                        <span className="text-rose-500/60 text-xs">
                          .{(activeProfileStats.deathsToday % 1).toFixed(2).substring(2)}
                        </span>
                      </div>
                    </div>

                    {/* Net Migration Today */}
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Plane className="w-3 h-3 text-sky-400" />
                        NET MIGRATION TODAY
                      </div>
                      <div className="text-base font-bold text-slate-100 mt-0.5">
                        {activeProfileStats.migrationToday >= 0 ? "+" : ""}
                        {Math.floor(activeProfileStats.migrationToday).toLocaleString()}
                        <span className="text-sky-400/60 text-xs">
                          .{(Math.abs(activeProfileStats.migrationToday) % 1).toFixed(2).substring(2)}
                        </span>
                      </div>
                    </div>

                    {/* Session Net Growth Today */}
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-amber-400" />
                        NET GAIN TODAY
                      </div>
                      <div className="text-base font-bold text-slate-100 mt-0.5">
                        {activeProfileStats.netGrowthToday >= 0 ? "+" : ""}
                        {Math.floor(activeProfileStats.netGrowthToday).toLocaleString()}
                        <span className="text-amber-400/60 text-xs">
                          .{(Math.abs(activeProfileStats.netGrowthToday) % 1).toFixed(2).substring(2)}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Dynamic Demographic Heartbeat Metronome */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    Simulated Demographic Metronome
                  </h4>
                  <Info className="w-4 h-4 text-slate-400" title="Hearts flash at calculated rates based on simulation speed" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Birth Metronome */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center gap-3">
                    <div
                      className="h-10 w-10 shrink-0 bg-emerald-50 rounded-full flex items-center justify-center animate-pulse-green"
                      style={{
                        animationDuration: `${Math.max(0.12, activeProfileStats.secondsPerBirth / speed)}s`,
                      }}
                    >
                      <Heart className="w-5 h-5 text-emerald-600 fill-emerald-500" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Birth Heartbeat</span>
                      <span className="text-xs font-semibold text-slate-700 font-mono mt-0.5 block">
                        {activeProfileStats.secondsPerBirth < 0.1 
                          ? `${(1 / activeProfileStats.secondsPerBirth).toFixed(1)} births / sec`
                          : `1 every ${activeProfileStats.secondsPerBirth.toFixed(1.5)}s`}
                      </span>
                    </div>
                  </div>

                  {/* Death Metronome */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center gap-3">
                    <div
                      className="h-10 w-10 shrink-0 bg-rose-50 rounded-full flex items-center justify-center animate-pulse-red"
                      style={{
                        animationDuration: `${Math.max(0.12, activeProfileStats.secondsPerDeath / speed)}s`,
                      }}
                    >
                      <Heart className="w-5 h-5 text-rose-600 fill-rose-500" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Death Heartbeat</span>
                      <span className="text-xs font-semibold text-slate-700 font-mono mt-0.5 block">
                        {activeProfileStats.secondsPerDeath < 0.1 
                          ? `${(1 / activeProfileStats.secondsPerDeath).toFixed(1)} deaths / sec`
                          : `1 every ${activeProfileStats.secondsPerDeath.toFixed(1.5)}s`}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Natural Births vs Deaths Balance Meter */}
              {selectedCountry && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600 uppercase">
                    <span>Crude Demographics Rates</span>
                    <span className="font-mono text-slate-400 text-[10px]">per 1,000 citizens / yr</span>
                  </div>
                  
                  <div className="space-y-2.5 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                    {/* Birth Rate Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>Birth Rate</span>
                        <span className="font-mono">{selectedCountry.birthRate.toFixed(1)} / 1K</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (selectedCountry.birthRate / 45) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Death Rate Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>Death Rate</span>
                        <span className="font-mono">{selectedCountry.deathRate.toFixed(1)} / 1K</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (selectedCountry.deathRate / 45) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Net Gap Insight */}
                    <div className="text-xs text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
                      <span>Natural Gap:</span>
                      <span className={`font-mono font-semibold ${
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

              {/* Future Projections Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Demographic Projections Forecast
                </h4>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-200">
                        <th className="py-2 px-3">Horizon</th>
                        <th className="py-2 px-3 text-right">Population Outcome</th>
                        <th className="py-2 px-3 text-right">Deaths Total</th>
                        <th className="py-2 px-3 text-right">Change</th>
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
                          <tr key={item.label} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-600 font-sans font-semibold">{item.label}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
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

            {/* Live Event Stream Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Live Demographic Feed
                </h3>
                <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300">
                  SATELLITE DOWNLINK
                </span>
              </div>

              {/* Logs Stream Container */}
              <div className="relative h-44 overflow-y-hidden border border-slate-150 rounded-xl bg-slate-50 shadow-inner p-3">
                <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none"></div>
                
                <div className="space-y-1.5 h-full overflow-y-hidden select-none">
                  <AnimatePresence initial={false}>
                    {liveEvents.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs font-semibold font-sans text-slate-400 text-blink">
                        Establishing communication array...
                      </div>
                    ) : (
                      liveEvents.map((log) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, y: -10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200 shadow-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{log.flag}</span>
                            <span className="font-semibold text-slate-700">{log.countryName}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 font-mono">
                            {log.type === "birth" && (
                              <span className="px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 text-[10px]">
                                🟢 BIRTH
                              </span>
                            )}
                            {log.type === "death" && (
                              <span className="px-1.5 py-0.5 rounded-sm bg-rose-50 text-rose-700 font-bold border border-rose-100 text-[10px]">
                                🔴 DEATH
                              </span>
                            )}
                            {log.type === "migration" && (
                              <span className="px-1.5 py-0.5 rounded-sm bg-sky-50 text-sky-700 font-bold border border-sky-100 text-[10px]">
                                ✈️ MIGRANT
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-medium">{log.timeStr}</span>
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

      </main>

      {/* --- FOOTER CREDITS --- */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2 select-none">
          <p className="text-xs text-slate-400 font-medium">
            World Population & Mortality Tracker © 2026. Built with high-fidelity demographic projection algorithms.
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Baseline Estimates: UN Population Prospects & WHO Mortality Statistics (Reference Year: 2026)
          </p>
          <p className="text-xs font-semibold text-indigo-600/80 mt-1">
            Created By: Aplut
          </p>
        </div>
      </footer>
    </div>
  );
}
