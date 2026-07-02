import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

export function MarketingBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  if (!isVisible) return null;

  const handlePredictionsClick = () => {
    navigate("/predictions");
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <div
      id="marketing-banner"
      tabIndex={-1}
      className="fixed z-50 flex flex-col md:flex-row justify-between w-[calc(100%-2rem)] p-4 -translate-x-1/2 bg-slate-800/90 border border-slate-700 rounded-lg shadow-lg lg:max-w-7xl left-1/2 top-6 backdrop-blur-sm"
    >
      <div className="flex flex-col items-start mb-3 me-4 md:items-center md:flex-row md:mb-0">
        <div className="flex items-center mb-2 border-slate-700 md:pe-4 md:me-4 md:border-e md:mb-0">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-yellow-400 to-lime-500 flex items-center justify-center me-2 flex-shrink-0">
            <span className="text-xs font-bold text-slate-900">SP</span>
          </div>
          <span className="text-white text-lg font-semibold whitespace-nowrap">
            ScorePredicted
          </span>
        </div>
        <p className="flex items-center text-sm font-normal text-slate-300">
          Get today's predictions for your favorite matches
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handlePredictionsClick}
          className="text-white bg-indigo-500 hover:bg-indigo-600 font-medium rounded text-xs px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 whitespace-nowrap"
          style={{ boxShadow: "1px 1px 3px 0px rgba(31, 247, 79, 1)" }}
        >
          Today Predictions
        </button>

        {/* Desktop close button */}
        <button
          type="button"
          onClick={handleClose}
          className="hidden md:inline-flex justify-center text-slate-400 hover:text-white hover:bg-slate-700 w-7 h-7 items-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-slate-600"
          aria-label="Close banner"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={handleClose}
          className="md:hidden text-slate-300 bg-slate-700 border border-slate-600 hover:bg-slate-600 hover:text-white font-medium rounded text-xs px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
