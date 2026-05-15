import Link from "next/link";
import { DailyInsight } from "@/src/core/entities/Insight";
import { flareRiskColor, cardStyle, sectionHeadingStyle, monoSmall } from "@/lib/dashboard-helpers";

interface InsightPreviewProps {
  insight: DailyInsight;
  handleInteraction: () => void;
}

export default function InsightPreview({ insight, handleInteraction }: InsightPreviewProps) {
  const topAvoid = (() => {
    if (!insight?.avoid) return null;
    const arr = Array.isArray(insight.avoid)
      ? insight.avoid
      : Object.values(insight.avoid);
    if (arr.length === 0) return null;
    const item = arr[0] as { label?: string } | string;
    return typeof item === "object" && item?.label ? item.label : String(item);
  })();

  const topAdd = (() => {
    if (!insight?.add_to_diet) return null;
    const arr = Array.isArray(insight.add_to_diet)
      ? insight.add_to_diet
      : Object.values(insight.add_to_diet);
    if (arr.length === 0) return null;
    const item = arr[0] as { label?: string } | string;
    return typeof item === "object" && item?.label ? item.label : String(item);
  })();

  return (
    <Link href="/insights" onClick={handleInteraction} style={{ textDecoration: "none" }}>
      <div
        style={{
          ...cardStyle,
          borderColor: flareRiskColor(insight.flare_risk_level) + "44",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span style={sectionHeadingStyle}>Today&rsquo;s Insight</span>
          <span
            style={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 10,
              fontWeight: 700,
              color: flareRiskColor(insight.flare_risk_level),
              background:
                flareRiskColor(insight.flare_risk_level) + "22",
              borderRadius: 8,
              padding: "3px 10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {insight.flare_risk_level ?? "Unknown"} Risk
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {topAvoid && (
            <div
              style={{
                flex: 1,
                background: "#FF6B6B18",
                borderRadius: 10,
                padding: "8px 10px",
                border: "1px solid #FF6B6B33",
              }}
            >
              <p style={{ ...monoSmall, color: "#FF6B6B", marginBottom: 4 }}>
                avoid
              </p>
              <p
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 12,
                  color: "#e0e0e0",
                  margin: 0,
                }}
              >
                {topAvoid}
              </p>
            </div>
          )}
          {topAdd && (
            <div
              style={{
                flex: 1,
                background: "#7EB8A418",
                borderRadius: 10,
                padding: "8px 10px",
                border: "1px solid #7EB8A433",
              }}
            >
              <p style={{ ...monoSmall, color: "#7EB8A4", marginBottom: 4 }}>
                add
              </p>
              <p
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 12,
                  color: "#e0e0e0",
                  margin: 0,
                }}
              >
                {topAdd}
              </p>
            </div>
          )}
        </div>

        <p
          style={{
            ...monoSmall,
            textAlign: "right",
            marginTop: 10,
            color: "#7EB8A4",
            fontSize: 9,
          }}
        >
          tap for full insight →
        </p>
      </div>
    </Link>
  );
}
