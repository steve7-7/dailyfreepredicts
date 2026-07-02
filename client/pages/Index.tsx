import { useState, useEffect } from "react";
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  Loader,
  BarChart3,
  History,
  Lock,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { SubscriptionVerifyResponse, UserAuthResponse } from "@shared/api";
import { getAuthToken, setAuthToken, clearAuthToken } from "@/utils/auth";

interface Prediction {
  id: number;
  home_team: string;
  away_team: string;
  start_date?: string;
  prediction?: string;
  status?: string;
  odds?: Record<string, number>;
  competition_name?: string;
  competition_cluster?: string;
  federation?: string;
  season?: string;
  is_expired?: boolean;
  market?: string;
  result?: string;
  last_update_at?: string;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const SUBSCRIPTION_URL = "https://paystack.com/buy/today-predictions-vbmpjc";
const PAYSTACK_REFERENCE_PARAMS = ["reference", "trxref"];

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

export default function Index() {
  const [searchParams] = useSearchParams();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<number | null>(
    null,
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const returnedReference = PAYSTACK_REFERENCE_PARAMS.map((param) =>
      searchParams.get(param),
    ).find((value): value is string => !!value);

    if (returnedReference) {
      verifySubscriptionPayment(returnedReference);
    } else {
      checkAuth();
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchPredictions();
    }
  }, [isSubscribed, authLoading]);

  const checkAuth = async () => {
    try {
      const token = getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/auth", { headers });
      if (!response.ok) {
        throw new Error("Failed to check authentication");
      }
      const data: UserAuthResponse = await response.json();
      setIsSubscribed(data.isSubscribed);
    } catch (err) {
      console.error("Error checking auth:", err);
      setIsSubscribed(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const verifySubscriptionPayment = async (reference: string) => {
    try {
      setAuthLoading(true);
      setError(null);

      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reference }),
      });

      if (!response.ok) {
        throw new Error("Unable to verify your Paystack payment");
      }

      const data: SubscriptionVerifyResponse = await response.json();
      setAuthToken(data.token);
      setIsSubscribed(data.isSubscribed);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      clearAuthToken();
      setIsSubscribed(false);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify your subscription payment",
      );
      console.error("Error verifying subscription payment:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubscribe = () => {
    const checkoutUrl = new URL(SUBSCRIPTION_URL);
    checkoutUrl.searchParams.set(
      "redirect_url",
      `${window.location.origin}${window.location.pathname}`,
    );
    window.location.href = checkoutUrl.toString();
  };

  const handleLogout = () => {
    clearAuthToken();
    setIsSubscribed(false);
    setPredictions([]);
  };

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/predictions", { headers });

      if (!response.ok) {
        let errorMessage = `Failed to fetch predictions: ${response.status} ${response.statusText}`;
        let isRetryable = response.status >= 500;

        try {
          const errorData = await response.json();
          console.error("[Index] API error response:", errorData);

          // Parse error code and provide specific guidance
          const code = errorData.code;
          isRetryable = errorData.retryable !== false;

          switch (code) {
            case "API_KEY_MISSING":
              errorMessage = "API key not configured on server. Please contact support.";
              isRetryable = false;
              break;
            case "API_AUTH_FAILED":
              errorMessage = "API authentication failed. Please contact support.";
              isRetryable = false;
              break;
            case "RATE_LIMITED":
              const retryAfter = errorData.retryAfter ? ` in ${errorData.retryAfter} seconds` : "";
              errorMessage = `Too many requests. Please try again${retryAfter}.`;
              isRetryable = true;
              break;
            case "INVALID_RESPONSE":
              errorMessage = "Server received invalid data from API. Please try again later.";
              isRetryable = false;
              break;
            case "NETWORK_ERROR":
              errorMessage = "Network error while fetching predictions. Please check your connection.";
              isRetryable = true;
              break;
            case "FETCH_FAILED":
              errorMessage = "Failed to fetch predictions. Please try again.";
              isRetryable = true;
              break;
            default:
              errorMessage = errorData.error || errorData.details || errorMessage;
          }
        } catch (_) {
          // Response wasn't JSON, use default error message
        }

        const error = new Error(errorMessage);
        (error as any).isRetryable = isRetryable;
        throw error;
      }

      const result = await response.json();
      const predictionsData = result.data || [];
      setPredictions(predictionsData);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : "An error occurred while fetching predictions";
      setError(errorMessage);
      console.error("Error fetching predictions:", err);
    } finally {
      setLoading(false);
    }
  };

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

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-white hidden sm:block">
                {new Date().toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs text-slate-400">
                {predictions.length} match{predictions.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <Calendar className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">
              Daily Predictions
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Today's Predictions
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl">
            Expert predictions for today's matches with comprehensive odds
            across multiple markets.
          </p>
        </div>

        {/* Subscription Gate */}
        {!authLoading && !isSubscribed && (
          <div className="mb-8 p-8 rounded-2xl border-2 border-yellow-400/20 bg-gradient-to-r from-yellow-400/5 to-yellow-500/5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-400/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  Premium Feature
                </h3>
                <p className="text-slate-300 mt-1">
                  Subscribe to unlock today's predictions and expert analysis
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 my-6">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-sm font-semibold text-slate-300 mb-2">
                  ✓ Daily Predictions
                </div>
                <div className="text-sm text-slate-400">
                  Fresh predictions for every match
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-sm font-semibold text-slate-300 mb-2">
                  ✓ Live Odds
                </div>
                <div className="text-sm text-slate-400">
                  Real-time odds across all markets
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-sm font-semibold text-slate-300 mb-2">
                  ✓ Performance Stats
                </div>
                <div className="text-sm text-slate-400">
                  Detailed accuracy and historical data
                </div>
              </div>
            </div>
            <button
              onClick={handleSubscribe}
              className="px-6 py-3 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
            >
              Subscribe Now
            </button>
          </div>
        )}

        {/* Subscription Status Bar */}
        {isSubscribed && !authLoading && (
          <div className="mb-8 p-4 rounded-lg bg-green-900/30 border border-green-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                ✓
              </div>
              <p className="text-green-300 font-medium">
                You have access to daily predictions
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-green-400 hover:text-green-300 font-medium underline"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Loading State */}
        {(authLoading || loading) && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-300">
                {authLoading ? "Checking access..." : "Loading predictions..."}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg border border-red-700/50 bg-red-900/30 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-300">
                  Error Loading Predictions
                </h3>
                <p className="text-sm text-red-400 mt-1">{error}</p>
                {(error as any)?.isRetryable !== false && (
                  <p className="text-xs text-red-500 mt-2 italic">
                    This error may be temporary. Try again in a moment.
                  </p>
                )}
                <button
                  onClick={fetchPredictions}
                  className="text-sm font-medium text-red-400 hover:text-red-300 mt-2 underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Predictions Grid */}
        {!loading && predictions.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {predictions.map((match) => (
              <div
                key={match.id}
                onClick={() =>
                  setSelectedPrediction(
                    selectedPrediction === match.id ? null : match.id,
                  )
                }
                className="group cursor-pointer bg-slate-800 rounded-xl border border-slate-700 hover:border-yellow-400/50 hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                {/* Match Header */}
                <div className="p-6 pb-4 border-b border-slate-700">
                  {isSubscribed && (
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          {match.competition_name}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          {match.competition_cluster} • {match.season}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-900/50 text-blue-300 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        {match.status}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-white mt-4">
                    <div className="text-sm font-medium flex-1">
                      {match.home_team}
                    </div>
                    <span className="text-xs text-slate-400 px-2 whitespace-nowrap">
                      {formatTime(match.start_date)}
                    </span>
                    <div className="text-sm font-medium flex-1 text-right">
                      {match.away_team}
                    </div>
                  </div>
                </div>

                {/* Prediction Highlight */}
                <div className="px-6 py-4 bg-gradient-to-r from-yellow-400/10 to-yellow-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      Our Prediction:
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-yellow-400/20 text-yellow-300 font-semibold text-sm border border-yellow-400/30">
                      <span className="w-2 h-2 rounded-full bg-yellow-300" />
                      {getPredictionLabel(match.prediction)}
                    </span>
                  </div>
                </div>

                {/* Odds Preview / Expanded */}
                {selectedPrediction === match.id && match.odds && (
                  <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700 animate-in fade-in duration-200">
                    <h4 className="text-sm font-semibold text-white mb-3">
                      Available Odds
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(match.odds).map(([market, odd]) => (
                        <div
                          key={market}
                          className="bg-slate-700 p-2 rounded border border-slate-600 text-center hover:border-yellow-400/50 transition-colors"
                        >
                          <div className="text-xs font-semibold text-slate-300">
                            {market}
                          </div>
                          <div className="text-sm font-bold text-yellow-400 mt-1">
                            {odd.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-800 border-t border-slate-700">
                  <button className="w-full text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors">
                    {selectedPrediction === match.id
                      ? "Hide Odds"
                      : "View Full Odds"}
                  </button>
                </div>

                {/* Locked Content */}
                {!isSubscribed && (
                  <div className="px-6 py-4 bg-gradient-to-r from-yellow-400/10 to-yellow-500/5 border-t border-slate-700">
                    <div className="flex items-center gap-2 text-sm text-slate-300 mb-4">
                      <Lock className="w-4 h-4 text-yellow-400" />
                      <span>
                        Subscribe to unlock predictions, odds, and analysis.
                      </span>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSubscribe();
                      }}
                      className="w-full px-4 py-2.5 bg-yellow-400 text-slate-900 font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
                    >
                      Subscribe to Unlock
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && predictions.length === 0 && !error && (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No Predictions Available
            </h3>
            <p className="text-slate-300 mb-6">
              Check back later for today's matches
            </p>
            <button
              onClick={fetchPredictions}
              className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-500 transition-colors font-semibold"
            >
              Refresh
            </button>
          </div>
        )}

        {/* CTA Section */}
        {isSubscribed && predictions.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400/80 rounded-2xl p-8 md:p-12 text-center text-slate-900">
            <h3 className="text-3xl font-bold mb-3">Stay Updated</h3>
            <p className="text-slate-800 mb-6 max-w-2xl mx-auto">
              Get daily predictions delivered to your inbox. Sign up to receive
              expert analysis and odds updates.
            </p>
            <div className="flex gap-3 justify-center flex-col sm:flex-row">
              <input
                type="email"
                placeholder="Enter your email"
                className="px-4 py-3 rounded-lg text-slate-900 placeholder-slate-600 flex-1 sm:flex-initial sm:min-w-64 focus:outline-none focus:ring-2 focus:ring-slate-900/50"
              />
              <button className="px-6 py-3 bg-slate-900 text-yellow-400 font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                Subscribe
              </button>
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
                  <a href="#" className="hover:text-yellow-400 transition-colors">
                    Predictions
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-yellow-400 transition-colors">
                    Analytics
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-yellow-400 transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-yellow-400 transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-yellow-400 transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-yellow-400 transition-colors">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Follow</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <a href="#" className="hover:text-yellow-400 transition-colors">
                    Twitter
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-yellow-400 transition-colors">
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
