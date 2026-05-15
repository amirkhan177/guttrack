interface OuraCardProps {
  label: string;
  value: string | number | null;
  unit: string;
  color: string;
  prefix?: string;
}

export default function OuraCard({ label, value, unit, color, prefix = "" }: OuraCardProps) {
  const display =
    value === null || value === undefined
      ? "—"
      : `${prefix}${typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}`;

  return (
    <div
      style={{
        background: "#15151f",
        borderRadius: 14,
        border: "1px solid #1e1e2e",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: "SF Mono, ui-monospace, monospace",
          fontSize: 8,
          letterSpacing: "0.08em",
          color: "#555",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "SF Mono, ui-monospace, monospace",
          fontSize: 22,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {display}
      </span>
      <span
        style={{
          fontFamily: "SF Mono, ui-monospace, monospace",
          fontSize: 9,
          color: "#444",
        }}
      >
        {unit}
      </span>
    </div>
  );
}
