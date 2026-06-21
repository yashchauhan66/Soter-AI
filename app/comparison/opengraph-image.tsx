import { ImageResponse } from "next/og";

export const alt = "Soter vs Competitors — Most Comprehensive AI Security";
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
            top: "-180px",
            right: "-100px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 200, 200, 0.12) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-60px",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 220, 130, 0.08) 0%, transparent 70%)",
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

        {/* Content */}
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
          {/* Eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(0, 200, 200, 0.15)",
                color: "#00c8c8",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {"\u2696\uFE0F"}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#94a3b8",
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
              }}
            >
              Soter vs Competitors
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#f1f5f9",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 6,
            }}
          >
            The <span style={{ color: "#00c8c8" }}>most comprehensive</span>
            <br />
            AI security platform
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 22,
              color: "#64748b",
              margin: 0,
              marginBottom: 28,
              lineHeight: 1.4,
            }}
          >
            Input + Output + RAG + Agent Firewall + Policy + Enterprise in one product
          </p>

          {/* Feature comparison matrix */}
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {/* Soter card */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "16px 20px",
                borderRadius: 12,
                border: "2px solid rgba(0, 200, 200, 0.4)",
                background: "rgba(0, 200, 200, 0.08)",
                minWidth: "180px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}              >
              {"\uD83D\uDEE1\uFE0F"}
              </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#00c8c8" }}>Soter</span>
              </div>
              {[
                "Input + Output Guard",
                "RAG Security",
                "Agent Firewall",
                "PII + Secrets",
                "8 Frameworks",
                "Enterprise Ready",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ color: "#00dc82", fontSize: 14 }}>{"\u2713"}</span>
                  <span style={{ fontSize: 13, color: "#e2e8f0" }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Competitors */}
            {[
              { name: "Lakera", icon: "\uD83D\uDD34", color: "#ef4444", features: ["Input Only", "Cloud-Only", "No RAG"] },
              { name: "NeMo", icon: "\uD83D\uDD35", color: "#22c55e", features: ["Flow Control", "Complex Setup", "No PII"] },
              { name: "GA Guard", icon: "\uD83D\uDFE2", color: "#34d399", features: ["Classifier Only", "No RAG/Agent", "256K Context"] },
              { name: "Guardrails AI", icon: "\uD83D\uDFE1", color: "#eab308", features: ["Output Only", "17K Stars", "No Input Guard"] },
            ].map((comp) => (
              <div
                key={comp.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  background: "rgba(15, 17, 23, 0.6)",
                  minWidth: "140px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{comp.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>{comp.name}</span>
                </div>
                {comp.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ color: "#ef4444", fontSize: 12 }}>{"\u2717"}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{f}</span>
                  </div>
                ))}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#475569",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: 5,
                background: "rgba(0, 200, 200, 0.15)",
                color: "#00c8c8",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
                              {"\uD83D\uDEE1\uFE0F"}
            </span>
            soter.dev/comparison
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#334155",
              fontWeight: 500,
            }}
          >
            <span>22 Features Compared</span>
            <span style={{ margin: "0 4px" }}>{"\u2022"}</span>
            <span>6 Competitors</span>
            <span style={{ margin: "0 4px" }}>{"\u2022"}</span>
            <span>Free Tier Available</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
