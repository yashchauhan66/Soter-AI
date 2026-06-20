"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type AnimationVariant = "fade-in" | "slide-up" | "slide-down" | "scale-in";

interface AnimateInProps {
  children: ReactNode;
  variant?: AnimationVariant;
  delay?: number; // delay in ms (also supports stagger-1 through stagger-8)
  className?: string;
  /** If true, always animate even if already visible (for tab changes) */
  always?: boolean;
  /** Offset for IntersectionObserver trigger (px from viewport edge) */
  threshold?: number;
}

const variantClasses: Record<AnimationVariant, string> = {
  "fade-in": "animate-fade-in",
  "slide-up": "animate-slide-up",
  "slide-down": "animate-slide-down",
  "scale-in": "animate-scale-in",
};

const delayClasses: Record<number, string> = {
  1: "stagger-1",
  2: "stagger-2",
  3: "stagger-3",
  4: "stagger-4",
  5: "stagger-5",
  6: "stagger-6",
  7: "stagger-7",
  8: "stagger-8",
};

/**
 * AnimateIn — wraps children and animates them when they scroll into view.
 * Use the `delay` prop with values 1-8 for staggered lists, or pass `always`
 * to re-animate on every render (e.g. tab/route changes).
 */
export function AnimateIn({
  children,
  variant = "slide-up",
  delay,
  className = "",
  always = false,
  threshold = 0.1,
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(always);

  useEffect(() => {
    const el = ref.current;
    if (!el || always) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [always, threshold]);

  const animClass = variantClasses[variant] ?? "animate-fade-in";
  const delayClass = delay !== undefined ? delayClasses[delay] ?? "" : "";

  return (
    <div
      ref={ref}
      className={`${className} ${visible ? animClass : "opacity-0"} ${delayClass}`}
      style={visible && delay !== undefined && delay > 8 ? { animationDelay: `${delay * 0.05}s` } : undefined}
    >
      {children}
    </div>
  );
}
