"use client";

import { useEffect, useState, useRef } from "react";
import { useTour } from "./DashboardTourProvider";
import { TOUR_GROUPS } from "./TourSteps";
import {
  X,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Check,
  Compass,
} from "lucide-react";

/**
 * TourOverlay — a full-screen semi-transparent overlay with a
 * positioned tooltip that highlights sidebar items and explains
 * each feature. Auto-scrolls to the highlighted element.
 */
export function TourOverlay() {
  const {
    active,
    step,
    currentStep,
    totalSteps,
    progress,
    nextStep,
    prevStep,
    goToStep,
    endTour,
  } = useTour();

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipSide, setTooltipSide] = useState<"right" | "left" | "center">(
    "center"
  );

  // Track window width for tooltip positioning
  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window.innerWidth;
      const timer = setTimeout(() => setWindowWidth(w), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // Focus trap: keep focus inside the tooltip while tour is active
  useEffect(() => {
    if (!active || !tooltipRef.current) return;
    const tooltip = tooltipRef.current;
    // Focus the tooltip on mount
    tooltip.focus();

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = tooltip.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleTabTrap);
    return () => document.removeEventListener("keydown", handleTabTrap);
  }, [active, currentStep]);

  // Find and scroll to the highlighted element
  useEffect(() => {
    if (!active || !step?.selector) {
      if (highlightRect) {
        requestAnimationFrame(() => {
          setHighlightRect(null);
          setTooltipSide("center");
        });
      }
      return;
    }

    const nav = document.querySelector("nav");
    const root = nav ?? document;
    const el = root.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const rect = el.getBoundingClientRect();
      requestAnimationFrame(() => {
        setHighlightRect(rect);
        if (windowWidth > 0 && rect.left > windowWidth / 2) {
          setTooltipSide("left");
        } else {
          setTooltipSide("right");
        }
      });
    } else {
      requestAnimationFrame(() => {
        setHighlightRect(null);
        setTooltipSide("center");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step?.id, step?.selector, windowWidth]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
      if (e.key === "ArrowRight" || e.key === "Enter") nextStep();
      if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, nextStep, prevStep, endTour]);

  // Prevent body scroll while tour is active
  useEffect(() => {
    if (active) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  if (!active || !step) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const currentGroup = step.group;
  const groupIndex = TOUR_GROUPS.indexOf(currentGroup as typeof TOUR_GROUPS[number]);

  // Position the tooltip
  let tooltipStyle: React.CSSProperties = {};
  const tooltipClass = "fixed z-[100]";

  if (highlightRect && tooltipSide !== "center") {
    if (tooltipSide === "right") {
      tooltipStyle = {
        left: `${highlightRect.right + 16}px`,
        top: `${Math.max(16, highlightRect.top - 10)}px`,
        maxWidth: "420px",
      };
    } else {
      tooltipStyle = {
        right: `${windowWidth - highlightRect.left + 16}px`,
        top: `${Math.max(16, highlightRect.top - 10)}px`,
        maxWidth: "420px",
      };
    }
  } else {
    // Center tooltip when no element is highlighted
    tooltipStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      maxWidth: "520px",
    };
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard feature tour"
      />

      {/* Highlight ring around the target element */}
      {highlightRect && (
        <div
          className="fixed z-[100] rounded-2xl border-2 border-cyan/50 shadow-[0_0_0_4px_rgba(49,215,200,0.15)] transition-all duration-300"
          style={{
            left: `${highlightRect.left - 4}px`,
            top: `${highlightRect.top - 4}px`,
            width: `${highlightRect.width + 8}px`,
            height: `${highlightRect.height + 8}px`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        tabIndex={-1}
        className={tooltipClass}
        style={tooltipStyle}
        role="document"
        aria-label={`Tour step ${currentStep + 1}: ${step.title}`}
      >
        <div className="animate-in slide-in-from-bottom-4 rounded-2xl border border-slate-700/50 bg-slate-900/95 p-5 shadow-2xl shadow-cyan/5 backdrop-blur-xl">
          {/* Close button */}
          <button
            onClick={endTour}
            className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>

          {/* Progress bar */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan to-blue-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-xs font-medium text-slate-400">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>

          {/* Group indicator */}
          {groupIndex >= 0 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-md bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan">
                {currentGroup}
              </span>
            </div>
          )}

          {/* Step content */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-2xl">{step.icon}</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {step.description}
              </p>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  <ChevronLeft size={15} />
                  Back
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {/* "Go there" button for steps with href */}
              {step.href && !isLast && (
                <a
                  href={step.href}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan/30 px-3.5 py-2 text-sm font-medium text-cyan transition hover:border-cyan hover:bg-cyan/10"
                >
                  <Compass size={15} />
                  Go there
                </a>
              )}

              <button
                onClick={endTour}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-300"
              >
                <SkipForward size={15} />
                Skip
              </button>

              <button
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan px-4 py-2 text-sm font-bold text-black transition hover:bg-cyan/90"
              >
                {isLast ? (
                  <>
                    <Check size={16} />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step dots navigation */}
          {totalSteps > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {Array.from({ length: Math.min(totalSteps, 30) }).map(
                (_, index) => (
                  <button
                    key={index}
                    onClick={() => goToStep(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentStep
                        ? "w-6 bg-cyan"
                        : "w-1.5 bg-slate-700 hover:bg-slate-600"
                    }`}
                    aria-label={`Go to step ${index + 1}`}
                  />
                )
              )}
              {totalSteps > 30 && (
                <span className="text-[10px] text-slate-500">
                  +{totalSteps - 30}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
