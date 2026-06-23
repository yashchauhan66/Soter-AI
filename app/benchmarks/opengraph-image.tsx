import { ImageResponse } from "next/og";

export const alt = "SoterAI — Adversarial Benchmark: F1 = 1.0000";
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
            top: "-120px",
            right: "-120px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 200, 200, 0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-80px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 220, 130, 0.10) 0%, transparent 70%)",
          }}
        />

        {/* Border line */}
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

        {/* Content */}
        <div
          style={{
          display: "flex",
          flexGrow: 1,
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 72px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(0, 200, 200, 0.15)",
                color: "#00c8c8",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              &#x1F6E1;
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#94a3b8",
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
              }}
            >
              Adversarial Benchmark
            </span>
          </div>

          {/* Main headline */}
          <h1
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#f1f5f9",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 8,
            }}
          >
            SoterAI{" "}
            <span
              style={{
                color: "#00c8c8",
              }}
            >
              F1 = 1.0000
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 26,
              color: "#64748b",
              margin: 0,
              marginBottom: 36,
              lineHeight: 1.4,
              maxWidth: "700px",
            }}
          >
            97/97 adversarial attacks detected across 8 categories with zero false positives
          </p>

          {/* Stats bar */}
          <div
            style={{
              display: "flex",
              gap: 32,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: "#00dc82",
                }}
              >
                100%
              </span>
              <span
                style={{
                  fontSize: 16,
                  color: "#64748b",
                  fontWeight: 500,
                }}
              >
                Detection
              </span>
            </div>
            <div style={{ width: 1, height: 32, background: "#1e293b" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: "#00c8c8",
                }}
              >
                0%
              </span>
              <span
                style={{
                  fontSize: 16,
                  color: "#64748b",
                  fontWeight: 500,
                }}
              >
                False Positives
              </span>
            </div>
            <div style={{ width: 1, height: 32, background: "#1e293b" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: "#00c8c8",
                }}
              >
                &lt;50ms
              </span>
              <span
                style={{
                  fontSize: 16,
                  color: "#64748b",
                  fontWeight: 500,
                }}
              >
                Latency
              </span>
            </div>
          </div>

          {/* Tag chips row */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 32,
              flexWrap: "wrap",
            }}
          >
            {[
              "Prompt Injection",
              "Jailbreak / DAN",
              "Obfuscation",
              "Multilingual",
              "Indirect Injection",
              "PII Detection",
              "Secrets",
              "Unsafe Output",
            ].map((tag) => (
              <span
                key={tag}
                style={{
                  display: "flex",
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid #1e293b",
                  background: "rgba(15, 17, 23, 0.6)",
                  fontSize: 14,
                  color: "#94a3b8",
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 72px",
            borderTop: "1px solid #1e293b",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#475569",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: 6,
                background: "rgba(0, 200, 200, 0.15)",
                color: "#00c8c8",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              &#x1F6E1;
            </span>
            soterai.publicvm.com/benchmarks
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#334155",
              fontWeight: 500,
            }}
          >
            <span>OWASP LLM Top 10 Aligned</span>
            <span style={{ margin: "0 4px" }}>&#x2022;</span>
            <span>Garak-Style Evaluation</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
