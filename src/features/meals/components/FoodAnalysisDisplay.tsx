import { COLORS, FONTS } from '@/src/shared/styles/theme';
import { FoodAnalysis } from '@/src/core/entities/Meal';

interface FoodAnalysisDisplayProps {
  analysis: FoodAnalysis;
  onConfirm: () => void;
}

export function FoodAnalysisDisplay({ analysis, onConfirm }: FoodAnalysisDisplayProps) {
  return (
    <div style={{
      background: "rgba(126,184,164,0.05)",
      border: `1px solid ${COLORS.GREEN}`,
      borderRadius: 18,
      padding: 20,
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONTS.SERIF, fontSize: 18, color: COLORS.GREEN, margin: 0 }}>AI Analysis</h3>
        <div style={{
          padding: "4px 10px",
          borderRadius: 12,
          background: analysis.fiber_level === 'high' ? COLORS.GREEN : analysis.fiber_level === 'moderate' ? COLORS.YELLOW : COLORS.ORANGE,
          color: COLORS.BG,
          fontFamily: FONTS.MONO,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.05em"
        }}>
          {analysis.fiber_level.toUpperCase()} FIBER
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <AnalysisTag label="Protein" value={analysis.protein} color={COLORS.GREEN} />
        <AnalysisTag label="Carbs" value={analysis.carbs} color={COLORS.YELLOW} />
        <AnalysisTag label="Spice" value={analysis.spice} color={COLORS.ORANGE} />
      </div>

      <p style={{ fontSize: 13, color: COLORS.TEXT_MAIN, lineHeight: 1.5, marginBottom: 16 }}>
        {analysis.gut_notes}
      </p>

      {analysis.gut_cautions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: FONTS.MONO, fontSize: 10, color: COLORS.RED, marginBottom: 6, fontWeight: 600 }}>CAUTIONS:</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.TEXT_DIM, fontSize: 12 }}>
            {analysis.gut_cautions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      <button
        onClick={onConfirm}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          background: COLORS.GREEN,
          color: COLORS.BG,
          border: "none",
          fontFamily: FONTS.MONO,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        CONFIRM & NEXT
      </button>
    </div>
  );
}

function AnalysisTag({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div style={{
      padding: "6px 12px",
      borderRadius: 10,
      background: COLORS.CARD,
      border: `1px solid ${COLORS.BORDER}`,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }}>
      <span style={{ fontSize: 8, fontFamily: FONTS.MONO, color: COLORS.TEXT_MUTED, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color }}>{value}</span>
    </div>
  );
}
