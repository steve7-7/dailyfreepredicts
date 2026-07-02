import { useState, useEffect } from "react";
import { TrendingUp, AlertCircle, Loader, History, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface PastPrediction {
  id: number;
  start_date: string;
  home_team: string;
  away_team: string;
  prediction: string;
  status: string;
  result: string;
  odds: Record<string, number>;
  competition_name: string;
  competition_cluster: string;
  federation: string;
  season: string;
  is_expired: boolean;
  market: string;
  last_update_at: string;
}

type FilterStatus = "all" | "won" | "lost" | "pending";

export default function PastPredictions() {
  const [predictions, setPredictions] = useState<PastPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedPrediction, setSelectedPrediction] = useState<string | null>(null);

  useEffect(() => {
    fetchPastPredictions();
  }, []);

  const fetchPastPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
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
      
      let predictionsData: PastPrediction[] = [];
      if (Array.isArray(result)) {
        predictionsData = result;
      } else if (result.data && Array.isArray(result.data)) {
        predictionsData = result.data;
      }
      
      console.log("Processed predictions data:", predictionsData);
      setPredictions(predictionsData || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred while fetching predictions";
      setError(errorMessage);
      console.error("Error fetching predictions:", err);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const isPredictionCorrect = (pred: PastPrediction): boolean => {
    if (!pred.result || pred.status !== "finished") return false;
    return pred.prediction === pred.result;
  };

  const filteredPredictions = predictions.filter((pred) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "won") return isPredictionCorrect(pred);
    if (filterStatus === "lost") return pred.status === "finished" && !isPredictionCorrect(pred);
    if (filterStatus === "pending") return pred.status !== "finished";
    return true;
  });

  const stats = {
    total: predictions.length,
    won: predictions.filter(isPredictionCorrect).length,
    lost: predictions.filter((p) => p.status === "finished" && !isPredictionCorrect(p)).length,
    pending: predictions.filter((p) => p.status !== "finished").length,
  };

  const winRate = stats.total > 0
    ? ((stats.won / (stats.won + stats.lost)) * 100).toFixed(1)
    : 0;

  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getPredictionLabel(prediction: string): string {
    switch (prediction) {
      case "1":
        return "Home Win";
      case "2":
        return "Away Win";
      case "X":
        return "Draw";
      case "1X":
        return "Home Win or Draw";
      case "12":
        return "Home or Away Win";
      case "X2":
        return "Draw or Away Win";
      default:
        return prediction;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo to-hot-pink flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  ScorePredicted
                </h1>
                <p className="text-xs text-slate-500">Predictions</p>
              </div>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-6 flex-1 justify-center">
              <Link to="/" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">
                Today
              </Link>
              <Link to="/stats" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">
                Stats
              </Link>
              <Link to="/past-predictions" className="px-3 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg font-semibold">
                History
              </Link>
            </nav>

            <div className="flex-shrink-0">
              <p className="text-xs text-slate-500">Past Results</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <History className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Past Predictions
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
            Prediction History
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl">
            View completed predictions and track which ones won or lost. Analyze past
            performance to improve future decisions.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Loading past predictions...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error Loading Predictions</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={fetchPastPredictions}
                  className="text-sm font-medium text-red-600 hover:text-red-700 mt-2 underline"
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
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="text-sm font-medium text-slate-600 mb-2">Total Predictions</div>
              <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
              <p className="text-xs text-slate-500 mt-2">All time predictions</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="text-sm font-medium text-green-700 mb-2">Won</div>
              <div className="text-3xl font-bold text-green-900">{stats.won}</div>
              <p className="text-xs text-green-600 mt-2">Successful predictions</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="text-sm font-medium text-red-700 mb-2">Lost</div>
              <div className="text-3xl font-bold text-red-900">{stats.lost}</div>
              <p className="text-xs text-red-600 mt-2">Failed predictions</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="text-sm font-medium text-blue-700 mb-2">Win Rate</div>
              <div className="text-3xl font-bold text-blue-900">{winRate}%</div>
              <p className="text-xs text-blue-600 mt-2">Success rate</p>
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
                    ? "bg-primary text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-primary"
                }`}
              >
                {filter.label} <span className="ml-2 text-sm opacity-70">({filter.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Predictions List */}
        {!loading && filteredPredictions.length > 0 && (
          <div className="space-y-4">
            {filteredPredictions.map((pred, index) => {
              const isWon = isPredictionCorrect(pred);
              const predKey = pred.id || `prediction-${index}`;
              return (
                <div
                  key={predKey}
                  onClick={() =>
                    setSelectedPrediction(
                      selectedPrediction === predKey ? null : predKey
                    )
                  }
                  className={`p-6 rounded-xl border cursor-pointer transition-all ${
                    isWon
                      ? "bg-green-50 border-green-200 hover:border-green-400"
                      : pred.status === "finished"
                      ? "bg-red-50 border-red-200 hover:border-red-400"
                      : "bg-yellow-50 border-yellow-200 hover:border-yellow-400"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          {pred.competition_name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(pred.start_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-sm font-semibold text-slate-900">
                          {pred.home_team}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">vs</span>
                        <div className="text-sm font-semibold text-slate-900">
                          {pred.away_team}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isWon ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-200 text-green-900 rounded-full">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-semibold">Won</span>
                        </div>
                      ) : pred.status === "finished" ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-200 text-red-900 rounded-full">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs font-semibold">Lost</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-200 text-yellow-900 rounded-full">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-semibold">Pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-slate-600">Our Prediction: </span>
                      <span className="font-semibold text-slate-900">
                        {getPredictionLabel(pred.prediction)}
                      </span>
                    </div>
                    {pred.status === "finished" && (
                      <div>
                        <span className="text-slate-600">Result: </span>
                        <span className="font-semibold text-slate-900">
                          {getPredictionLabel(pred.result)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded View */}
                  {selectedPrediction === predKey && (
                    <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">
                            Odds
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(pred.odds).map(([market, odd]) => (
                              <div
                                key={market}
                                className="bg-white/50 p-2 rounded border border-slate-200 text-center"
                              >
                                <div className="text-xs font-semibold text-slate-600">
                                  {market}
                                </div>
                                <div className="text-sm font-bold text-primary mt-1">
                                  {odd.toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">
                            Details
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-slate-600">Season: </span>
                              <span className="font-medium text-slate-900">{pred.season}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Region: </span>
                              <span className="font-medium text-slate-900">
                                {pred.competition_cluster}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600">Time: </span>
                              <span className="font-medium text-slate-900">
                                {formatTime(pred.start_date)}
                              </span>
                            </div>
                          </div>
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
        {!loading && filteredPredictions.length === 0 && !error && (
          <div className="text-center py-16">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {filterStatus === "all"
                ? "No Predictions Yet"
                : `No ${filterStatus} Predictions`}
            </h3>
            <p className="text-slate-600 mb-6">
              {filterStatus === "all"
                ? "Check back later for prediction history"
                : "Try adjusting your filter"}
            </p>
            {filterStatus !== "all" && (
              <button
                onClick={() => setFilterStatus("all")}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                View All Predictions
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  <Link to="/" className="hover:text-primary transition-colors">
                    Predictions
                  </Link>
                </li>
                <li>
                  <Link to="/past-predictions" className="hover:text-primary transition-colors">
                    History
                  </Link>
                </li>
                <li>
                  <Link to="/stats" className="hover:text-primary transition-colors">
                    Stats
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-600">
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
              <h4 className="font-semibold text-slate-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-600">
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
              <h4 className="font-semibold text-slate-900 mb-4">Follow</h4>
              <ul className="space-y-2 text-sm text-slate-600">
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
          <div className="border-t border-slate-200 pt-8">
            <p className="text-center text-sm text-slate-600">
              © 2026 ScorePredicted. All predictions are for entertainment purposes only.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
