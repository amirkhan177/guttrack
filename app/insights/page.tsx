"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { DailyInsight } from "@/lib/supabase";
import {
  getPinFromSession,
  isSessionExpired,
  refreshActivity,
} from "@/lib/crypto";
import NavBar from "@/components/NavBar";
import { useFeedbackModal } from "@/contexts/FeedbackModalContext";

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG = "#0A0A0F";
const CARD = "#15151f";
const BORDER = "#1e1e2e";
const GREEN = "#7EB8A4";
const YELLOW = "#FFD93D";
const RED = "#FF6B6B";
const ORANGE = "#FF8C42";
const MONO = "SF Mono, ui-monospace, monospace";
const SERIF = "Georgia, 'Times New Roman', serif";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMtnYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
}

function flareRiskColor(level: string | null): string {
  switch (level) {
    case "Low":
    case "None":
      return GREEN;
    case "Moderate":
      return ORANGE;
    case "High":
      return RED;
    case "Critical":
      return "#8B0000";
    default:
      return GREEN;
  }
}

function flareRiskCardStyle(level: string | null): {
  bg: string;
  border: string;
} {
  switch (level) {
    case "Low":
    case "None":
      return { bg: "rgba(126,184,164,0.08)", border: GREEN };
    case "Moderate":
      return { bg: "rgba(255,140,66,0.1)", border: ORANGE };
    case "High":
      return { bg: "rgba(255,107,107,0.1)", border: RED };
    case "Critical":
      return { bg: "rgba(139,0,0,0.15)", border: "#8B0000" };
    default:
      return { bg: "rgba(126,184,164,0.08)", border: GREEN };
  }
}

// ─── Typed accessors ──────────────────────────────────────────────────────────

type AvoidItem = { item: string; reason: string; duration: string };
type DietItem = { item: string; reason: string; timing: string };

function getAvoid(insight: DailyInsight): AvoidItem[] {
  const raw = insight.avoid;
  if (Array.isArray(raw)) return raw as AvoidItem[];
  return [];
}

function getDiet(insight: DailyInsight): DietItem[] {
  const raw = insight.add_to_diet;
  if (Array.isArray(raw)) return raw as DietItem[];
  return [];
}

function getPatterns(insight: DailyInsight): string[] {
  const raw = insight.patterns;
  if (Array.isArray(raw)) return raw as string[];
  return [];
}

function getPred(insight: DailyInsight): Record<string, unknown> {
  return (insight.prediction as Record<string, unknown>) ?? {};
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <div
      style={{
        background: CARD,
        borderRadius: 18,
        height,
        marginBottom: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
          animation: "pulse 1.6s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const router = useRouter();
  const { openFeedbackModal } = useFeedbackModal();

  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [weekScores, setWeekScores] = useState<{ date: string; score: number }[]>([]);
  const [whatHappenedOpen, setWhatHappenedOpen] = useState(false);

  const yesterday = getMtnYesterday();

  // Session guard
  useEffect(() => {
    const pin = getPinFromSession();
    if (!pin || isSessionExpired()) {
      router.replace("/pin");
    }
  }, [router]);

  const touch = useCallback(() => refreshActivity(), []);

  const loadData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/pin");
      return;
    }

    // Try daily first, then fall back to old window_types
    const { data: dailyRows } = await supabase
      .from("daily_insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .eq("window_type", "daily")
      .order("generated_at", { ascending: false })
      .limit(1);

    if (dailyRows && dailyRows.length > 0) {
      setInsight(dailyRows[0] as DailyInsight);
    } else {
      // Fallback to old window_types
      const { data: fallbackRows } = await supabase
        .from("daily_insights")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", yesterday)
        .in("window_type", ["analysis", "prediction"])
        .order("generated_at", { ascending: false })
        .limit(1);

      if (fallbackRows && fallbackRows.length > 0) {
        setInsight(fallbackRows[0] as DailyInsight);
      } else {
        setInsight(null);
      }
    }

    // Last 7 days for chart
    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 6);
    const fromDate = sevenAgo.toLocaleDateString("en-CA", {
      timeZone: "America/Denver",
    });

    const { data: chartRows } = await supabase
      .from("daily_insights")
      .select("date, prediction_confidence")
      .eq("user_id", user.id)
      .gte("date", fromDate)
      .order("date", { ascending: true });

    if (chartRows) {
      // Deduplicate by date — keep last
      const byDate = new Map<string, number>();
      for (const row of chartRows) {
        byDate.set(row.date, (row.prediction_confidence as number) ?? 0);
      }
      const scores = Array.from(byDate.entries()).map(([date, score]) => ({
        date,
        score,
      }));
      setWeekScores(scores);
    }
  }, [router, yesterday]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");
      try {
        await loadData();
      } catch {
        setError("Failed to load insights.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadData]);

  async function handleGenerate() {
    touch();
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/insights/daily", { method: "POST" });
      if (!res.ok) throw new Error("Generate failed");
      await loadData();
    } catch {
      setError("Failed to generate insights. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Format date display
  const formattedDate = (() => {
    const [y, m, d] = yesterday.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  })();

  const generatedAtTime = (() => {
    if (!insight?.generated_at) return null;
    return new Date(insight.generated_at).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Denver",
    });
  })();

  const pred = insight ? getPred(insight) : {};
  const gutScore = pred.gut_score as number | undefined;
  const oneLine = pred.one_line as string | undefined;
  const readinessLabel = pred.readiness_label as string | undefined;
  const sleepQuality = pred.sleep_quality as string | undefined;
  const stressLevel = pred.stress_level as string | undefined;
  const howYoullFeel = pred.how_youll_feel as string | undefined;
  const reasoning = pred.reasoning as string | undefined;
  const watchFor = pred.watch_for as string[] | undefined;
  const symptomTags = pred.symptom_tags as string[] | undefined;

  const flareLevel = insight?.flare_risk_level ?? null;
  const confidence = insight?.prediction_confidence ?? (pred.confidence as number | undefined) ?? 0;
  const avoid = insight ? getAvoid(insight) : [];
  const diet = insight ? getDiet(insight) : [];
  const patterns = insight ? getPatterns(insight) : [];
  const flareStyle = flareRiskCardStyle(flareLevel);

  // Chart day labels
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const chartData = weekScores.map((s) => {
    const [y, m, d] = s.date.split("-").map(Number);
    const day = dayLabels[new Date(y, m - 1, d).getDay()];
    return { day, score: s.score, isYesterday: s.date === yesterday };
  });

  return (
    <div
      style={{ background: BG, minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}
      onClick={touch}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div
        style={{
          padding: "56px 20px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <h1 style={{ fontFamily: SERIF, fontSize: 22, color: "#e8e8f0", margin: 0 }}>
          INSIGHTS
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* RATE TODAY */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openFeedbackModal();
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${GREEN}`,
              background: BORDER,
              color: GREEN,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            RATE TODAY
          </button>
          {/* Regenerate */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
            disabled={generating}
            title="Regenerate insights"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `1px solid ${BORDER}`,
              background: BORDER,
              color: generating ? "#444" : "#888",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: generating ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <span
              style={
                generating
                  ? { display: "inline-block", animation: "spin 1s linear infinite" }
                  : {}
              }
            >
              ↻
            </span>
          </button>
        </div>
      </div>

      {/* ── DATE LINE ── */}
      <div style={{ padding: "4px 20px 16px" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#555" }}>
          Analysis for {formattedDate}
          {generatedAtTime ? ` · ${generatedAtTime} MT` : ""}
        </span>
      </div>

      {/* ── ERROR BANNER ── */}
      {error ? (
        <div style={{ padding: "0 20px 12px" }}>
          <div
            style={{
              background: "rgba(255,107,107,0.1)",
              border: `1px solid ${RED}44`,
              borderRadius: 10,
              padding: "10px 14px",
              fontFamily: MONO,
              fontSize: 11,
              color: RED,
            }}
          >
            {error}
          </div>
        </div>
      ) : null}

      {/* ── SCROLL CONTENT ── */}
      <div style={{ padding: "0 20px", paddingBottom: 80 }}>
        {loading ? (
          /* LOADING STATE */
          <>
            <SkeletonCard height={160} />
            <SkeletonCard height={100} />
            <SkeletonCard height={120} />
          </>
        ) : !insight ? (
          /* ── EMPTY STATE ── */
          <div
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
            <h2
              style={{
                fontFamily: SERIF,
                fontSize: 18,
                color: "#e8e8f0",
                margin: "0 0 8px",
              }}
            >
              No insights yet
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "#666",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              Generated daily at 8am MT from your Oura data + meal logs
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGenerate();
              }}
              disabled={generating}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 10,
                border: `1px solid ${GREEN}`,
                background: "transparent",
                color: GREEN,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.1em",
                cursor: generating ? "not-allowed" : "pointer",
                opacity: generating ? 0.6 : 1,
              }}
            >
              {generating ? "GENERATING…" : "GENERATE NOW"}
            </button>
          </div>
        ) : (
          /* ── FULL INSIGHT CONTENT ── */
          <>
            {/* 1. TODAY'S FORECAST CARD */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(126,184,164,0.12), rgba(21,21,31,1))",
                border: `1px solid rgba(126,184,164,0.19)`,
                borderRadius: 18,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: GREEN,
                  letterSpacing: "0.18em",
                  marginBottom: 14,
                }}
              >
                HOW YOU&apos;LL FEEL TODAY
              </p>

              {/* Flare level — large */}
              {flareLevel ? (
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 32,
                    color: flareRiskColor(flareLevel),
                    marginBottom: 14,
                    lineHeight: 1.1,
                  }}
                >
                  {flareLevel} Risk
                </div>
              ) : null}

              {/* Confidence bar */}
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: "#666",
                      letterSpacing: "0.12em",
                    }}
                  >
                    CONFIDENCE
                  </span>
                  <span
                    style={{ fontFamily: MONO, fontSize: 9, color: GREEN }}
                  >
                    {confidence}%
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: BORDER,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${confidence}%`,
                      background: GREEN,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>

              {howYoullFeel ? (
                <p
                  style={{
                    fontSize: 14,
                    color: "#c8c8d8",
                    lineHeight: 1.6,
                    marginBottom: reasoning ? 10 : 0,
                  }}
                >
                  {howYoullFeel}
                </p>
              ) : null}

              {reasoning ? (
                <p
                  style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}
                >
                  {reasoning}
                </p>
              ) : null}
            </div>

            {/* 2. GUT SCORE CARD */}
            {(gutScore !== undefined || oneLine) ? (
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #1a2a24, #0d1610)",
                  borderRadius: 18,
                  padding: 18,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                >
                  {gutScore !== undefined ? (
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 48,
                        color: GREEN,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      {gutScore}
                    </div>
                  ) : null}
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    {readinessLabel ? (
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 10,
                          color: "#888",
                          marginBottom: 4,
                        }}
                      >
                        {readinessLabel}
                      </div>
                    ) : null}
                    {sleepQuality ? (
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 10,
                          color: "#888",
                          marginBottom: 4,
                        }}
                      >
                        {sleepQuality}
                      </div>
                    ) : null}
                    {stressLevel ? (
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 10,
                          color: "#888",
                        }}
                      >
                        {stressLevel}
                      </div>
                    ) : null}
                  </div>
                </div>
                {oneLine ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#aaa",
                      fontStyle: "italic",
                      marginTop: 10,
                      lineHeight: 1.5,
                    }}
                  >
                    {oneLine}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* 3. FLARE RISK CARD */}
            {flareLevel ? (
              <div
                style={{
                  background: flareStyle.bg,
                  border: `1px solid ${flareStyle.border}`,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: flareStyle.border,
                    letterSpacing: "0.14em",
                    marginBottom: 8,
                    opacity: 0.8,
                  }}
                >
                  FLARE RISK
                </p>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 26,
                    color: flareRiskColor(flareLevel),
                    marginBottom: 10,
                  }}
                >
                  {flareLevel}
                </div>
                {insight.flare_risk_reason ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#999",
                      lineHeight: 1.5,
                      marginBottom:
                        insight.contributing_factors &&
                        insight.contributing_factors.length > 0
                          ? 12
                          : 0,
                    }}
                  >
                    {insight.flare_risk_reason}
                  </p>
                ) : null}
                {insight.contributing_factors &&
                insight.contributing_factors.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {insight.contributing_factors.map((f, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          background: `${flareStyle.border}20`,
                          border: `1px solid ${flareStyle.border}44`,
                          color: flareStyle.border,
                          fontFamily: MONO,
                          fontSize: 9,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* 4. WHAT HAPPENED YESTERDAY — collapsible */}
            {insight.what_happened ? (
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWhatHappenedOpen((v) => !v);
                  }}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    background: "transparent",
                    border: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: "#666",
                      letterSpacing: "0.14em",
                    }}
                  >
                    WHAT HAPPENED YESTERDAY{" "}
                    <span style={{ color: "#444" }}>
                      {whatHappenedOpen ? "▴" : "▾"}
                    </span>
                  </span>
                </button>
                {whatHappenedOpen ? (
                  <div style={{ padding: "0 20px 18px" }}>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#c8c8d8",
                        lineHeight: 1.6,
                        marginBottom:
                          symptomTags && symptomTags.length > 0 ? 14 : 0,
                      }}
                    >
                      {insight.what_happened}
                    </p>
                    {symptomTags && symptomTags.length > 0 ? (
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        {symptomTags.map((tag, i) => (
                          <span
                            key={i}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 20,
                              background: "rgba(255,140,66,0.12)",
                              border: `1px solid ${ORANGE}44`,
                              color: ORANGE,
                              fontFamily: MONO,
                              fontSize: 9,
                              letterSpacing: "0.06em",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* 5. AVOID TODAY CARD */}
            {avoid.length > 0 ? (
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${RED}`,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: RED,
                    letterSpacing: "0.14em",
                    marginBottom: 16,
                  }}
                >
                  AVOID TODAY
                </p>
                {avoid.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      marginBottom: i < avoid.length - 1 ? 14 : 0,
                      paddingBottom: i < avoid.length - 1 ? 14 : 0,
                      borderBottom:
                        i < avoid.length - 1
                          ? `1px solid ${BORDER}`
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: `${RED}22`,
                        border: `1px solid ${RED}55`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <span
                        style={{ color: RED, fontSize: 10, fontWeight: 700 }}
                      >
                        ✕
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#e8e8f0",
                          marginBottom: 2,
                        }}
                      >
                        {item.item}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#666",
                          marginBottom: item.duration ? 3 : 0,
                        }}
                      >
                        {item.reason}
                      </div>
                      {item.duration ? (
                        <div
                          style={{
                            fontFamily: MONO,
                            fontSize: 10,
                            color: "#555",
                          }}
                        >
                          {item.duration}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* 6. ADD TO DIET TODAY CARD */}
            {diet.length > 0 ? (
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${GREEN}`,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: GREEN,
                    letterSpacing: "0.14em",
                    marginBottom: 16,
                  }}
                >
                  EAT TODAY
                </p>
                {diet.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      marginBottom: i < diet.length - 1 ? 14 : 0,
                      paddingBottom: i < diet.length - 1 ? 14 : 0,
                      borderBottom:
                        i < diet.length - 1
                          ? `1px solid ${BORDER}`
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: `${GREEN}22`,
                        border: `1px solid ${GREEN}55`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <span
                        style={{
                          color: GREEN,
                          fontSize: 13,
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
                      >
                        +
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#e8e8f0",
                          marginBottom: 2,
                        }}
                      >
                        {item.item}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#666",
                          marginBottom: item.timing ? 3 : 0,
                        }}
                      >
                        {item.reason}
                      </div>
                      {item.timing ? (
                        <div
                          style={{
                            fontFamily: MONO,
                            fontSize: 10,
                            color: GREEN,
                          }}
                        >
                          {item.timing}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* 7. WATCH FOR TODAY */}
            {watchFor && watchFor.length > 0 ? (
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: ORANGE,
                    letterSpacing: "0.14em",
                    marginBottom: 14,
                  }}
                >
                  WATCH FOR
                </p>
                {watchFor.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      marginBottom: i < watchFor.length - 1 ? 10 : 0,
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#c8c8d8",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {w}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* 8. PATTERNS DETECTED */}
            {patterns.length > 0 ? (
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: "#555",
                    letterSpacing: "0.14em",
                    marginBottom: 12,
                  }}
                >
                  PATTERNS
                </p>
                {patterns.map((pat, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: 12,
                      color: "#666",
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    · {pat}
                  </p>
                ))}
              </div>
            ) : null}

            {/* 9. 7-DAY GUT SCORE CHART */}
            {chartData.length > 0 ? (
              <div
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: "#555",
                    letterSpacing: "0.14em",
                    marginBottom: 14,
                  }}
                >
                  7-DAY TREND
                </p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={chartData} barCategoryGap="20%">
                    <XAxis
                      dataKey="day"
                      tick={{
                        fontFamily: MONO,
                        fontSize: 9,
                        fill: "#444",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1a1a28",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        fontFamily: MONO,
                        fontSize: 11,
                        color: "#d0d0e0",
                      }}
                      itemStyle={{ color: GREEN }}
                      cursor={{ fill: "rgba(126,184,164,0.05)" }}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isYesterday ? GREEN : "#2a2a3a"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </>
        )}
      </div>

      <NavBar />
    </div>
  );
}
