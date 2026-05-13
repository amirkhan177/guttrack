import { Supplement, SupplementLog } from "@/lib/supabase";
import { cardStyle, sectionHeadingStyle, monoSmall } from "@/lib/dashboard-helpers";

interface SupplementsSectionProps {
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  toggleSupplement: (supp: Supplement) => void;
}

export default function SupplementsSection({ 
  supplements, 
  supplementLogs, 
  toggleSupplement 
}: SupplementsSectionProps) {
  const takenCount = supplementLogs.length;
  const totalCount = supplements.length;

  const suppGroups = supplements.reduce<Record<string, Supplement[]>>(
    (acc, s) => {
      const key = s.time_of_day ?? "Anytime";
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    },
    {}
  );

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={sectionHeadingStyle}>Supplements</span>
        <span
          style={{
            fontFamily: "SF Mono, ui-monospace, monospace",
            fontSize: 10,
            color: takenCount === totalCount ? "#7EB8A4" : "#666",
          }}
        >
          {takenCount} / {totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 3,
          background: "#1e1e2e",
          borderRadius: 2,
          marginBottom: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${totalCount > 0 ? (takenCount / totalCount) * 100 : 0}%`,
            background: "#7EB8A4",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(suppGroups).map(([timeOfDay, suppsInGroup]) => (
          <div key={timeOfDay}>
            <p style={{ ...monoSmall, marginBottom: 8, fontSize: 9 }}>
              {timeOfDay}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suppsInGroup.map((supp) => {
                const taken = supplementLogs.some(
                  (l) => l.supplement_id === supp.id
                );
                return (
                  <div
                    key={supp.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <button
                      onClick={() => toggleSupplement(supp)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "2px solid " + (taken ? "#7EB8A4" : "#333"),
                        background: taken ? "#7EB8A4" : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}
                      aria-label={`Toggle ${supp.name}`}
                    >
                      {taken && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="#0A0A0F"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontFamily: "Georgia, serif",
                          fontSize: 13,
                          color: taken ? "#7EB8A4" : "#c0c0c0",
                          margin: 0,
                          textDecoration: taken ? "line-through" : "none",
                          opacity: taken ? 0.7 : 1,
                        }}
                      >
                        {supp.name}
                      </p>
                      {(supp.dosage || supp.unit) && (
                        <p style={{ ...monoSmall, fontSize: 9, marginTop: 1 }}>
                          {supp.dosage} {supp.unit}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
