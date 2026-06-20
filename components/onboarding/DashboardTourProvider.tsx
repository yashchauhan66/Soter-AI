"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { TOUR_STEPS, type TourStep } from "./TourSteps";

/**
 * DashboardTourContext — manages the interactive guided tour state.
 * Persists completion state in localStorage so the tour auto-shows
 * only on the first visit (or can be manually restarted).
 */

interface TourContextValue {
  /** Whether the tour is currently active */
  active: boolean;
  /** Current step index */
  currentStep: number;
  /** Current tour step data */
  step: TourStep | null;
  /** Total number of steps */
  totalSteps: number;
  /** Progress percentage 0-100 */
  progress: number;
  /** Start the tour from the beginning */
  startTour: () => void;
  /** Go to the next step */
  nextStep: () => void;
  /** Go to the previous step */
  prevStep: () => void;
  /** Go to a specific step index */
  goToStep: (index: number) => void;
  /** End the tour */
  endTour: () => void;
  /** Whether the tour has been completed (persisted) */
  completed: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = "soter_dashboard_tour_completed";

export function DashboardTourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(true); // default true to avoid flash
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setActive(true);
  }, []);

  const endTour = useCallback(() => {
    setActive(false);
    setCompleted(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch { /* ignore */ }
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= TOUR_STEPS.length - 1) {
        endTour();
        return prev;
      }
      return prev + 1;
    });
  }, [endTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStep(Math.max(0, Math.min(index, TOUR_STEPS.length - 1)));
  }, []);

  // Load completion state from localStorage on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        setCompleted(stored === "true");
      } catch {
        setCompleted(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Auto-show tour on first dashboard visit
  useEffect(() => {
    if (isDashboard && !completed && !active) {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isDashboard, completed, active]);

  // Listen for custom event from QuickActions "Take the tour" button
  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener("start-dashboard-tour", handler);
    return () => window.removeEventListener("start-dashboard-tour", handler);
  }, [startTour]);

  const step = active ? TOUR_STEPS[currentStep] ?? null : null;
  const progress = TOUR_STEPS.length > 0
    ? Math.round(((currentStep + 1) / TOUR_STEPS.length) * 100)
    : 0;

  return (
    <TourContext.Provider
      value={{
        active,
        currentStep,
        step,
        totalSteps: TOUR_STEPS.length,
        progress,
        startTour,
        nextStep,
        prevStep,
        goToStep,
        endTour,
        completed,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a DashboardTourProvider");
  return ctx;
}
