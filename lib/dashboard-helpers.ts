import { getMtnHour } from "./dates";

export function getGreeting(): string {
  const h = getMtnHour();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function withSign(n: number | null): string {
  if (n === null) return "—";
  return n >= 0 ? `+${n}` : `${n}`;
}

export function toFixed1(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

export function flareRiskColor(level: string | null): string {
  if (!level) return "#7EB8A4";
  const l = level.toLowerCase();
  if (l === "low") return "#7EB8A4";
  if (l === "moderate") return "#FF8C42";
  if (l === "high") return "#FF6B6B";
  if (l === "critical") return "#8B0000";
  return "#7EB8A4";
}

export function feelingEmoji(feeling: string | null): string {
  switch (feeling) {
    case "Great": return "😊";
    case "Good": return "🙂";
    case "Okay": return "😐";
    case "Bad": return "😣";
    case "Awful": return "🤢";
    default: return "—";
  }
}

export function mealTypeBadgeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case "breakfast": return "#FFD93D";
    case "lunch": return "#7EB8A4";
    case "dinner": return "#A8B4FF";
    case "snack": return "#FF8C42";
    default: return "#4ECDC4";
  }
}

export const cardStyle: React.CSSProperties = {
  background: "#15151f",
  borderRadius: 18,
  border: "1px solid #1e1e2e",
  padding: "16px",
  marginBottom: 12,
};

export const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: "Georgia, serif",
  fontSize: 15,
  fontWeight: 600,
  color: "#e0e0e0",
  marginBottom: 12,
};

export const monoSmall: React.CSSProperties = {
  fontFamily: "SF Mono, ui-monospace, monospace",
  fontSize: 10,
  color: "#666",
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
};
