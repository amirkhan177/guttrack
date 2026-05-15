"use client";

import { useState, useEffect } from "react";
import NavBar from "@/src/shared/components/NavBar";

// Hooks
import { useMealLog } from "@/src/features/meals/hooks/useMealLog";
import { useWeightLog } from "@/src/features/weight/hooks/useWeightLog";
import { useSessionGuard } from "@/src/features/auth/hooks/useSessionGuard";

// ─── Constants ────────────────────────────────────────────────────────────────

type MainTab = "MEAL" | "WEIGHT";
type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
type Feeling = "Great" | "Good" | "Okay" | "Bad" | "Awful";
type AlcoholChoice = "None" | "Beer" | "Wine" | "Spirit";

const PROTEIN_OPTIONS = ["Chicken", "Fish", "Eggs", "Red Meat", "Lentils/Dal", "Tofu", "None"];
const CARB_OPTIONS = ["White Rice", "Bread", "Pasta", "Cooked Vegetables", "Leafy Greens", "Legumes/Beans", "Oats", "None"];
const SPICE_OPTIONS = ["None", "Mild", "Medium", "Hot", "Very Hot"];
const ALCOHOL_OPTIONS: AlcoholChoice[] = ["None", "Beer", "Wine", "Spirit"];
const FEELINGS: { emoji: string; label: Feeling }[] = [
  { emoji: "😊", label: "Great" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😣", label: "Bad" },
  { emoji: "🤢", label: "Awful" },
];
const SYMPTOM_TAGS = [
  { key: "burning", label: "Burning", icon: "🔥" },
  { key: "pain", label: "Pain", icon: "⚡" },
  { key: "sore_left", label: "Sore Left", icon: "◀" },
  { key: "sore_right", label: "Sore Right", icon: "▶" },
  { key: "front", label: "Front", icon: "↑" },
  { key: "back", label: "Back", icon: "↓" },
];
const ALCOHOL_OZ: Record<string, number> = { Beer: 14, Wine: 6, Spirit: 2 };

// ─── Styles ───────────────────────────────────────────────────────────────────

const BG = "#0A0A0F";
const CARD = "#15151f";
const BORDER = "#1e1e2e";
const GREEN = "#7EB8A4";
const YELLOW = "#FFD93D";
const RED = "#FF6B6B";
const ORANGE = "#FF8C42";
const MONO = "SF Mono, ui-monospace, monospace";
const SERIF = "Georgia, 'Times New Roman', serif";

const cardBase: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  padding: "14px 16px",
  marginBottom: 10,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const selectedCard: React.CSSProperties = {
  ...cardBase,
  border: `1px solid ${GREEN}`,
  background: "rgba(126,184,164,0.08)",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: s <= step ? GREEN : BORDER,
            transition: "background 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

function MealTypePills({
  selected,
  onSelect,
}: {
  selected: MealType;
  onSelect: (m: MealType) => void;
}) {
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
            border: `1px solid ${selected === t ? GREEN : BORDER}`,
            background: selected === t ? GREEN : CARD,
            color: selected === t ? "#0A0A0F" : "#888",
            fontFamily: MONO,
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LogPage() {
  const { handleInteraction, checkSession } = useSessionGuard();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const [mainTab, setMainTab] = useState<MainTab>("MEAL");

  const mealLog = useMealLog();
  const weightLog = useWeightLog();

  const [textareaFocused, setTextareaFocused] = useState(false);

  function toggleSymptom(key: string) {
    handleInteraction();
    mealLog.setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTime(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatWeightDisplay(kg: number): string {
    if (weightLog.weightUnit === "lbs") return `${(kg * 2.20462).toFixed(1)} lbs`;
    return `${kg.toFixed(1)} kg`;
  }

  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        paddingBottom: 90,
        position: "relative",
      }}
      onClick={handleInteraction}
    >
      {/* Header */}
      <div
        style={{
          padding: "56px 20px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 22,
            color: "#e8e8f0",
            margin: 0,
          }}
        >
          {mealLog.editingMealId ? "Edit Meal" : "Log"}
        </h1>
        {mealLog.editingMealId && (
          <button
            onClick={() => mealLog.reset()}
            style={{
              background: "none",
              border: "none",
              color: RED,
              fontFamily: MONO,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            CANCEL EDIT
          </button>
        )}
      </div>

      {/* Main tab segmented control */}
      {!mealLog.editingMealId && (
        <div style={{ padding: "0 20px", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              background: CARD,
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              padding: 3,
            }}
          >
            {(["MEAL", "WEIGHT"] as MainTab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  handleInteraction();
                  setMainTab(t);
                }}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 10,
                  border: "none",
                  background: mainTab === t ? GREEN : "transparent",
                  color: mainTab === t ? "#0A0A0F" : "#666",
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MEAL TAB */}
      {mainTab === "MEAL" && (
        <div style={{ padding: "0 20px" }}>
          <ProgressBar step={mealLog.step} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 16,
              gap: 12,
            }}
          >
            {mealLog.step > 1 && (
              <button
                onClick={() => mealLog.setStep((s) => s - 1)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#888",
                  fontSize: 20,
                  cursor: "pointer",
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                ‹
              </button>
            )}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: "#555",
                letterSpacing: "0.12em",
                marginLeft: mealLog.step === 1 ? 0 : undefined,
              }}
            >
              {mealLog.step} OF 5
            </span>
          </div>

          <MealTypePills
            selected={mealLog.mealType}
            onSelect={(m) => {
              handleInteraction();
              mealLog.setMealType(m);
            }}
          />

          <div style={{ marginBottom: 16 }}>
            <textarea
              value={mealLog.foodDescription}
              onChange={(e) => {
                handleInteraction();
                mealLog.setFoodDescription(e.target.value);
              }}
              onFocus={() => setTextareaFocused(true)}
              onBlur={() => setTextareaFocused(false)}
              placeholder="e.g. chicken tikka masala with basmati rice, side salad..."
              rows={3}
              style={{
                width: "100%",
                background: "#0A0A0F",
                border: `1px solid ${textareaFocused ? GREEN : BORDER}`,
                borderRadius: 12,
                minHeight: 80,
                color: "#e8e8f0",
                fontSize: 14,
                padding: 12,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s ease",
              }}
            />

            <button
              onClick={() => {
                handleInteraction();
                mealLog.analyze();
              }}
              disabled={!mealLog.foodDescription.trim() || mealLog.analyzing}
              style={{
                width: "100%",
                height: 44,
                marginTop: 8,
                borderRadius: 12,
                border: `1px solid ${!mealLog.foodDescription.trim() || mealLog.analyzing ? BORDER : GREEN}`,
                background: "transparent",
                color: !mealLog.foodDescription.trim() || mealLog.analyzing ? "#555" : GREEN,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                cursor: !mealLog.foodDescription.trim() || mealLog.analyzing ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {mealLog.analyzing ? "ANALYZING..." : "ANALYZE WITH AI ✦"}
            </button>

            {mealLog.error && (
              <p style={{ fontFamily: MONO, fontSize: 10, color: RED, marginTop: 6 }}>{mealLog.error}</p>
            )}

            {mealLog.foodAnalysis && (
              <div
                style={{
                  marginTop: 10,
                  background: "linear-gradient(135deg, #1a2a24, #15151f)",
                  border: `1px solid rgba(126,184,164,0.1)`,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <p style={{ fontFamily: MONO, fontSize: 9, color: GREEN, letterSpacing: "0.18em", marginBottom: 8, margin: 0 }}>AI ANALYSIS</p>
                <p style={{ color: "#c8c8d8", fontSize: 13, lineHeight: 1.5, marginTop: 8, marginBottom: 10 }}>{mealLog.foodAnalysis.gut_notes}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.3)", border: `1px solid ${mealLog.foodAnalysis.fiber_level === "high" ? GREEN : mealLog.foodAnalysis.fiber_level === "moderate" ? YELLOW : RED}`, color: mealLog.foodAnalysis.fiber_level === "high" ? GREEN : mealLog.foodAnalysis.fiber_level === "moderate" ? YELLOW : RED }}>FIBER · {mealLog.foodAnalysis.fiber_level.toUpperCase()}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.3)", border: `1px solid ${mealLog.foodAnalysis.ibs_trigger_risk === "low" ? GREEN : mealLog.foodAnalysis.ibs_trigger_risk === "moderate" ? ORANGE : RED}`, color: mealLog.foodAnalysis.ibs_trigger_risk === "low" ? GREEN : mealLog.foodAnalysis.ibs_trigger_risk === "moderate" ? ORANGE : RED }}>IBS RISK · {mealLog.foodAnalysis.ibs_trigger_risk.toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Steps 1-5 logic moved from original but using mealLog state */}
          {mealLog.step === 1 && (
            <div>
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 12 }}>PROTEIN</p>
              {PROTEIN_OPTIONS.map((opt) => (
                <div key={opt} onClick={() => { handleInteraction(); mealLog.setProtein(opt); mealLog.setStep(2); }} style={mealLog.protein === opt ? selectedCard : cardBase}>{opt}</div>
              ))}
            </div>
          )}

          {mealLog.step === 2 && (
            <div>
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 12 }}>CARBS</p>
              {CARB_OPTIONS.map((opt) => (
                <div key={opt} onClick={() => { handleInteraction(); mealLog.setCarbs(opt); mealLog.setStep(3); }} style={mealLog.carbs === opt ? selectedCard : cardBase}>{opt}</div>
              ))}
            </div>
          )}

          {mealLog.step === 3 && (
            <div>
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 12 }}>SPICE LEVEL</p>
              {SPICE_OPTIONS.map((opt) => (
                <div key={opt} onClick={() => { handleInteraction(); mealLog.setSpice(opt); mealLog.setStep(4); }} style={mealLog.spice === opt ? selectedCard : cardBase}>{opt}</div>
              ))}
            </div>
          )}

          {mealLog.step === 4 && (
            <div>
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 12 }}>ALCOHOL</p>
              {ALCOHOL_OPTIONS.map((opt) => (
                <div key={opt}>
                  <div onClick={() => { handleInteraction(); if (opt === "None") { mealLog.setAlcohol("None"); mealLog.setStep(5); } else { mealLog.setAlcohol(opt); mealLog.setAlcoholQty(1); } }} style={mealLog.alcohol === opt ? selectedCard : cardBase}>{opt}</div>
                  {mealLog.alcohol === opt && opt !== "None" && (
                    <div style={{ background: CARD, border: `1px solid ${GREEN}`, borderRadius: 18, padding: "16px 20px", marginBottom: 10, marginTop: -6 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <button onClick={(e) => { e.stopPropagation(); handleInteraction(); mealLog.setAlcoholQty((q) => Math.max(1, q - 1)); }} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${BORDER}`, background: "#1a1a2a", color: "#e8e8f0", fontSize: 20 }}>−</button>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: MONO, fontSize: 36, color: GREEN, lineHeight: 1 }}>{mealLog.alcoholQty}</div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: "#555", marginTop: 4 }}>{ALCOHOL_OZ[opt] * mealLog.alcoholQty} OZ TOTAL</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleInteraction(); mealLog.setAlcoholQty((q) => q + 1); }} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${BORDER}`, background: "#1a1a2a", color: "#e8e8f0", fontSize: 20 }}>+</button>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleInteraction(); mealLog.setStep(5); }} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: GREEN, color: "#0A0A0F", fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>CONFIRM · {ALCOHOL_OZ[opt] * mealLog.alcoholQty} OZ TOTAL</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {mealLog.step === 5 && (
            <div>
              <p style={{ fontFamily: SERIF, fontSize: 18, color: "#e8e8f0", marginBottom: 20 }}>How are you feeling?</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 24, justifyContent: "space-between" }}>
                {FEELINGS.map(({ emoji, label }) => (
                  <button key={label} onClick={() => { handleInteraction(); mealLog.setFeeling(label); }} style={{ flex: 1, padding: "10px 4px", borderRadius: 14, border: `2px solid ${mealLog.feeling === label ? GREEN : BORDER}`, background: mealLog.feeling === label ? "rgba(126,184,164,0.08)" : CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 28 }}>{emoji}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: mealLog.feeling === label ? GREEN : "#555" }}>{label.toUpperCase()}</span>
                  </button>
                ))}
              </div>
              <p style={{ fontFamily: MONO, fontSize: 9, color: "#555", letterSpacing: "0.12em", marginBottom: 10 }}>SYMPTOM TAGS</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
                {SYMPTOM_TAGS.map(({ key, label, icon }) => {
                  const active = mealLog.symptoms.has(key);
                  return (
                    <button key={key} onClick={() => toggleSymptom(key)} style={{ padding: "10px 6px", borderRadius: 12, border: `1px solid ${active ? ORANGE : BORDER}`, background: active ? "rgba(255,140,66,0.15)" : CARD, color: active ? ORANGE : "#666", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9 }}>{label.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => mealLog.save()} disabled={!mealLog.feeling || mealLog.saving} style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: mealLog.feeling ? GREEN : "#1e1e2e", color: mealLog.feeling ? "#0A0A0F" : "#444", fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>
                {mealLog.saving ? "SAVING..." : mealLog.editingMealId ? "UPDATE MEAL" : "SAVE MEAL"}
              </button>
            </div>
          )}

          {/* RECENT MEALS SECTION */}
          {!mealLog.editingMealId && mealLog.recentMeals.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <p style={{ fontFamily: MONO, fontSize: 9, color: "#555", letterSpacing: "0.14em", marginBottom: 14 }}>RECENT MEALS</p>
              {mealLog.recentMeals.map((m) => (
                <div key={m.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN, fontWeight: 700 }}>{m.meal_type.toUpperCase()}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: "#444", marginLeft: 8 }}>{formatTime(m.timestamp)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => mealLog.editMeal(m)} style={{ background: "none", border: "none", color: "#666", fontFamily: MONO, fontSize: 10, cursor: "pointer" }}>EDIT</button>
                      <button onClick={() => m.id && mealLog.deleteMeal(m.id)} style={{ background: "none", border: "none", color: RED, fontFamily: MONO, fontSize: 10, cursor: "pointer", opacity: 0.7 }}>DELETE</button>
                    </div>
                  </div>
                  <p style={{ color: "#e8e8f0", fontSize: 14, margin: "0 0 6px" }}>{m.food_description || `${m.protein} with ${m.carbs}`}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: "#555" }}>{m.feeling?.toUpperCase()}</span>
                    {m.symptom_tags.map(tag => (
                      <span key={tag} style={{ fontFamily: MONO, fontSize: 9, color: ORANGE }}>· {tag.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── WEIGHT TAB */}
      {mainTab === "WEIGHT" && (
        <div style={{ padding: "0 20px" }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
            <p style={{ fontFamily: MONO, fontSize: 9, color: "#555", letterSpacing: "0.14em", marginBottom: 16 }}>TODAY&apos;S WEIGHT</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <input type="number" inputMode="decimal" placeholder="0.0" value={weightLog.weightValue} onChange={(e) => { handleInteraction(); weightLog.setWeightValue(e.target.value); }} style={{ flex: 1, background: "transparent", border: "none", borderBottom: `2px solid ${BORDER}`, outline: "none", color: YELLOW, fontFamily: MONO, fontSize: 28, fontWeight: 700, padding: "4px 0", width: "100%" }} />
              <div style={{ display: "flex", background: "#1a1a2a", borderRadius: 10, padding: 3, border: `1px solid ${BORDER}` }}>
                {(["lbs", "kg"] as const).map((u) => (
                  <button key={u} onClick={() => { handleInteraction(); weightLog.setWeightUnit(u); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: weightLog.weightUnit === u ? GREEN : "transparent", color: weightLog.weightUnit === u ? "#0A0A0F" : "#555", fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>{u}</button>
                ))}
              </div>
            </div>
            <button onClick={() => weightLog.save()} disabled={!weightLog.weightValue || weightLog.saving} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: weightLog.weightValue ? GREEN : "#1e1e2e", color: weightLog.weightValue ? "#0A0A0F" : "#444", fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
              {weightLog.saving ? "SAVING..." : "SAVE WEIGHT"}
            </button>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 20 }}>
            <p style={{ fontFamily: MONO, fontSize: 9, color: "#555", letterSpacing: "0.14em", marginBottom: 14 }}>RECENT</p>
            {weightLog.recentWeights.length === 0 ? <p style={{ fontFamily: MONO, fontSize: 10, color: "#333" }}>No entries yet</p> : weightLog.recentWeights.map((w) => (
              <div key={w.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "#555" }}>{formatDate(w.date)}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: YELLOW, fontWeight: 700 }}>{formatWeightDisplay(w.weight_kg || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Overlay */}
      {mealLog.showSuccess && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,15,0.85)", zIndex: 100 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(126,184,164,0.15)", border: `2px solid ${GREEN}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 32, color: GREEN }}>✓</span>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}
