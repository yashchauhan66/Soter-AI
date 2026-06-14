import dynamic from "next/dynamic";

const PlaygroundClient = dynamic(() => import("@/components/guard/PlaygroundClient").then((mod) => mod.PlaygroundClient));

export default function PlaygroundPage() { return <main className="container-page py-16"><div className="mb-10 max-w-3xl"><p className="eyebrow">Public playground</p><h1 className="mt-3 text-4xl font-bold">See the guard make a decision.</h1><p className="mt-4 text-lg leading-8 text-slate-400">Test defensive examples against the Phase 1 rules. This analyzer is rate limited and does not persist playground text.</p></div><PlaygroundClient /></main>; }
