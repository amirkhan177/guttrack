import { COLORS, FONTS } from '@/src/shared/styles/theme';

type Feeling = "Great" | "Good" | "Okay" | "Bad" | "Awful";

const FEELINGS: { emoji: string; label: Feeling }[] = [
  { emoji: "😊", label: "Great" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😣", label: "Bad" },
  { emoji: "🤢", label: "Awful" },
];

interface FeelingSelectorProps {
  selected: Feeling | null;
  onSelect: (f: Feeling) => void;
}

export function FeelingSelector({ selected, onSelect }: FeelingSelectorProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
      {FEELINGS.map((f) => (
        <button
          key={f.label}
          onClick={() => onSelect(f.label)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "12px 0",
            borderRadius: 14,
            border: `1.5px solid ${selected === f.label ? COLORS.GREEN : COLORS.BORDER}`,
            background: selected === f.label ? "rgba(126,184,164,0.1)" : COLORS.CARD,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <span style={{ fontSize: 24 }}>{f.emoji}</span>
          <span style={{ 
            fontFamily: FONTS.MONO, 
            fontSize: 9, 
            color: selected === f.label ? COLORS.GREEN : COLORS.TEXT_DIM,
            fontWeight: selected === f.label ? 700 : 400
          }}>
            {f.label.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
}
