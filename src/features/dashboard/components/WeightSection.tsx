import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { WeightEntry } from "@/src/core/entities/WeightEntry";
import { cardStyle, sectionHeadingStyle, monoSmall } from "@/lib/dashboard-helpers";

interface WeightSectionProps {
  weights: WeightEntry[];
  weightUnit: "kg" | "lbs";
}

export default function WeightSection({ weights, weightUnit }: WeightSectionProps) {
  const toDisplayWeight = (kg: number | null) => {
    if (kg === null) return null;
    return weightUnit === "lbs" ? parseFloat((kg * 2.20462).toFixed(1)) : parseFloat(kg.toFixed(1));
  };

  const weightChartData = [...weights]
    .reverse()
    .map((w) => ({
      date: w.date.slice(5), // "MM-DD"
      weight: toDisplayWeight(w.weight_kg),
    }));

  const currentWeight = toDisplayWeight(weights[0]?.weight_kg ?? null);
  const oldestWeight = toDisplayWeight(weights[weights.length - 1]?.weight_kg ?? null);
  const weightDelta =
    currentWeight !== null && oldestWeight !== null
      ? parseFloat((currentWeight - oldestWeight).toFixed(1))
      : null;
  const avgWeight =
    weights.length > 0
      ? parseFloat(
          (
            weights.reduce((s, w) => s + (toDisplayWeight(w.weight_kg) ?? 0), 0) /
            weights.length
          ).toFixed(1)
        )
      : null;

  if (weights.length === 0) return null;

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={sectionHeadingStyle}>Weight</span>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 20,
              fontWeight: 700,
              color: "#FFD93D",
            }}
          >
            {currentWeight !== null ? `${currentWeight} ${weightUnit}` : "—"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <div>
          <p style={{ ...monoSmall, marginBottom: 2 }}>7-day avg</p>
          <p
            style={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 13,
              color: "#e0e0e0",
            }}
          >
            {avgWeight !== null ? `${avgWeight} ${weightUnit}` : "—"}
          </p>
        </div>
        <div>
          <p style={{ ...monoSmall, marginBottom: 2 }}>7-day change</p>
          <p
            style={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 13,
              color:
                weightDelta === null
                  ? "#666"
                  : weightDelta > 0
                  ? "#FF6B6B"
                  : weightDelta < 0
                  ? "#7EB8A4"
                  : "#666",
            }}
          >
            {weightDelta !== null
              ? `${weightDelta > 0 ? "+" : ""}${weightDelta} ${weightUnit}`
              : "—"}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={80}>
        <LineChart
          data={weightChartData}
          margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
        >
          <XAxis
            dataKey="date"
            tick={{
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 8,
              fill: "#444",
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1e1e2e",
              border: "1px solid #2e2e3e",
              borderRadius: 8,
              fontFamily: "SF Mono, ui-monospace, monospace",
              fontSize: 10,
              color: "#e0e0e0",
            }}
            itemStyle={{ color: "#FFD93D" }}
            formatter={(value: number) => [`${value} ${weightUnit}`, "weight"]}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#FFD93D"
            strokeWidth={2}
            dot={{ fill: "#FFD93D", r: 3, strokeWidth: 0 }}
            activeDot={{ fill: "#FFD93D", r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
