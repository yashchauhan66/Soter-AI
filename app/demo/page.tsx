"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { DemoVideo } from "@/components/marketing/DemoVideo";
import { VideoPlayer } from "@/components/marketing/VideoPlayer";

const demos=[["Sample chatbot","Inspect defensive input and output decisions.","/demo-chatbot"],["Sample RAG workflow","See document quarantine, ACL, and grounding stages.","/demo/rag"],["Red-team demo mode","Run safe scenarios only against an owned demo project.","/demo/red-team"],["Live playground","Test your own non-sensitive examples.","/playground"]];
export default function DemoPage(){
  useEffect(() => {
    document.title = "AI Security Demos | SoterAI";
  }, []);
  return <main className="container-page py-16"><p className="eyebrow">Product demos</p><h1 className="mt-2 text-4xl font-bold">Explore guarded AI workflows</h1><p className="mt-4 max-w-3xl text-slate-400">These demos illustrate risk reduction and defense-in-depth behavior. They do not demonstrate offensive exploitation or guarantee complete detection.</p><div className="mt-10 grid gap-4 md:grid-cols-2">{demos.map(([title,copy,href])=><Link className="card p-6 hover:border-cyan/50" href={href} key={title}><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-400">{copy}</p></Link>)}</div>      {/* Demo Video Section */}
      <section id="video" className="mt-16 scroll-mt-20 border-t border-slate-800 pt-10">
        <p className="eyebrow text-center">Live walkthrough</p>
        <h2 className="mt-2 text-center text-3xl font-bold">See SoterAI in action</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Watch how SoterAI detects and blocks prompt injection, redacts India PII, stops secrets leakage, and more — all in under 50ms.
        </p>

        {/* Tabs: Animated Demo | Recorded Video */}
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => document.getElementById("demo-animated")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-full border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/20"
          >
            🎮 Animated demo
          </button>
          <button
            onClick={() => document.getElementById("demo-video")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
          >
            🎬 Recorded video
          </button>
        </div>

        {/* Animated Demo */}
        <div id="demo-animated" className="mt-10 max-w-5xl scroll-mt-20">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-md bg-cyan/10 px-2.5 py-1 text-xs font-bold text-cyan">01</span>
            <span className="text-sm font-medium text-slate-400">Interactive walkthrough</span>
          </div>
          <DemoVideo />
        </div>

        {/* Real Recorded Video — placeholder for after user records */}
        <div id="demo-video" className="mt-16 max-w-4xl scroll-mt-20">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-md bg-cyan/10 px-2.5 py-1 text-xs font-bold text-cyan">02</span>
            <span className="text-sm font-medium text-slate-400">Full walkthrough video</span>
          </div>
          {process.env.NEXT_PUBLIC_DEMO_VIDEO_ID ? (
            <VideoPlayer
              source={
                process.env.NEXT_PUBLIC_DEMO_VIDEO_SRC
                  ? { type: "local", src: process.env.NEXT_PUBLIC_DEMO_VIDEO_SRC }
                  : { type: "youtube", videoId: process.env.NEXT_PUBLIC_DEMO_VIDEO_ID! }
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/60 py-20 text-center">
              <div className="mb-4 rounded-full bg-cyan/10 p-4">
                <Film className="h-8 w-8 text-cyan" />
              </div>
              <p className="text-lg font-semibold text-slate-300">Record your demo video</p>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Record with Loom or OBS, then save as <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">public/videos/soterai-demo.mp4</code>
                and set <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_DEMO_VIDEO_SRC=/videos/soterai-demo.mp4</code> in your env.
              </p>
              <a
                href="/docs/recording-demo-video-guide.md"
                className="button-secondary mt-6 inline-flex items-center gap-2"
              >
                View recording guide
              </a>
            </div>
          )}
        </div>
      </section></main>}
