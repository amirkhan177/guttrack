"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  getPinFromSession,
  isSessionExpired,
  refreshActivity,
  clearSession,
} from "@/lib/crypto";
import NavBar from "@/components/NavBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type MainTab = "MEAL" | "WEIGHT";

type FoodAnalysis = {
  protein: string;
  carbs: string;
  spice: string;
  gut_notes: string;
  fiber_level: "high" | "moderate" | "low";
  key_nutrients: string[];
  gut_cautions: string[];
  ibs_trigger_risk: "low" | "moderate" | "high";
  kidney_notes: string;
};

type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
type Step = 1 | 2 | 3 | 4 | 5;
type Feeling = "Great" | "Good" | "Okay" | "Bad" | "Awful";

type AlcoholChoice = "None" | "Beer" | "Wine" | "Spirit";

const PROTEIN_OPTIONS = [
  "Chicken",
  "Fish",
  "Eggs",
  "Red Meat",
  "Lentils/Dal",
  "Tofu",
  "None",
];

const CARB_OPTIONS = [
  "White Rice",
  "Bread",
  "Pasta",
  "Cooked Vegetables",
  "Leafy Greens",
  "Legumes/Beans",
  "Oats",
  "None",
];

const SPICE_OPTIONS = ["None", "Mild", "Medium", "Hot", "Very Hot"];

const ALCOHOL_OPTIONS: AlcoholChoice[] = ["None", "Beer", "Wine", "Spirit"];

const FEELINGS: { emoji: string; label: Feeling }[] = [
  { emoji: "😊", label: "Great" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😣", label: "Bad" },
  { emoji: "🤢", label: "Awful" },
];

type SymptomTag = {
  key: string;
  label: string;
  icon: string;
};

const SYMPTOM_TAGS: SymptomTag[] = [
  { key: "burning", label: "Burning", icon: "🔥" },
  { key: "pain", label: "Pain", icon: "⚡" },
  { key: "sore_left", label: "Sore Left", icon: "◀" },
  { key: "sore_right", label: "Sore Right", icon: "▶" },
  { key: "front", label: "Front", icon: "↑" },
  { key: "back", label: "Back", icon: "↓" },
];

const ALCOHOL_OZ: Record<string, number> = {
  Beer: 14,
  Wine: 6,
  Spirit: 2,
};

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

function ProgressBar({ step }: { step: Step }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
      {([1, 2, 3, 4, 5] as Step[]).map((s) => (
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
  const router = useRouter();

  // Session guard
  useEffect(() => {
    const pin = getPinFromSession();
    if (!pin || isSessionExpired()) {
      clearSession();
      router.replace("/pin");
    }
  }, [router]);

  const touch = useCallback(() => refreshActivity(), []);

  // ── Tab state
  const [mainTab, setMainTab] = useState<MainTab>("MEAL");

  // ── Meal state
  const [step, setStep] = useState<Step>(1);
  const [mealType, setMealType] = useState<MealType>("Breakfast");
  const [protein, setProtein] = useState<string | null>(null);
  const [carbs, setCarbs] = useState<string | null>(null);
  const [spice, setSpice] = useState<string | null>(null);
  const [alcohol, setAlcohol] = useState<AlcoholChoice | null>(null);
  const [alcoholQty, setAlcoholQty] = useState(1);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Food analysis state
  const [foodDescription, setFoodDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [foodAnalysis, setFoodAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);

  // ── Weight state
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const [recentWeights, setRecentWeights] = useState<
    { date: string; weight_kg: number }[]
  >([]);
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightSuccess, setWeightSuccess] = useState(false);

  // Load recent weights on mount
  useEffect(() => {
    async function loadWeights() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("weight_entries")
        .select("date, weight_kg")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(7);
      if (data) setRecentWeights(data);
    }
    loadWeights();
  }, [weightSuccess]);

  // ── Meal helpers
  function resetMeal() {
    setStep(1);
    setProtein(null);
    setCarbs(null);
    setSpice(null);
    setAlcohol(null);
    setAlcoholQty(1);
    setFeeling(null);
    setSymptoms(new Set());
    setFoodDescription("");
    setFoodAnalysis(null);
    setAnalyzing(false);
    setAnalyzeError(null);
  }

  function goBack() {
    touch();
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function advanceStep() {
    setStep((s) => (s + 1) as Step);
  }

  function toggleSymptom(key: string) {
    touch();
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function feelingEmoji(f: Feeling | null): string {
    if (!f) return "";
    const found = FEELINGS.find((x) => x.label === f);
    return found ? found.emoji : "";
  }

  function buildAlcoholString(): string {
    if (!alcohol || alcohol === "None") return "None";
    const oz = ALCOHOL_OZ[alcohol] * alcoholQty;
    return `${alcohol}:${alcoholQty}:${oz}oz`;
  }

  async function analyzeFoodDescription() {
    if (!foodDescription.trim() || analyzing) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/food/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: foodDescription }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data: FoodAnalysis = await res.json();
      setFoodAnalysis(data);
      // Auto-pre-fill selections from analysis
      if (data.protein) setProtein(data.protein);
      if (data.carbs) setCarbs(data.carbs);
      if (data.spice) setSpice(data.spice);
    } catch {
      setAnalyzeError("Could not analyze. Try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveMeal() {
    touch();
    if (!feeling) return;
    setSaving(true);
    setAnalyzeError(null); // Reuse analyze error for simplicity or add a new one
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/pin");
        return;
      }
      const { error } = await supabase.from("meal_logs").insert({
        timestamp: new Date().toISOString(),
        meal_type: mealType,
        protein,
        carbs,
        spice,
        alcohol: buildAlcoholString(),
        feeling,
        symptom_tags: Array.from(symptoms),
        user_id: user.id,
        food_description: foodDescription || null,
      });

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetMeal();
      }, 1600);
    } catch (err: unknown) {
      console.error("Save meal error:", err);
      const message = err instanceof Error ? err.message : "Could not save meal. Please try again.";
      setAnalyzeError(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveWeight() {
    touch();
    if (!weightValue) return;
    setWeightSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/pin");
        return;
      }
      const raw = parseFloat(weightValue);
      if (isNaN(raw)) return;
      const kg = weightUnit === "lbs" ? raw / 2.20462 : raw;
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("weight_entries").upsert(
        { user_id: user.id, date: today, weight_kg: parseFloat(kg.toFixed(2)) },
        { onConflict: "user_id,date" }
      );
      setWeightValue("");
      setWeightSuccess((v) => !v);
    } finally {
      setWeightSaving(false);
    }
  }

  function formatWeightDisplay(kg: number): string {
    if (weightUnit === "lbs") return `${(kg * 2.20462).toFixed(1)} lbs`;
    return `${kg.toFixed(1)} kg`;
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // ── Render
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
      onClick={touch}
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
          Log
        </h1>
      </div>

      {/* Main tab segmented control */}
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
                touch();
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

      {/* ── MEAL TAB */}
      {mainTab === "MEAL" && (
        <div style={{ padding: "0 20px" }}>
          {/* Progress bar */}
          <ProgressBar step={step} />

          {/* Step header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 16,
              gap: 12,
            }}
          >
            {step > 1 && (
              <button
                onClick={goBack}
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
                marginLeft: step === 1 ? 0 : undefined,
              }}
            >
              {step} OF 5
            </span>
          </div>

          {/* Meal type pills — persists across all steps */}
          <MealTypePills
            selected={mealType}
            onSelect={(m) => {
              touch();
              setMealType(m);
            }}
          />

          {/* ── FOOD ANALYSIS CARD */}
          <div style={{ marginBottom: 16 }}>
            {/* Textarea */}
            <textarea
              value={foodDescription}
              onChange={(e) => {
                touch();
                setFoodDescription(e.target.value);
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

            {/* Analyze button */}
            <button
              onClick={() => {
                touch();
                analyzeFoodDescription();
              }}
              disabled={!foodDescription.trim() || analyzing}
              style={{
                width: "100%",
                height: 44,
                marginTop: 8,
                borderRadius: 12,
                border: `1px solid ${!foodDescription.trim() || analyzing ? BORDER : GREEN}`,
                background: "transparent",
                color: !foodDescription.trim() || analyzing ? "#555" : GREEN,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                cursor: !foodDescription.trim() || analyzing ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {analyzing ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      animation: "spin 1s linear infinite",
                      fontSize: 14,
                    }}
                  >
                    ◌
                  </span>
                  ANALYZING...
                </>
              ) : (
                "ANALYZE WITH AI ✦"
              )}
            </button>

            {/* Error message */}
            {analyzeError && (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: RED,
                  marginTop: 6,
                  letterSpacing: "0.06em",
                }}
              >
                {analyzeError}
              </p>
            )}

            {/* Analysis result card */}
            {foodAnalysis && (
              <div
                style={{
                  marginTop: 10,
                  background: "linear-gradient(135deg, #1a2a24, #15151f)",
                  border: `1px solid rgba(126,184,164,0.1)`,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                {/* Label */}
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    color: GREEN,
                    letterSpacing: "0.18em",
                    marginBottom: 8,
                    margin: 0,
                  }}
                >
                  AI ANALYSIS
                </p>

                {/* gut_notes */}
                <p
                  style={{
                    color: "#c8c8d8",
                    fontSize: 13,
                    lineHeight: 1.5,
                    marginTop: 8,
                    marginBottom: 10,
                  }}
                >
                  {foodAnalysis.gut_notes}
                </p>

                {/* Fiber + IBS pills row */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  {/* Fiber level pill */}
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${
                        foodAnalysis.fiber_level === "high"
                          ? GREEN
                          : foodAnalysis.fiber_level === "moderate"
                          ? YELLOW
                          : RED
                      }`,
                      color:
                        foodAnalysis.fiber_level === "high"
                          ? GREEN
                          : foodAnalysis.fiber_level === "moderate"
                          ? YELLOW
                          : RED,
                    }}
                  >
                    FIBER · {foodAnalysis.fiber_level.toUpperCase()}
                  </span>

                  {/* IBS risk pill */}
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "rgba(0,0,0,0.3)",
                      border: `1px solid ${
                        foodAnalysis.ibs_trigger_risk === "low"
                          ? GREEN
                          : foodAnalysis.ibs_trigger_risk === "moderate"
                          ? ORANGE
                          : RED
                      }`,
                      color:
                        foodAnalysis.ibs_trigger_risk === "low"
                          ? GREEN
                          : foodAnalysis.ibs_trigger_risk === "moderate"
                          ? ORANGE
                          : RED,
                    }}
                  >
                    IBS RISK · {foodAnalysis.ibs_trigger_risk.toUpperCase()}
                  </span>
                </div>

                {/* Cautions */}
                {foodAnalysis.gut_cautions.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {foodAnalysis.gut_cautions.map((c, i) => (
                      <p
                        key={i}
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          color: ORANGE,
                          margin: "4px 0",
                          letterSpacing: "0.04em",
                        }}
                      >
                        ⚠️ {c}
                      </p>
                    ))}
                  </div>
                )}

                {/* Kidney notes */}
                {foodAnalysis.kidney_notes && (
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: "#666",
                      margin: 0,
                      marginBottom: 8,
                    }}
                  >
                    {foodAnalysis.kidney_notes}
                  </p>
                )}

                {/* Pre-fill hint */}
                {(foodAnalysis.protein || foodAnalysis.carbs || foodAnalysis.spice) && (
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: GREEN,
                      letterSpacing: "0.14em",
                      margin: 0,
                    }}
                  >
                    PRE-FILLED SELECTIONS BELOW ↓
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── STEP 1: PROTEIN */}
          {step === 1 && (
            <div>
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#555",
                  letterSpacing: "0.12em",
                  marginBottom: 12,
                }}
              >
                PROTEIN
              </p>
              {PROTEIN_OPTIONS.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    touch();
                    setProtein(opt);
                    advanceStep();
                  }}
                  style={{
                    ...(protein === opt ? selectedCard : cardBase),
                    minHeight: 52,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#d0d0e0", fontSize: 14 }}>{opt}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 2: CARBS */}
          {step === 2 && (
            <div>
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#555",
                  letterSpacing: "0.12em",
                  marginBottom: 12,
                }}
              >
                CARBS
              </p>
              {CARB_OPTIONS.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    touch();
                    setCarbs(opt);
                    advanceStep();
                  }}
                  style={{
                    ...(carbs === opt ? selectedCard : cardBase),
                    minHeight: 52,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#d0d0e0", fontSize: 14 }}>{opt}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 3: SPICE */}
          {step === 3 && (
            <div>
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#555",
                  letterSpacing: "0.12em",
                  marginBottom: 12,
                }}
              >
                SPICE LEVEL
              </p>
              {SPICE_OPTIONS.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    touch();
                    setSpice(opt);
                    advanceStep();
                  }}
                  style={{
                    ...(spice === opt ? selectedCard : cardBase),
                    minHeight: 52,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#d0d0e0", fontSize: 14 }}>{opt}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 4: ALCOHOL */}
          {step === 4 && (
            <div>
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#555",
                  letterSpacing: "0.12em",
                  marginBottom: 12,
                }}
              >
                ALCOHOL
              </p>
              {ALCOHOL_OPTIONS.map((opt) => (
                <div key={opt}>
                  <div
                    onClick={() => {
                      touch();
                      if (opt === "None") {
                        setAlcohol("None");
                        advanceStep();
                      } else {
                        setAlcohol(opt);
                        setAlcoholQty(1);
                      }
                    }}
                    style={{
                      ...(alcohol === opt ? selectedCard : cardBase),
                      minHeight: 52,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#d0d0e0", fontSize: 14 }}>{opt}</span>
                  </div>

                  {/* Quantity controls for selected non-None alcohol */}
                  {alcohol === opt && opt !== "None" && (
                    <div
                      style={{
                        background: CARD,
                        border: `1px solid ${GREEN}`,
                        borderRadius: 18,
                        padding: "16px 20px",
                        marginBottom: 10,
                        marginTop: -6,
                      }}
                    >
                      {/* Counter */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 12,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            touch();
                            setAlcoholQty((q) => Math.max(1, q - 1));
                          }}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: `1px solid ${BORDER}`,
                            background: "#1a1a2a",
                            color: "#e8e8f0",
                            fontSize: 20,
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>
                        <div style={{ textAlign: "center" }}>
                          <div
                            style={{
                              fontFamily: MONO,
                              fontSize: 36,
                              color: GREEN,
                              lineHeight: 1,
                            }}
                          >
                            {alcoholQty}
                          </div>
                          <div
                            style={{
                              fontFamily: MONO,
                              fontSize: 9,
                              color: "#555",
                              marginTop: 4,
                            }}
                          >
                            {ALCOHOL_OZ[opt] * alcoholQty} OZ TOTAL
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            touch();
                            setAlcoholQty((q) => q + 1);
                          }}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: `1px solid ${BORDER}`,
                            background: "#1a1a2a",
                            color: "#e8e8f0",
                            fontSize: 20,
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                      {/* Confirm */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          touch();
                          advanceStep();
                        }}
                        style={{
                          width: "100%",
                          padding: "12px 0",
                          borderRadius: 12,
                          border: "none",
                          background: GREEN,
                          color: "#0A0A0F",
                          fontFamily: MONO,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          cursor: "pointer",
                        }}
                      >
                        CONFIRM · {ALCOHOL_OZ[opt] * alcoholQty} OZ TOTAL
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 5: GUT FEELING */}
          {step === 5 && (
            <div>
              <p
                style={{
                  fontFamily: SERIF,
                  fontSize: 18,
                  color: "#e8e8f0",
                  marginBottom: 20,
                }}
              >
                How are you feeling?
              </p>

              {/* Feeling row */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 24,
                  justifyContent: "space-between",
                }}
              >
                {FEELINGS.map(({ emoji, label }) => (
                  <button
                    key={label}
                    onClick={() => {
                      touch();
                      setFeeling(label);
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 4px",
                      borderRadius: 14,
                      border: `2px solid ${feeling === label ? GREEN : BORDER}`,
                      background: feeling === label ? "rgba(126,184,164,0.08)" : CARD,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: 28 }}>{emoji}</span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 8,
                        color: feeling === label ? GREEN : "#555",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>

              {/* Symptom tags */}
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  color: "#555",
                  letterSpacing: "0.12em",
                  marginBottom: 10,
                }}
              >
                SYMPTOM TAGS
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                {SYMPTOM_TAGS.map(({ key, label, icon }) => {
                  const active = symptoms.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSymptom(key)}
                      style={{
                        padding: "10px 6px",
                        borderRadius: 12,
                        border: `1px solid ${active ? ORANGE : BORDER}`,
                        background: active ? "rgba(255,140,66,0.15)" : CARD,
                        color: active ? ORANGE : "#666",
                        fontFamily: MONO,
                        fontSize: 9,
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <span>{label.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>

              {/* Save button */}
              <button
                onClick={saveMeal}
                disabled={!feeling || saving}
                style={{
                  width: "100%",
                  padding: "15px 0",
                  borderRadius: 14,
                  border: "none",
                  background: feeling ? GREEN : "#1e1e2e",
                  color: feeling ? "#0A0A0F" : "#444",
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor: feeling ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
              >
                {feeling
                  ? `SAVE · ${feelingEmoji(feeling)}${symptoms.size > 0 ? ` · ${symptoms.size} TAG${symptoms.size > 1 ? "S" : ""}` : ""}`
                  : "SAVE"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── WEIGHT TAB */}
      {mainTab === "WEIGHT" && (
        <div style={{ padding: "0 20px" }}>
          <div
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: "#555",
                letterSpacing: "0.14em",
                marginBottom: 16,
              }}
            >
              TODAY&apos;S WEIGHT
            </p>

            {/* Value input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                value={weightValue}
                onChange={(e) => {
                  touch();
                  setWeightValue(e.target.value);
                }}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${BORDER}`,
                  outline: "none",
                  color: YELLOW,
                  fontFamily: MONO,
                  fontSize: 28,
                  fontWeight: 700,
                  padding: "4px 0",
                  width: "100%",
                }}
              />
              {/* Unit toggle */}
              <div
                style={{
                  display: "flex",
                  background: "#1a1a2a",
                  borderRadius: 10,
                  padding: 3,
                  border: `1px solid ${BORDER}`,
                }}
              >
                {(["lbs", "kg"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => {
                      touch();
                      setWeightUnit(u);
                    }}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: weightUnit === u ? GREEN : "transparent",
                      color: weightUnit === u ? "#0A0A0F" : "#555",
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={saveWeight}
              disabled={!weightValue || weightSaving}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 12,
                border: "none",
                background: weightValue ? GREEN : "#1e1e2e",
                color: weightValue ? "#0A0A0F" : "#444",
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                cursor: weightValue ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
              }}
            >
              {weightSaving ? "SAVING..." : "SAVE WEIGHT"}
            </button>
          </div>

          {/* Recent weights */}
          <div
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: 20,
            }}
          >
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: "#555",
                letterSpacing: "0.14em",
                marginBottom: 14,
              }}
            >
              RECENT
            </p>
            {recentWeights.length === 0 ? (
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#333" }}>
                No entries yet
              </p>
            ) : (
              recentWeights.map((w) => (
                <div
                  key={w.date}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 10,
                    marginBottom: 10,
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: "#555",
                    }}
                  >
                    {formatDate(w.date)}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 13,
                      color: YELLOW,
                      fontWeight: 700,
                    }}
                  >
                    {formatWeightDisplay(w.weight_kg)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Success overlay */}
      {showSuccess && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,10,15,0.85)",
            zIndex: 100,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(126,184,164,0.15)",
              border: `2px solid ${GREEN}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "scaleIn 0.25s ease",
            }}
          >
            <span style={{ fontSize: 32, color: GREEN }}>✓</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

      <NavBar />
    </div>
  );
}
