import { useState, useEffect } from "react";
import {
  TrendingUp,
  AlertCircle,
  Loader,
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

interface Result {
  id?: string | number;
  tip?: string;
  odds?: number;
  result?: string;
  date?: string;
  league?: string;
  match?: string;
  status?: string;
  prediction?: string;
  [key: string]: any;
}

type FilterStatus = "all" | "won" | "lost" | "pending";

export default function PreviousResults() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedResult, setSelectedResult] = useState<number | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Fetching past predictions history...");
      const response = await fetch("/api/betigolo-history");

      if (!response.ok) {
        let errorMessage = `Failed to fetch: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error("API error details:", errorData);
        } catch (_) {
          // Response wasn't JSON
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Past predictions response:", result);

      let resultData: Result[] = [];
      if (Array.isArray(result)) {
        resultData = result.map((pred: any) => ({
          id: pred.id,
          tip: pred.prediction,
          odds: pred.odds?.[pred.prediction] || 0,
          result: pred.result,
          date: pred.start_date,
          league: pred.competition_name,
          match: `${pred.home_team} vs ${pred.away_team}`,
          status: pred.status,
          prediction: pred.prediction,
        }));
      } else if (result.data && Array.isArray(result.data)) {
        resultData = result.data.map((pred: any) => ({
          id: pred.id,
          tip: pred.prediction,
          odds: pred.odds?.[pred.prediction] || 0,
          result: pred.result,
          date: pred.start_date,
          league: pred.competition_name,
          match: `${pred.home_team} vs ${pred.away_team}`,
          status: pred.status,
          prediction: pred.prediction,
        }));
      }

      console.log("Processed results data:", resultData);
      setResults(resultData || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while fetching results";
      setError(errorMessage);
      console.error("Error fetching history:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const isResultCorrect = (result: Result): boolean | null => {
    if (!result.status) return null;
    const statusStr = String(result.status).toLowerCase();

    if (statusStr.includes("pending") || statusStr.includes("active"))
      return null;
    if (statusStr.includes("finished")) {
      if (!result.prediction || !result.result) return null;
      return result.prediction === result.result;
    }

    return null;
  };

  const filteredResults = results.filter((result) => {
    const isCorrect = isResultCorrect(result);
    if (filterStatus === "all") return true;
    if (filterStatus === "won") return isCorrect === true;
    if (filterStatus === "lost") return isCorrect === false;
    if (filterStatus === "pending") return isCorrect === null;
    return true;
  });

  const stats = {
    total: results.length,
    won: results.filter((r) => isResultCorrect(r) === true).length,
    lost: results.filter((r) => isResultCorrect(r) === false).length,
    pending: results.filter((r) => isResultCorrect(r) === null).length,
  };

  const winRate =
    stats.won + stats.lost > 0
      ? ((stats.won / (stats.won + stats.lost)) * 100).toFixed(1)
      : 0;

  function formatDate(dateString?: string): string {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  }

  function getResultStatus(result: Result): "won" | "lost" | "pending" {
    const isCorrect = isResultCorrect(result);
    if (isCorrect === true) return "won";
    if (isCorrect === false) return "lost";
    return "pending";
  }

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

            <nav className="flex items-center gap-1 sm:gap-6 flex-1 justify-center">
              <Link
                to="/"
                className="px-3 py-2 text-sm font-semibold text-yellow-400 bg-yellow-400/10 rounded-lg"
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
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                History
              </Link>
            </nav>

            <div className="flex-shrink-0">
              <p className="text-xs text-slate-400">History</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">
              Previous Results
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Prediction Results
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl">
            View all past predictions and track performance. See which tips won
            and analyze patterns to improve future predictions.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-300">Loading previous results...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg border border-red-700/50 bg-red-900/30 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-300">
                  Error Loading Results
                </h3>
                <p className="text-sm text-red-400 mt-1">{error}</p>
                <button
                  onClick={fetchHistory}
                  className="text-sm font-medium text-red-400 hover:text-red-300 mt-2 underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {!loading && stats.total > 0 && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="text-sm font-medium text-slate-400 mb-2">
                Total Results
              </div>
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <p className="text-xs text-slate-500 mt-2">All predictions</p>
            </div>
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-6">
              <div className="text-sm font-medium text-green-300 mb-2">Won</div>
              <div className="text-3xl font-bold text-green-200">
                {stats.won}
              </div>
              <p className="text-xs text-green-400 mt-2">Successful tips</p>
            </div>
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-6">
              <div className="text-sm font-medium text-red-300 mb-2">Lost</div>
              <div className="text-3xl font-bold text-red-200">
                {stats.lost}
              </div>
              <p className="text-xs text-red-400 mt-2">Failed tips</p>
            </div>
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-6">
              <div className="text-sm font-medium text-blue-300 mb-2">
                Win Rate
              </div>
              <div className="text-3xl font-bold text-blue-200">{winRate}%</div>
              <p className="text-xs text-blue-400 mt-2">Success rate</p>
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        {!loading && stats.total > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { value: "all", label: "All", count: stats.total },
              { value: "won", label: "Won", count: stats.won },
              { value: "lost", label: "Lost", count: stats.lost },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value as FilterStatus)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === filter.value
                    ? "bg-yellow-400 text-slate-900"
                    : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-yellow-400/50"
                }`}
              >
                {filter.label}{" "}
                <span className="ml-2 text-sm opacity-70">
                  ({filter.count})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Results List */}
        {!loading && filteredResults.length > 0 && (
          <div className="space-y-4">
            {filteredResults.map((result, idx) => {
              const status = getResultStatus(result);
              return (
                <div
                  key={result.id || idx}
                  onClick={() =>
                    setSelectedResult(selectedResult === idx ? null : idx)
                  }
                  className={`p-6 rounded-xl border cursor-pointer transition-all ${
                    status === "won"
                      ? "bg-green-900/30 border-green-700/50 hover:border-green-600/50"
                      : status === "lost"
                        ? "bg-red-900/30 border-red-700/50 hover:border-red-600/50"
                        : "bg-yellow-900/20 border-yellow-700/50 hover:border-yellow-600/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase">
                          {result.league || result.competition || "Sports"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(result.date)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white mb-2">
                        {result.match || result.tip || "Match"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {status === "won" ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/30 text-green-300 rounded-full">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-semibold">Won</span>
                        </div>
                      ) : status === "lost" ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/30 text-red-300 rounded-full">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs font-semibold">Lost</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/30 text-yellow-300 rounded-full">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-semibold">Pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm mb-2">
                    <div>
                      <span className="text-slate-400">Tip: </span>
                      <span className="font-semibold text-white">
                        {result.tip || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Odds: </span>
                      <span className="font-semibold text-white">
                        {result.odds ? result.odds.toFixed(2) : "N/A"}
                      </span>
                    </div>
                  </div>

                  {result.result && (
                    <div className="text-sm">
                      <span className="text-slate-400">Result: </span>
                      <span className="font-semibold text-white">
                        {result.result}
                      </span>
                    </div>
                  )}

                  {/* Expanded View */}
                  {selectedResult === idx && (
                    <div className="mt-4 pt-4 border-t border-slate-700 animate-in fade-in">
                      <div className="bg-slate-800/50 rounded p-4">
                        <h4 className="text-sm font-semibold text-white mb-3">
                          Full Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          {Object.entries(result).map(([key, value]) => {
                            if (
                              [
                                "id",
                                "tip",
                                "odds",
                                "result",
                                "date",
                                "league",
                                "match",
                                "status",
                              ].includes(key)
                            )
                              return null;
                            return (
                              <div key={key}>
                                <span className="text-slate-400 capitalize">
                                  {key}:{" "}
                                </span>
                                <span className="font-medium text-slate-300">
                                  {String(value)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredResults.length === 0 && !error && (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {filterStatus === "all"
                ? "No Results Yet"
                : `No ${filterStatus} Results`}
            </h3>
            <p className="text-slate-300 mb-6">
              {filterStatus === "all"
                ? "Check back later for prediction results"
                : "Try adjusting your filter"}
            </p>
            {filterStatus !== "all" && (
              <button
                onClick={() => setFilterStatus("all")}
                className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-500 transition-colors font-semibold"
              >
                View All Results
              </button>
            )}
          </div>
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
                  <Link
                    to="/"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    Results
                  </Link>
                </li>
                <li>
                  <Link
                    to="/predictions"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    Today's Picks
                  </Link>
                </li>
                <li>
                  <Link
                    to="/stats"
                    className="hover:text-yellow-400 transition-colors"
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
                  <a
                    href="#"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a
                    href="#"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Follow</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a
                    href="#"
                    className="hover:text-yellow-400 transition-colors"
                  >
                    Twitter
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-yellow-400 transition-colors"
                  >
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
