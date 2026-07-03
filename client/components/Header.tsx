import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface HeaderProps {
  activePath?: string;
  matchCount?: number;
}

const navLinks = [
  { href: "/results", label: "Results" },
  { href: "/predictions", label: "Today" },
  { href: "/stats", label: "Stats" },
  { href: "/", label: "History" },
];

export function Header({ activePath = "/", matchCount }: HeaderProps) {
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => activePath === href;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-lime-500 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-slate-900" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white leading-tight">
                ScorePredicted
              </h1>
              <p className="text-xs text-slate-400">Predictions</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-4 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive(link.href)
                    ? "text-yellow-400 bg-yellow-400/10"
                    : "text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Match Count */}
          <div className="hidden md:flex flex-shrink-0">
            {matchCount !== undefined && (
              <span className="text-xs text-slate-500">
                {matchCount} matches
              </span>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            {matchCount !== undefined && (
              <span className="text-xs text-slate-500">{matchCount}</span>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-lg text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50 transition-colors">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-64 border-l border-slate-800 bg-slate-900 p-0"
              >
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <nav className="flex flex-col gap-1 p-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "px-4 py-3 text-sm font-medium rounded-lg transition-colors block",
                        isActive(link.href)
                          ? "text-yellow-400 bg-yellow-400/10"
                          : "text-slate-300 hover:text-yellow-400 hover:bg-slate-800/50",
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
