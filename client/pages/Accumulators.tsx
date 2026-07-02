import { useState, useEffect } from "react";
import { TrendingUp, AlertCircle, Loader, Zap, RefreshCw, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface Accumulator {
  id?: string | number;
  name?: string;
  odds?: number;
  selections?: number;
  potential_return?: number;
  [key: string]: any;
}

export default function Accumulators() {
  const [accumulators, setAccumulators] = useState<Accumulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    cached: boolean;
    cacheExpiry: string;
  } | null>(null);
  const [selectedAccumulator, setSelectedAccumulator] = useState<number | null>(null);

  useEffect(() => {
    fetchAccumulators();
  }, []);

  const fetchAccumulators = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Fetching betminer accumulators...");
      const response = await fetch("/api/betminer-accumulators");
      
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
      console.log("Betminer accumulators response:", result);
      
      // Extract cache info
      if (result.cacheExpiry) {
        setCacheInfo({
          cached: result.cached || false,
          cacheExpiry: result.cacheExpiry,
        });
      }
      
      let accumulatorData: Accumulator[] = [];
      if (Array.isArray(result.data)) {
        accumulatorData = result.data;
      } else if (result.data && Array.isArray(result.data.accumulators)) {
        accumulatorData = result.data.accumulators;
      } else if (result.data && typeof result.data === "object") {
        const values = Object.values(result.data);
        if (Array.isArray(values[0])) {
          accumulatorData = values[0];
        }
      }
      
      console.log("Processed accumulators:", accumulatorData);
      setAccumulators(accumulatorData || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred while fetching accumulators";
      setError(errorMessage);
      console.error("Error fetching accumulators:", err);
      setAccumulators([]);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      const response = await fetch("/api/cache/clear", { method: "POST" });
      if (response.ok) {
        fetchAccumulators();
      }
    } catch (err) {
      console.error("Error clearing cache:", err);
    }
  };

  function formatDate(dateString?: string): string {
    if (!dateString) return new Date().toLocaleDateString();
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

  const timeUntilRefresh = cacheInfo?.cacheExpiry
    ? new Date(cacheInfo.cacheExpiry).getTime() - Date.now()
    : null;
  const hoursUntilRefresh = timeUntilRefresh
    ? Math.round(timeUntilRefresh / (1000 * 60 * 60) * 10) / 10
    : 0;

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
                Results
              </Link>
              <Link to="/predictions" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">
                Today
              </Link>
              <Link to="/accumulators" className="px-3 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg font-semibold">
                Accumulators
              </Link>
              <Link to="/stats" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">
                Stats
              </Link>
            </nav>

            <div className="flex-shrink-0">
              <p className="text-xs text-slate-500">Builds</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Accumulator Builds
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
            Accumulator Bets
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl">
            Explore high-potential accumulator combinations with multiple selections.
            Find the best multi-leg bets for maximum returns.
          </p>
        </div>

        {/* Cache Info */}
        {cacheInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3 justify-between">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900">Data Cache</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {cacheInfo.cached ? "Using cached data" : "Fresh data from API"}
                    {hoursUntilRefresh > 0 && ` • Next update in ${hoursUntilRefresh}h`}
                  </p>
                </div>
              </div>
              <button
                onClick={clearCache}
                className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Loading accumulators...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error Loading Accumulators</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={fetchAccumulators}
                  className="text-sm font-medium text-red-600 hover:text-red-700 mt-2 underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accumulators Grid */}
        {!loading && accumulators.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accumulators.map((acc, idx) => (
              <div
                key={acc.id || idx}
                onClick={() =>
                  setSelectedAccumulator(
                    selectedAccumulator === idx ? null : idx
                  )
                }
                className="bg-gradient-to-br from-indigo/10 to-hot-pink/10 border-2 border-indigo/20 rounded-xl p-6 cursor-pointer hover:border-indigo/50 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {acc.name || `Accumulator ${idx + 1}`}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {acc.selections ? `${acc.selections} selections` : "Multiple selections"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {acc.odds ? acc.odds.toFixed(2) : "—"}
                    </div>
                    <p className="text-xs text-slate-500">Odds</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Potential Return:</span>
                    <span className="font-semibold text-slate-900">
                      {acc.potential_return ? `$${acc.potential_return.toFixed(2)}` : "—"}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedAccumulator === idx && (
                  <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in">
                    <h4 className="font-semibold text-slate-900 mb-3">Full Details</h4>
                    <div className="bg-white/50 rounded p-3 space-y-2 text-sm">
                      {Object.entries(acc).map(([key, value]) => {
                        if (["id", "name", "odds", "selections", "potential_return"].includes(key)) return null;
                        return (
                          <div key={key} className="flex justify-between">
                            <span className="text-slate-600 capitalize">{key}:</span>
                            <span className="font-medium text-slate-900">
                              {String(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-indigo to-hot-pink text-white font-semibold rounded-lg hover:shadow-lg transition-shadow">
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && accumulators.length === 0 && !error && (
          <div className="text-center py-16">
            <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Accumulators Available</h3>
            <p className="text-slate-600 mb-6">Check back later for accumulator builds</p>
            <button
              onClick={fetchAccumulators}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Refresh
            </button>
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
                    Results
                  </Link>
                </li>
                <li>
                  <Link to="/accumulators" className="hover:text-primary transition-colors">
                    Accumulators
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
