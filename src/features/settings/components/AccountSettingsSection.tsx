"use client";

import { useRouter } from "next/navigation";
import {
  SectionLabel,
  Card,
  FieldLabel,
  ActionButton,
  DataRow,
  BG,
  BORDER,
  GREEN,
  MONO,
} from "./SettingsUI";

interface AccountSettingsSectionProps {
  weightUnit: "lbs" | "kg";
  saveWeightUnit: (unit: "lbs" | "kg") => void;
  stats: Record<string, number | null>;
  clearSession: () => void;
}

export function AccountSettingsSection({
  weightUnit,
  saveWeightUnit,
  stats,
  clearSession,
}: AccountSettingsSectionProps) {
  const router = useRouter();

  return (
    <>
      <SectionLabel>Account</SectionLabel>
      <Card>
        <ActionButton
          onClick={() => {
            clearSession();
            router.push("/pin");
          }}
          variant="ghost"
          fullWidth
        >
          CHANGE PIN
        </ActionButton>

        <div>
          <FieldLabel>Weight Unit</FieldLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {(["lbs", "kg"] as const).map((unit) => (
              <button
                key={unit}
                onClick={() => saveWeightUnit(unit)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${weightUnit === unit ? GREEN : BORDER}`,
                  background: weightUnit === unit ? `${GREEN}22` : BG,
                  color: weightUnit === unit ? GREEN : "#666",
                  ...MONO,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {unit.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <DataRow label="Meals logged" count={stats.meals} />
          <DataRow label="Supplements" count={stats.supplements} />
          <DataRow label="Lab results" count={stats.labs} />
          <DataRow label="Insights generated" count={stats.insights} />
          <DataRow
            label="Feedback submissions"
            count={stats.feedback}
          />
        </div>
      </Card>
    </>
  );
}
