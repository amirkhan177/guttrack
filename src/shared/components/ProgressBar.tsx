import { COLORS } from '@/src/shared/styles/theme';

interface ProgressBarProps {
  step: number;
  totalSteps?: number;
}

export function ProgressBar({ step, totalSteps = 5 }: ProgressBarProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
  
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
      {steps.map((s) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: s <= step ? COLORS.GREEN : COLORS.BORDER,
            transition: "background 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}
