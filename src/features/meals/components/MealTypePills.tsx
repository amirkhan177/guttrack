import { COLORS, FONTS } from '@/src/shared/styles/theme';

type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface MealTypePillsProps {
  selected: MealType;
  onSelect: (m: MealType) => void;
}

export function MealTypePills({
  selected,
  onSelect,
}: MealTypePillsProps) {
  const types: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
  
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
      {types.map((t) => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          style={{
            padding: "6px 14px",
            borderRadius: 20,
            border: `1px solid ${selected === t ? COLORS.GREEN : COLORS.BORDER}`,
            background: selected === t ? COLORS.GREEN : COLORS.CARD,
            color: selected === t ? COLORS.BG : COLORS.TEXT_DIM,
            fontFamily: FONTS.MONO,
            fontSize: 10,
            fontWeight: selected === t ? 700 : 400,
            letterSpacing: "0.08em",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
