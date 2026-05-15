import Link from "next/link";
import { Meal } from "@/src/core/entities/Meal";
import { relativeTime } from "@/lib/dates";
import { 
  cardStyle, 
  sectionHeadingStyle, 
  monoSmall, 
  mealTypeBadgeColor, 
  feelingEmoji 
} from "@/lib/dashboard-helpers";

interface MealsSectionProps {
  meals: Meal[];
  handleInteraction: () => void;
}

export default function MealsSection({ meals, handleInteraction }: MealsSectionProps) {
  const recentMeals = meals.slice(0, 3);

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
        <span style={sectionHeadingStyle}>Recent Meals</span>
        <Link href="/log" onClick={handleInteraction} style={{ textDecoration: "none" }}>
          <span
            style={{
              ...monoSmall,
              color: "#7EB8A4",
              fontSize: 9,
            }}
          >
            + log meal
          </span>
        </Link>
      </div>

      {recentMeals.length === 0 ? (
        <p
          style={{
            fontFamily: "SF Mono, ui-monospace, monospace",
            fontSize: 11,
            color: "#444",
            textAlign: "center",
            padding: "16px 0",
          }}
        >
          No meals logged today
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentMeals.map((meal) => (
            <div
              key={meal.id}
              style={{
                background: "#0A0A0F",
                borderRadius: 12,
                border: "1px solid #1e1e2e",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "SF Mono, ui-monospace, monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#0A0A0F",
                      background: mealTypeBadgeColor(meal.meal_type),
                      borderRadius: 6,
                      padding: "2px 7px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {meal.meal_type}
                  </span>
                  <span style={{ ...monoSmall, fontSize: 9 }}>
                    {relativeTime(meal.timestamp)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                  {meal.protein && (
                    <span style={{ ...monoSmall, fontSize: 9, color: "#888" }}>
                      {meal.protein}
                    </span>
                  )}
                  {meal.protein && meal.carbs && (
                    <span style={{ ...monoSmall, fontSize: 9, color: "#333" }}>·</span>
                  )}
                  {meal.carbs && (
                    <span style={{ ...monoSmall, fontSize: 9, color: "#888" }}>
                      {meal.carbs}
                    </span>
                  )}
                  {meal.spice && meal.spice !== "None" && meal.spice !== "null" && (
                    <span
                      style={{
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 8,
                        color: "#FF8C42",
                        background: "#FF8C4222",
                        border: "1px solid #FF8C4244",
                        borderRadius: 5,
                        padding: "1px 5px",
                      }}
                    >
                      🌶 {meal.spice}
                    </span>
                  )}
                  {meal.alcohol && meal.alcohol !== "None" && meal.alcohol !== "null" && (
                    <span
                      style={{
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 8,
                        color: "#C8A4FF",
                        background: "#C8A4FF22",
                        border: "1px solid #C8A4FF44",
                        borderRadius: 5,
                        padding: "1px 5px",
                      }}
                    >
                      🍷 {meal.alcohol}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 22 }}>{feelingEmoji(meal.feeling)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
