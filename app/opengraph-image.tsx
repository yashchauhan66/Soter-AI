import { ImageResponse } from "next/og";

export const alt = "SoterAI — AI Security Guardrail Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f1117 0%, #1a1d2e 50%, #0d111c 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-120px",
            width: "700px",
            height: "700px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 200, 200, 0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            left: "-80px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 220, 130, 0.1) 0%, transparent 70%)",
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #00c8c8, #00dc82, #00c8c8)",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexGrow: 1,
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 64px 32px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Logo + Tagline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(0, 200, 200, 0.15)",
                color: "#00c8c8",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              S
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#e2e8f0",
                letterSpacing: "0.02em",
              }}
            >
              Soter{" "}
              <span style={{ color: "#00c8c8" }}>AI</span>
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: "#f1f5f9",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 10,
            }}
          >
            AI Security That{" "}
            <span style={{ color: "#00c8c8" }}>Actually Works</span>
          </h1>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 10,
                background: "rgba(0, 200, 200, 0.1)",
                border: "1px solid rgba(0, 200, 200, 0.2)",
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 800, color: "#00c8c8" }}>F1=1.0000</span>
              <span style={{ fontSize: 14, color: "#94a3b8" }}>Benchmark</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 10,
                background: "rgba(0, 220, 130, 0.1)",
                border: "1px solid rgba(0, 220, 130, 0.2)",
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 800, color: "#00dc82" }}>0%</span>
              <span style={{ fontSize: 14, color: "#94a3b8" }}>False Positives</span>
            </div>
          </div>

          {/* Feature cards */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Input + Output Guard", color: "#00c8c8" },
              { label: "RAG Security", color: "#00dc82" },
              { label: "Agent Firewall", color: "#34d399" },
              { label: "India PII Detection", color: "#38bdf8" },
              { label: "Enterprise Ready", color: "#a78bfa" },
            ].map((feat) => (
              <div
                key={feat.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  background: "rgba(15, 17, 23, 0.6)",
                  fontSize: 14,
                  color: "#cbd5e1",
                  fontWeight: 500,
                }}
              >
                OK {feat.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 64px",
            borderTop: "1px solid #1e293b",
          }}
        >
          <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>
            soterai.publicvm.com
          </span>
          <span style={{ fontSize: 12, color: "#334155" }}>
            OWASP LLM Top 10 Aligned - Free Tier Available
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
