"use client";

import { useState } from "react";
import { Film, Youtube } from "lucide-react";

type VideoSource =
  | { type: "local"; src: string; poster?: string }
  | { type: "youtube"; videoId: string };

interface VideoPlayerProps {
  /** Video source configuration */
  source: VideoSource;
  /** Optional className override */
  className?: string;
}

/**
 * VideoPlayer — Embeds a local MP4 or YouTube video in a styled container.
 *
 * @example
 * // Local MP4
 * <VideoPlayer source={{ type: "local", src: "/videos/soterai-demo.mp4", poster: "/videos/demo-poster.png" }} />
 *
 * @example
 * // YouTube
 * <VideoPlayer source={{ type: "youtube", videoId: "dQw4w9WgXcQ" }} />
 */
export function VideoPlayer({ source, className = "" }: VideoPlayerProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      className={`relative mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-800 bg-black shadow-glow transition-all duration-500 ${
        isLoaded ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      {/* Source badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 backdrop-blur">
        {source.type === "youtube" ? (
          <>
            <Youtube size={12} className="text-red-400" />
            YouTube
          </>
        ) : (
          <>
            <Film size={12} className="text-cyan" />
            Demo
          </>
        )}
      </div>

      {source.type === "local" ? (          <video
            className="w-full"
            controls
            controlsList="nodownload"
            playsInline
            preload="metadata"
            poster={source.poster}
            onLoadedData={() => setIsLoaded(true)}
            onError={() => setIsLoaded(true)}
          >
          <source src={source.src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <div className="aspect-video">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${source.videoId}?rel=0`}
            title="SoterAI Demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setIsLoaded(true)}
          />
        </div>
      )}

      {/* Loading placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spinner rounded-full border-2 border-cyan border-t-transparent" />
            <p className="text-sm text-slate-500">Loading video...</p>
          </div>
        </div>
      )}
    </div>
  );
}
