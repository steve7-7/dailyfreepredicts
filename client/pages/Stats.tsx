import { useState, useEffect } from "react";
import {
  TrendingUp,
  AlertCircle,
  Loader,
  BarChart3,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Link } from "react-router-dom";

interface PerformanceStat {
  tipster_id: string;
  tipster_name: string;
  total_predictions: number;
  correct_predictions: number;
  accuracy: number;
  total_profit_loss: number;
  roi: number;
  win_rate: number;
}

type SortKey =
  | "accuracy"
  | "roi"
  | "win_rate"
  | "total_profit_loss"
  | "total_predictions";
type SortOrder = "asc" | "desc";

export default function Stats() {
  const [stats, setStats] = useState<PerformanceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("accuracy");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [minAccuracy, setMinAccuracy] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Fetching performance stats...");
      const response = await fetch("/api/performance-stats?market=classic");

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
      console.log("Performance stats response:", result);

      // Handle different response formats
      let statsData: PerformanceStat[] = [];
      if (Array.isArray(result)) {
        statsData = result;
      } else if (result.data && Array.isArray(result.data)) {
        statsData = result.data;
      } else if (result.tipsters && Array.isArray(result.tipsters)) {
        statsData = result.tipsters;
      } else if (typeof result === "object" && result !== null) {
        // Try to extract array from unknown object structure
        const values = Object.values(result);
        if (Array.isArray(values[0])) {
          statsData = values[0];
        }
      }

      console.log("Processed stats data:", statsData);
      setStats(statsData || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while fetching stats";
      setError(errorMessage);
      console.error("Error fetching stats:", err);
      setStats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const filteredAndSortedStats = Array.isArray(stats)
    ? stats
        .filter((stat) => stat.accuracy >= minAccuracy)
        .sort((a, b) => {
          const aVal = a[sortKey];
          const bVal = b[sortKey];
          const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          return sortOrder === "asc" ? comparison : -comparison;
        })
    : [];

  const avgAccuracy =
    Array.isArray(stats) && stats.length > 0
      ? (stats.reduce((sum, s) => sum + s.accuracy, 0) / stats.length).toFixed(
          1,
        )
      : 0;

  const totalProfit = Array.isArray(stats)
    ? stats.reduce((sum, s) => sum + s.total_profit_loss, 0)
    : 0;
  const avgROI =
    Array.isArray(stats) && stats.length > 0
      ? (stats.reduce((sum, s) => sum + s.roi, 0) / stats.length).toFixed(1)
      : 0;

  const SortHeader = ({
    label,
    sortKeyVal,
  }: {
    label: string;
    sortKeyVal: SortKey;
  }) => (
    <th
      onClick={() => handleSort(sortKeyVal)}
      className="px-6 py-4 text-left text-sm font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortKey === sortKeyVal && (
          <ArrowUpDown
            className={`w-4 h-4 text-yellow-400 transition-transform ${
              sortOrder === "asc" ? "rotate-180" : ""
            }`}
          />
        )}
      </div>
    </th>
  );

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
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Today
              </Link>
              <Link
                to="/stats"
                className="px-3 py-2 text-sm font-semibold text-yellow-400 bg-yellow-400/10 rounded-lg"
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
              <p className="text-xs text-slate-400">Analytics</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <BarChart3 className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">
              Performance Analytics
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Prediction Performance
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl">
            Track accuracy, ROI, and win rates of top tipsters. Use these
            metrics to make informed decisions about prediction sources.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-300">Loading performance stats...</p>
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
                  Error Loading Stats
                </h3>
                <p className="text-sm text-red-400 mt-1">{error}</p>
                <button
                  onClick={fetchStats}
                  className="text-sm font-medium text-red-400 hover:text-red-300 mt-2 underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Summary Cards */}
        {!loading && Array.isArray(stats) && stats.length > 0 && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-700/50 rounded-xl p-6">
              <div className="text-sm font-medium text-blue-300 mb-2">
                Total Tipsters
              </div>
              <div className="text-3xl font-bold text-blue-200">
                {stats.length}
              </div>
              <p className="text-xs text-blue-400 mt-2">Active predictors</p>
            </div>
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6">
              <div className="text-sm font-medium text-purple-300 mb-2">
                Avg Accuracy
              </div>
              <div className="text-3xl font-bold text-purple-200">
                {avgAccuracy}%
              </div>
              <p className="text-xs text-purple-400 mt-2">
                Across all tipsters
              </p>
            </div>
            <div
              className={`bg-gradient-to-br ${totalProfit >= 0 ? "from-green-900/40 to-green-800/40 border border-green-700/50" : "from-red-900/40 to-red-800/40 border border-red-700/50"} rounded-xl p-6`}
            >
              <div
                className={`text-sm font-medium ${totalProfit >= 0 ? "text-green-300" : "text-red-300"} mb-2`}
              >
                Total Profit/Loss
              </div>
              <div
                className={`text-3xl font-bold ${totalProfit >= 0 ? "text-green-200" : "text-red-200"}`}
              >
                {totalProfit >= 0 ? "+" : ""}
                {totalProfit.toFixed(2)}
              </div>
              <p
                className={`text-xs ${totalProfit >= 0 ? "text-green-400" : "text-red-400"} mt-2`}
              >
                Combined returns
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/40 border border-orange-700/50 rounded-xl p-6">
              <div className="text-sm font-medium text-orange-300 mb-2">
                Avg ROI
              </div>
              <div className="text-3xl font-bold text-orange-200">
                {avgROI}%
              </div>
              <p className="text-xs text-orange-400 mt-2">
                Return on investment
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        {!loading && Array.isArray(stats) && stats.length > 0 && (
          <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-white mb-2">
              Filter by minimum accuracy: {minAccuracy}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={minAccuracy}
              onChange={(e) => setMinAccuracy(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Stats Table */}
        {!loading && filteredAndSortedStats.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Rank & Tipster
                    </th>
                    <SortHeader
                      label="Predictions"
                      sortKeyVal="total_predictions"
                    />
                    <SortHeader label="Accuracy" sortKeyVal="accuracy" />
                    <SortHeader label="Win Rate" sortKeyVal="win_rate" />
                    <SortHeader
                      label="Profit/Loss"
                      sortKeyVal="total_profit_loss"
                    />
                    <SortHeader label="ROI" sortKeyVal="roi" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredAndSortedStats.map((stat, index) => (
                    <tr
                      key={stat.tipster_id}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-lime-500 flex items-center justify-center text-slate-900 text-xs font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {stat.tipster_name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {stat.tipster_id}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-white font-medium">
                          {stat.total_predictions}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500"
                              style={{
                                width: `${Math.min(stat.accuracy, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-white w-12">
                            {stat.accuracy.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-white font-medium">
                          {stat.win_rate.toFixed(1)}%
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {stat.total_profit_loss >= 0 ? (
                            <>
                              <ArrowUp className="w-4 h-4 text-green-400" />
                              <span className="text-sm font-medium text-green-400">
                                +{stat.total_profit_loss.toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDown className="w-4 h-4 text-red-400" />
                              <span className="text-sm font-medium text-red-400">
                                {stat.total_profit_loss.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-semibold px-3 py-1 rounded-lg ${
                            stat.roi >= 0
                              ? "bg-green-900/30 text-green-300"
                              : "bg-red-900/30 text-red-300"
                          }`}
                        >
                          {stat.roi >= 0 ? "+" : ""}
                          {stat.roi.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading &&
          filteredAndSortedStats.length === 0 &&
          Array.isArray(stats) &&
          stats.length > 0 && (
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No Tipsters Match Criteria
              </h3>
              <p className="text-slate-300 mb-6">
                Try adjusting the accuracy filter
              </p>
              <button
                onClick={() => setMinAccuracy(0)}
                className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-500 transition-colors font-semibold"
              >
                Reset Filter
              </button>
            </div>
          )}

        {!loading &&
          (!Array.isArray(stats) || stats.length === 0) &&
          !error && (
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No Stats Available
              </h3>
              <p className="text-slate-300 mb-6">
                Check back later for performance data
              </p>
              <button
                onClick={fetchStats}
                className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-500 transition-colors font-semibold"
              >
                Refresh
              </button>
            </div>
          )}

        {/* Info Section */}
        {!loading && Array.isArray(stats) && stats.length > 0 && (
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-6">
              <h3 className="font-semibold text-blue-300 mb-2">Accuracy</h3>
              <p className="text-sm text-blue-400">
                Percentage of correct predictions. Higher values indicate more
                reliable tipsters.
              </p>
            </div>
            <div className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-6">
              <h3 className="font-semibold text-purple-300 mb-2">ROI</h3>
              <p className="text-sm text-purple-400">
                Return on Investment as a percentage. Positive ROI indicates
                profitable predictions.
              </p>
            </div>
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-6">
              <h3 className="font-semibold text-green-300 mb-2">Profit/Loss</h3>
              <p className="text-sm text-green-400">
                Total earnings or losses from all predictions. Combined returns
                across the platform.
              </p>
            </div>
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
                    Predictions
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
