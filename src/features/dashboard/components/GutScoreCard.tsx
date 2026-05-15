import { Meal } from "@/src/core/entities/Meal";
import { OuraMetrics } from "@/src/core/entities/OuraMetrics";
import { cardStyle, monoSmall } from "@/lib/dashboard-helpers";

interface GutScoreCardProps {
  gutScore: number;
  meals: Meal[];
  oura: OuraMetrics | null;
}

export default function GutScoreCard({ gutScore, meals, oura }: GutScoreCardProps) {
  const gutScoreLabel = (): string => {
    if (gutScore >= 80) return "Optimal";
    if (gutScore >= 65) return "Good";
    if (gutScore >= 50) return "Fair";
    if (gutScore >= 35) return "Poor";
    return "Critical";
  };

  const gutScoreColor = (): string => {
    if (gutScore >= 80) return "#7EB8A4";
    if (gutScore >= 65) return "#FFD93D";
    if (gutScore >= 50) return "#FF8C42";
    return "#FF6B6B";
  };

  return (
    <div
      style={{
        ...cardStyle,
        background: "linear-gradient(135deg, #1a2a24 0%, #15151f 100%)",
        borderColor: "#7EB8A433",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p style={{ ...monoSmall, marginBottom: 4 }}>gut score</p>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 64,
              fontWeight: 700,
              color: gutScoreColor(),
              lineHeight: 1,
            }}
          >
            {gutScore}
          </span>
          <p
            style={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 12,
              color: gutScoreColor(),
              marginTop: 4,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {gutScoreLabel()}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ ...monoSmall, marginBottom: 6 }}>today</p>
          <p style={{ ...monoSmall, marginBottom: 2 }}>
            {meals.length} meal{meals.length !== 1 ? "s" : ""} logged
          </p>
          {oura && (
            <p style={{ ...monoSmall }}>
              readiness {oura.readiness_score ?? "—"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
