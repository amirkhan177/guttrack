import { OuraMetrics } from "@/src/core/entities/OuraMetrics";
import { minutesAgo } from "@/lib/dates";
import { cardStyle, sectionHeadingStyle, monoSmall } from "@/lib/dashboard-helpers";
import OuraCard from "./OuraCard";

interface OuraRingSectionProps {
  oura: OuraMetrics | null;
  ouraLastSync: string | null;
  syncing: boolean;
  handleManualSync: () => void;
}

export default function OuraRingSection({ 
  oura, 
  ouraLastSync, 
  syncing, 
  handleManualSync 
}: OuraRingSectionProps) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={sectionHeadingStyle}>Oura Ring</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ouraLastSync && (
            <span style={{ ...monoSmall, fontSize: 9 }}>
              {minutesAgo(ouraLastSync)}
            </span>
          )}
          <button
            onClick={handleManualSync}
            disabled={syncing}
            style={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 9,
              color: syncing ? "#444" : "#7EB8A4",
              background: "transparent",
              border: "1px solid " + (syncing ? "#333" : "#7EB8A444"),
              borderRadius: 8,
              padding: "4px 10px",
              cursor: syncing ? "default" : "pointer",
              letterSpacing: "0.06em",
            }}
          >
            {syncing ? (
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>
                ↻
              </span>
            ) : (
              "sync"
            )}
          </button>
        </div>
      </div>

      {oura ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <OuraCard
            label="Readiness"
            value={oura.readiness_score}
            unit="/ 100"
            color="#7EB8A4"
          />
          <OuraCard
            label="Sleep"
            value={oura.sleep_score}
            unit="/ 100"
            color="#A8B4FF"
          />
          <OuraCard
            label="HRV Balance"
            value={oura.hrv_balance !== null ? Math.round(oura.hrv_balance) : null}
            unit="ms"
            color="#FFD93D"
            prefix={oura.hrv_balance !== null && oura.hrv_balance >= 0 ? "+" : ""}
          />
          <OuraCard
            label="Resting HR"
            value={oura.resting_heart_rate}
            unit="bpm"
            color="#FF8C42"
          />
          <OuraCard
            label="Steps"
            value={oura.steps !== null ? oura.steps.toLocaleString() : null}
            unit="steps"
            color="#FFD93D"
          />
          <OuraCard
            label="Active Cal"
            value={oura.active_calories}
            unit="kcal"
            color="#C8A4FF"
          />
          <OuraCard
            label="Stress High"
            value={oura.stress_high_minutes}
            unit="min"
            color="#FF6B6B"
          />
          <OuraCard
            label="Body Temp"
            value={oura.body_temperature_deviation !== null
              ? parseFloat(oura.body_temperature_deviation.toFixed(2))
              : null}
            unit="°C dev"
            color="#4ECDC4"
            prefix={
              oura.body_temperature_deviation !== null &&
              oura.body_temperature_deviation >= 0
                ? "+"
                : ""
            }
          />
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#444",
          }}
        >
          <p
            style={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 11,
            }}
          >
            No Oura data for today
          </p>
          <p style={{ ...monoSmall, marginTop: 4, fontSize: 9 }}>
            tap sync to fetch latest
          </p>
        </div>
      )}
    </div>
  );
}
