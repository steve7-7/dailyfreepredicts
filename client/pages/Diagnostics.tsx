import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle, TrendingUp } from "lucide-react";

interface DiagnosticResult {
  name: string;
  status: "success" | "error" | "warning";
  message: string;
}

export default function Diagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const diagnostics: DiagnosticResult[] = [];

    // Test 1: Backend connectivity
    try {
      const response = await fetch("/api/ping");
      if (response.ok) {
        diagnostics.push({
          name: "Backend Server",
          status: "success",
          message: "Backend is running and responding",
        });
      } else {
        diagnostics.push({
          name: "Backend Server",
          status: "error",
          message: `Server returned ${response.status}`,
        });
      }
    } catch (err) {
      diagnostics.push({
        name: "Backend Server",
        status: "error",
        message: `Cannot connect to backend: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }

    // Test 2: Environment variables
    try {
      const response = await fetch("/api/debug/env");
      if (response.ok) {
        const data = await response.json();
        if (data.hasApiKey) {
          diagnostics.push({
            name: "API Key (RAPIDAPI_KEY)",
            status: "success",
            message: "API key is configured",
          });
        } else {
          diagnostics.push({
            name: "API Key (RAPIDAPI_KEY)",
            status: "error",
            message: "API key is NOT configured in environment",
          });
        }
      }
    } catch (err) {
      diagnostics.push({
        name: "Environment Check",
        status: "error",
        message: `Cannot check environment: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }

    // Test 3: Performance stats endpoint
    try {
      const response = await fetch("/api/performance-stats?market=classic");
      if (response.ok) {
        const data = await response.json();
        diagnostics.push({
          name: "Performance Stats API",
          status: "success",
          message: `API is responding with data (${JSON.stringify(data).length} bytes)`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        diagnostics.push({
          name: "Performance Stats API",
          status: "error",
          message: `API returned ${response.status}: ${errorData.error || response.statusText}`,
        });
      }
    } catch (err) {
      diagnostics.push({
        name: "Performance Stats API",
        status: "error",
        message: `Cannot fetch stats: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }

    setResults(diagnostics);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
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
              <Link to="/past-predictions" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">
                History
              </Link>
            </nav>

            <div className="flex-shrink-0">
              <p className="text-xs text-slate-500">Diagnostics</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">System Diagnostics</h2>
          <p className="text-slate-600">Check backend connectivity and API configuration</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-4 text-slate-600">Running diagnostics...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.name}
                className={`p-4 rounded-lg border ${
                  result.status === "success"
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3
                      className={`font-semibold ${
                        result.status === "success"
                          ? "text-green-900"
                          : "text-red-900"
                      }`}
                    >
                      {result.name}
                    </h3>
                    <p
                      className={`text-sm mt-1 ${
                        result.status === "success"
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {result.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  • If "API Key" shows error, ensure RAPIDAPI_KEY is set in your Netlify/Vercel environment variables
                </li>
                <li>
                  • If "Performance Stats API" shows error, check browser console for detailed error messages
                </li>
                <li>
                  • Run diagnostics again after making changes
                </li>
              </ul>
            </div>

            <button
              onClick={runDiagnostics}
              className="mt-6 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Run Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
