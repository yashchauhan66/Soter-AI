"use client";

import { useTour } from "./DashboardTourProvider";
import { Compass } from "lucide-react";

/**
 * TourTrigger — a floating help button in the bottom-right corner
 * that lets users restart the guided tour at any time.
 */
export function TourTrigger() {
  const { startTour, completed } = useTour();

  return (
    <button
      onClick={startTour}
      className="group fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-blue-400 p-3 text-black shadow-lg shadow-cyan/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-cyan/30"
      aria-label="Start guided tour"
      title={
        completed
          ? "Restart the dashboard tour"
          : "Take the dashboard tour"
      }
    >
      <span className="flex items-center gap-2 rounded-full px-1 transition-all group-hover:px-3">
        <Compass size={20} className="shrink-0" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all group-hover:max-w-[160px]">
          {completed ? "Take tour again" : "Tour guide"}
        </span>
      </span>
    </button>
  );
}
