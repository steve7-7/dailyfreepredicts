import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  AlertCircle,
  Loader,
  History,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Globe,
  Calendar,
  Target,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";

interface HistoryMatch {
  match_dat: string;
  sport: string;
  country: string;
  league: string;
  home_team: string;
  away_team: string;
  tip: string;
  fair_odd: number;
  tip_odd: number;
  result: string;
  tip_successful: boolean | string | number;
  tip_profit: number;
}

type FilterStatus = "all" | "won" | "lost";

const PAGE_SIZE = 50;

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function PastPredictions() {
  const [matches, setMatches] = useState<HistoryMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/betigolo-history");
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data: HistoryMatch[] = await res.json();
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.match_dat).getTime() - new Date(a.match_dat).getTime(),
      );
      setMatches(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setExpanded(null);
  }, [filter, search, leagueFilter]);

  const leagues = useMemo(() => {
    const set = new Set(matches.map((m) => m.league));
    return ["all", ...Array.from(set).sort()];
  }, [matches]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      // Ensure tip_successful is properly evaluated as boolean
      const isWon = m.tip_successful === true || m.tip_successful === "true" || m.tip_successful === 1;
      if (filter === "won" && !isWon) return false;
      if (filter === "lost" && isWon) return false;
      if (leagueFilter !== "all" && m.league !== leagueFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.home_team.toLowerCase().includes(q) ||
          m.away_team.toLowerCase().includes(q) ||
          m.league.toLowerCase().includes(q) ||
          m.country.toLowerCase().includes(q) ||
          m.tip.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [matches, filter, leagueFilter, search]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const won = matches.filter((m) => m.tip_successful).length;
  const lost = matches.filter((m) => !m.tip_successful).length;
  const winRate =
    won + lost > 0 ? ((won / (won + lost)) * 100).toFixed(1) : "0";
  const totalProfit = matches.reduce((s, m) => s + (m.tip_profit ?? 0), 0);
  const totalStaked = matches.length;
  const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(1) : "0";

  // Calculate current streak
  const getCurrentStreak = () => {
    let streak = 0;
    let streakType = "none";
    for (const match of matches) {
      const matchWon = match.tip_successful === true || match.tip_successful === "true" || match.tip_successful === 1;
      if (streak === 0) {
        streakType = matchWon ? "won" : "lost";
        streak = 1;
      } else if ((matchWon && streakType === "won") || (!matchWon && streakType === "lost")) {
        streak++;
      } else {
        break;
      }
    }
    return { streak, type: streakType };
  };
  const currentStreak = getCurrentStreak();

  // Per-league stats
  const leagueStats = matches.reduce((acc, m) => {
    if (!acc[m.league]) {
      acc[m.league] = { won: 0, total: 0 };
    }
    acc[m.league].total++;
    const isWon = m.tip_successful === true || m.tip_successful === "true" || m.tip_successful === 1;
    if (isWon) acc[m.league].won++;
    return acc;
  }, {} as Record<string, { won: number; total: number }>);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between h-14">
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-lime-500 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-slate-900" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white leading-tight">
                  ScorePredicted
                </h1>
                <p className="text-xs text-slate-400">Predictions</p>
              </div>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-4 flex-1 justify-center">
              <Link
                to="/results"
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Results
              </Link>
              <Link
                to="/predictions"
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Today
              </Link>
              <Link
                to="/stats"
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Stats
              </Link>
              <Link
                to="/"
                className="px-3 py-2 text-sm font-semibold text-yellow-400 bg-yellow-400/10 rounded-lg"
              >
                History
              </Link>
            </nav>

            <div className="flex-shrink-0">
              <span className="text-xs text-slate-500">
                {filtered.length} matches
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <History className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Full History
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Prediction History
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl">
            {matches.length.toLocaleString()} predictions published. Search,
            filter by result or league, and see every detail.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 text-primary animate-spin mr-3" />
            <p className="text-slate-400">Loading history…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-4 rounded-lg border border-red-200/30 bg-red-900/20 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">
                Error loading history
              </p>
              <p className="text-sm text-red-300/80 mt-1">{error}</p>
              <button
                onClick={fetchHistory}
                className="text-sm text-red-300 underline mt-2 hover:text-red-200"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && matches.length > 0 && (
          <>
            {/* Stats row - Top */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Total
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {matches.length.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">All predictions</p>
              </div>

              <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
                    Won
                  </span>
                </div>
                <div className="text-3xl font-bold text-green-300">{won}</div>
                <p className="text-xs text-green-400/70 mt-1">
                  {winRate}% win rate
                </p>
              </div>

              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                    Lost
                  </span>
                </div>
                <div className="text-3xl font-bold text-red-300">{lost}</div>
                <p className="text-xs text-red-400/70 mt-1">Failed tips</p>
              </div>

              <div
                className={`${totalProfit >= 0 ? "bg-emerald-900/30 border-emerald-700/50" : "bg-red-900/30 border-red-700/50"} border rounded-xl p-5`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign
                    className={`w-4 h-4 ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  />
                  <span
                    className={`text-xs font-medium uppercase tracking-wide ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    Profit
                  </span>
                </div>
                <div
                  className={`text-3xl font-bold ${totalProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}
                >
                  {totalProfit >= 0 ? "+" : ""}
                  {totalProfit.toFixed(1)}u
                </div>
                <p
                  className={`text-xs mt-1 ${totalProfit >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}
                >
                  Total units
                </p>
              </div>
            </div>

            {/* Stats row - Bottom */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className={`${parseFloat(roi) >= 0 ? "bg-blue-900/30 border-blue-700/50" : "bg-red-900/30 border-red-700/50"} border rounded-xl p-5`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={`w-4 h-4 ${parseFloat(roi) >= 0 ? "text-blue-400" : "text-red-400"}`} />
                  <span className={`text-xs font-medium uppercase tracking-wide ${parseFloat(roi) >= 0 ? "text-blue-400" : "text-red-400"}`}>
                    ROI
                  </span>
                </div>
                <div className={`text-3xl font-bold ${parseFloat(roi) >= 0 ? "text-blue-300" : "text-red-300"}`}>
                  {parseFloat(roi) >= 0 ? "+" : ""}
                  {roi}%
                </div>
                <p className={`text-xs mt-1 ${parseFloat(roi) >= 0 ? "text-blue-400/70" : "text-red-400/70"}`}>
                  Return on investment
                </p>
              </div>

              <div className={`${currentStreak.type === "won" ? "bg-green-900/30 border-green-700/50" : "bg-red-900/30 border-red-700/50"} border rounded-xl p-5`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={`w-4 h-4 ${currentStreak.type === "won" ? "text-green-400" : "text-red-400"}`} />
                  <span className={`text-xs font-medium uppercase tracking-wide ${currentStreak.type === "won" ? "text-green-400" : "text-red-400"}`}>
                    Streak
                  </span>
                </div>
                <div className={`text-3xl font-bold ${currentStreak.type === "won" ? "text-green-300" : "text-red-300"}`}>
                  {currentStreak.streak} {currentStreak.type === "won" ? "W" : "L"}
                </div>
                <p className={`text-xs mt-1 ${currentStreak.type === "won" ? "text-green-400/70" : "text-red-400/70"}`}>
                  Current streak
                </p>
              </div>

              <div className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                    Avg Odds
                  </span>
                </div>
                <div className="text-3xl font-bold text-purple-300">
                  {(matches.reduce((s, m) => s + (m.tip_odd ?? 0), 0) / matches.length).toFixed(2)}
                </div>
                <p className="text-xs text-purple-400/70 mt-1">
                  Average odds offered
                </p>
              </div>
            </div>

            {/* Filters bar */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search team, league, country or tip…"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-700 rounded-lg text-sm bg-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Result filters */}
                {(["all", "won", "lost"] as FilterStatus[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                      filter === f
                        ? "bg-primary text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {f === "all"
                      ? `All (${matches.length})`
                      : f === "won"
                        ? `Won (${won})`
                        : `Lost (${lost})`}
                  </button>
                ))}

                {/* League dropdown */}
                <select
                  value={leagueFilter}
                  onChange={(e) => setLeagueFilter(e.target.value)}
                  className="ml-auto px-3 py-1.5 border border-slate-700 rounded-lg text-sm bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary max-w-[220px]"
                >
                  <option value="all">All Leagues</option>
                  {leagues.slice(1).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {(search || leagueFilter !== "all" || filter !== "all") && (
                <p className="text-xs text-slate-400">
                  Showing {filtered.length.toLocaleString()} of{" "}
                  {matches.length.toLocaleString()} predictions
                  <button
                    onClick={() => {
                      setSearch("");
                      setLeagueFilter("all");
                      setFilter("all");
                    }}
                    className="ml-2 text-primary underline"
                  >
                    Clear filters
                  </button>
                </p>
              )}
            </div>

            {/* Match list */}
            <div className="space-y-3">
              {paginated.map((match, idx) => {
                const isWon =
                  match.tip_successful === true ||
                  match.tip_successful === "true" ||
                  match.tip_successful === 1;

                return (
                  <div
                    key={idx}
                    className={`cursor-pointer rounded-xl border overflow-hidden transition-all ${
                      isWon
                        ? "bg-green-900/30 border-green-700/50 hover:border-green-600"
                        : "bg-red-900/30 border-red-700/50 hover:border-red-600"
                    }`}
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                              <Globe className="w-3.5 h-3.5" />
                              {match.country} · {match.league}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Calendar className="w-3 h-3" />
                              {formatDate(match.match_dat)} {formatTime(match.match_dat)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-base font-bold text-white truncate">
                              {match.home_team}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 flex-shrink-0">
                              vs
                            </span>
                            <span className="text-base font-bold text-white truncate">
                              {match.away_team}
                            </span>
                          </div>
                        </div>

                        <div className="flex-shrink-0 flex items-center gap-2">
                          {isWon ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/30 text-green-300 rounded-full">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-xs font-bold">Won</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/30 text-red-300 rounded-full">
                              <XCircle className="w-4 h-4" />
                              <span className="text-xs font-bold">Lost</span>
                            </div>
                          )}
                          {expanded === idx ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Tip</p>
                          <p className="text-sm font-bold text-primary leading-tight">
                            {match.tip}
                          </p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Tip Odds</p>
                          <p className="text-sm font-bold text-white">
                            {match.tip_odd?.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Score</p>
                          <p className="text-sm font-bold text-white">
                            {match.result}
                          </p>
                        </div>
                        <div
                          className={`rounded-lg p-3 border ${match.tip_profit >= 0 ? "bg-green-900/30 border-green-700/50" : "bg-red-900/30 border-red-700/50"}`}
                        >
                          <p className="text-xs text-slate-400 mb-1">Profit</p>
                          <div className="flex items-center gap-1">
                            {match.tip_profit >= 0 ? (
                              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            )}
                            <p
                              className={`text-sm font-bold ${match.tip_profit >= 0 ? "text-green-300" : "text-red-300"}`}
                            >
                              {match.tip_profit >= 0 ? "+" : ""}
                              {match.tip_profit?.toFixed(1)}u
                            </p>
                          </div>
                        </div>
                      </div>

                      {expanded === idx && (
                        <div className="mt-4 pt-4 border-t border-slate-700 animate-in fade-in duration-200">
                          <div className="grid sm:grid-cols-3 gap-3 text-sm">
                            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                              <p className="text-xs text-slate-400 mb-1">Sport</p>
                              <p className="font-semibold text-white">
                                {match.sport}
                              </p>
                            </div>
                            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                              <p className="text-xs text-slate-400 mb-1">Fair Odd</p>
                              <p className="font-semibold text-white">
                                {match.fair_odd?.toFixed(2)}
                              </p>
                            </div>
                            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                              <p className="text-xs text-slate-400 mb-1">Value Edge</p>
                              <p
                                className={`font-semibold ${match.tip_odd > match.fair_odd ? "text-green-400" : "text-slate-400"}`}
                              >
                                {match.tip_odd > match.fair_odd
                                  ? `+${((match.tip_odd / match.fair_odd - 1) * 100).toFixed(1)}%`
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="px-8 py-3 bg-slate-800 border-2 border-primary/30 text-primary font-semibold rounded-xl hover:bg-primary/10 transition-colors"
                >
                  Load more ({filtered.length - paginated.length} remaining)
                </button>
              </div>
            )}

            {/* Empty */}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-2">
                  No matches found
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Try adjusting your search or filters
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setLeagueFilter("all");
                    setFilter("all");
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link to="/" className="hover:text-primary transition-colors">
                    Results
                  </Link>
                </li>
                <li>
                  <Link
                    to="/past-predictions"
                    className="hover:text-primary transition-colors"
                  >
                    History
                  </Link>
                </li>
                <li>
                  <Link
                    to="/stats"
                    className="hover:text-primary transition-colors"
                  >
                    Stats
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Follow</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Twitter
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Discord
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8">
            <p className="text-center text-sm text-slate-400">
              © 2026 ScorePredicted. All predictions are for entertainment
              purposes only.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
