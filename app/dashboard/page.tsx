"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import type {
  MealLog,
  WeightEntry,
  OuraMetrics,
  DailyInsight,
  Supplement,
  SupplementLog,
} from "@/lib/supabase";
import { calculateGutScore } from "@/lib/gutScore";
import { isSessionExpired, refreshActivity } from "@/lib/crypto";
import { useFeedbackModal } from "@/contexts/FeedbackModalContext";
import NavBar from "@/components/NavBar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMountainHour(): number {
  return parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Denver",
      hour: "numeric",
      hour12: false,
    }),
    10
  );
}

function getGreeting(): string {
  const h = getMountainHour();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getMountainDateRange(): { start: string; end: string } {
  const now = new Date();
  const mtn = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Denver" })
  );
  const y = mtn.getFullYear();
  const m = String(mtn.getMonth() + 1).padStart(2, "0");
  const d = String(mtn.getDate()).padStart(2, "0");
  return {
    start: `${y}-${m}-${d}T00:00:00`,
    end: `${y}-${m}-${d}T23:59:59`,
  };
}

function getTodayMountain(): string {
  const now = new Date();
  const mtn = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Denver" })
  );
  const y = mtn.getFullYear();
  const m = String(mtn.getMonth() + 1).padStart(2, "0");
  const d = String(mtn.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayMountain(): string {
  const now = new Date();
  const mtn = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Denver" })
  );
  mtn.setDate(mtn.getDate() - 1);
  const y = mtn.getFullYear();
  const m = String(mtn.getMonth() + 1).padStart(2, "0");
  const d = String(mtn.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff === 1) return "1 min ago";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  return h === 1 ? "1 hr ago" : `${h} hrs ago`;
}

function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function flareRiskColor(level: string | null): string {
  if (!level) return "#7EB8A4";
  const l = level.toLowerCase();
  if (l === "low") return "#7EB8A4";
  if (l === "moderate") return "#FF8C42";
  if (l === "high") return "#FF6B6B";
  if (l === "critical") return "#8B0000";
  return "#7EB8A4";
}

function feelingEmoji(feeling: string | null): string {
  switch (feeling) {
    case "Great": return "😊";
    case "Good": return "🙂";
    case "Okay": return "😐";
    case "Bad": return "😣";
    case "Awful": return "🤢";
    default: return "—";
  }
}

function mealTypeBadgeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case "breakfast": return "#FFD93D";
    case "lunch": return "#7EB8A4";
    case "dinner": return "#A8B4FF";
    case "snack": return "#FF8C42";
    default: return "#4ECDC4";
  }
}

function withSign(n: number | null): string {
  if (n === null) return "—";
  return n >= 0 ? `+${n}` : `${n}`;
}

function toFixed1(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        background: "#15151f",
        borderRadius: 18,
        border: "1px solid #1e1e2e",
        height,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

interface OuraCardProps {
  label: string;
  value: string | number | null;
  unit: string;
  color: string;
  prefix?: string;
}

function OuraCard({ label, value, unit, color, prefix = "" }: OuraCardProps) {
  const display =
    value === null || value === undefined
      ? "—"
      : `${prefix}${typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}`;

  return (
    <div
      style={{
        background: "#15151f",
        borderRadius: 14,
        border: "1px solid #1e1e2e",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: "SF Mono, ui-monospace, monospace",
          fontSize: 8,
          letterSpacing: "0.08em",
          color: "#555",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "SF Mono, ui-monospace, monospace",
          fontSize: 22,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {display}
      </span>
      <span
        style={{
          fontFamily: "SF Mono, ui-monospace, monospace",
          fontSize: 9,
          color: "#444",
        }}
      >
        {unit}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const { openFeedbackModal } = useFeedbackModal();

  // Data state
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [oura, setOura] = useState<OuraMetrics | null>(null);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [supplementLogs, setSupplementLogs] = useState<SupplementLog[]>([]);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [ouraLastSync, setOuraLastSync] = useState<string | null>(null);

  // Pull-to-refresh state
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Session guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pin = sessionStorage.getItem("gut_pin");
    if (!pin || isSessionExpired()) {
      router.replace("/pin");
      return;
    }
    refreshActivity();

    const interval = setInterval(() => {
      if (isSessionExpired()) {
        router.replace("/pin");
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  // ---------------------------------------------------------------------------
  // Refresh activity on any interaction
  // ---------------------------------------------------------------------------
  const handleInteraction = useCallback(() => {
    if (typeof window !== "undefined") refreshActivity();
  }, []);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const today = getTodayMountain();
    const yesterday = getYesterdayMountain();
    const { start, end } = getMountainDateRange();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/pin");
      return;
    }

    const unit = (user.user_metadata?.weight_unit as "kg" | "lbs") ?? "kg";
    setWeightUnit(unit);
    setOuraLastSync((user.user_metadata?.oura_last_sync as string) ?? null);

    const [
      mealsRes,
      ouraTodayRes,
      ouraYestRes,
      insightRes,
      weightsRes,
      suppsRes,
      suppLogsRes,
      feedbackRes,
    ] = await Promise.all([
      supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("timestamp", start)
        .lte("timestamp", end)
        .order("timestamp", { ascending: false }),

      supabase
        .from("oura_metrics")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),

      supabase
        .from("oura_metrics")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", yesterday)
        .maybeSingle(),

      supabase
        .from("daily_insights")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", yesterday)
        .eq("window_type", "daily")
        .maybeSingle(),

      supabase
        .from("weight_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(7),

      supabase
        .from("supplements")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true),

      supabase
        .from("supplement_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today),

      supabase
        .from("daily_feedback")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);

    // Merge oura: yesterday has readiness/sleep/HRV (computed after sleep);
    // today may have real-time activity/stress. Today's non-null values win.
    const mergedOura = (() => {
      const yest = ouraYestRes.data as OuraMetrics | null
      const tod = ouraTodayRes.data as OuraMetrics | null
      if (!yest && !tod) return null
      if (!yest) return tod
      if (!tod) return yest
      const merged = { ...yest }
      for (const key of Object.keys(tod) as (keyof OuraMetrics)[]) {
        if (tod[key] !== null && tod[key] !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (merged as any)[key] = tod[key]
        }
      }
      return merged
    })()

    setMeals((mealsRes.data as MealLog[]) ?? []);
    setOura(mergedOura);
    setInsight((insightRes.data as DailyInsight) ?? null);
    setWeights((weightsRes.data as WeightEntry[]) ?? []);
    setSupplements((suppsRes.data as Supplement[]) ?? []);
    setSupplementLogs((suppLogsRes.data as SupplementLog[]) ?? []);
    setHasFeedback(!!feedbackRes.data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Pull-to-refresh
  // ---------------------------------------------------------------------------
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
    handleInteraction();
  }, [handleInteraction]);

  const handleTouchEnd = useCallback(
    async (e: React.TouchEvent) => {
      handleInteraction();
      if (touchStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      touchStartY.current = null;
      if (deltaY > 80) {
        setSyncing(true);
        try {
          await fetch("/api/oura/sync", { method: "POST" });
        } catch {
          // ignore sync errors
        }
        await loadData();
        setSyncing(false);
      }
    },
    [handleInteraction, loadData]
  );

  // ---------------------------------------------------------------------------
  // Manual sync
  // ---------------------------------------------------------------------------
  const handleManualSync = useCallback(async () => {
    handleInteraction();
    setSyncing(true);
    try {
      const res = await fetch("/api/oura/sync", { method: "POST" });
      const data = await res.json() as { synced_at?: string };
      if (data.synced_at) setOuraLastSync(data.synced_at);
    } catch {
      // ignore
    }
    await loadData();
    setSyncing(false);
  }, [handleInteraction, loadData]);

  // ---------------------------------------------------------------------------
  // Supplement toggle
  // ---------------------------------------------------------------------------
  const toggleSupplement = useCallback(
    async (supp: Supplement) => {
      handleInteraction();
      const today = getTodayMountain();
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const alreadyTaken = supplementLogs.some(
        (l) => l.supplement_id === supp.id
      );

      if (alreadyTaken) {
        // Remove the log
        await supabase
          .from("supplement_logs")
          .delete()
          .eq("user_id", user.id)
          .eq("supplement_id", supp.id)
          .eq("date", today);

        setSupplementLogs((prev) =>
          prev.filter((l) => l.supplement_id !== supp.id)
        );
      } else {
        // Insert log
        const { data } = await supabase
          .from("supplement_logs")
          .insert({
            user_id: user.id,
            supplement_id: supp.id,
            taken_at: new Date().toISOString(),
            date: today,
          })
          .select()
          .single();

        if (data) {
          setSupplementLogs((prev) => [...prev, data as SupplementLog]);
        }
      }
    },
    [supplementLogs, handleInteraction]
  );

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const gutScore = calculateGutScore(meals, oura);

  const gutScoreLabel = (): string => {
    if (gutScore >= 80) return "Optimal";
    if (gutScore >= 65) return "Good";
    if (gutScore >= 50) return "Fair";
    if (gutScore >= 35) return "Poor";
    return "Critical";
  };

  const gutScoreColor = (): string => {
    if (gutScore >= 80) return "#7EB8A4";
    if (gutScore >= 65) return "#FFD93D";
    if (gutScore >= 50) return "#FF8C42";
    return "#FF6B6B";
  };

  const recentMeals = meals.slice(0, 3);

  const toDisplayWeight = (kg: number | null) => {
    if (kg === null) return null;
    return weightUnit === "lbs" ? parseFloat((kg * 2.20462).toFixed(1)) : parseFloat(kg.toFixed(1));
  };

  const weightChartData = [...weights]
    .reverse()
    .map((w) => ({
      date: w.date.slice(5), // "MM-DD"
      weight: toDisplayWeight(w.weight_kg),
    }));

  const currentWeight = toDisplayWeight(weights[0]?.weight_kg ?? null);
  const oldestWeight = toDisplayWeight(weights[weights.length - 1]?.weight_kg ?? null);
  const weightDelta =
    currentWeight !== null && oldestWeight !== null
      ? parseFloat((currentWeight - oldestWeight).toFixed(1))
      : null;
  const avgWeight =
    weights.length > 0
      ? parseFloat(
          (
            weights.reduce((s, w) => s + (toDisplayWeight(w.weight_kg) ?? 0), 0) /
            weights.length
          ).toFixed(1)
        )
      : null;

  // Group supplements by time_of_day
  const suppGroups = supplements.reduce<Record<string, Supplement[]>>(
    (acc, s) => {
      const key = s.time_of_day ?? "Anytime";
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    },
    {}
  );

  const takenCount = supplementLogs.length;
  const totalCount = supplements.length;

  const topAvoid = (() => {
    if (!insight?.avoid) return null;
    const arr = Array.isArray(insight.avoid)
      ? insight.avoid
      : Object.values(insight.avoid);
    if (arr.length === 0) return null;
    const item = arr[0] as { label?: string } | string;
    return typeof item === "object" && item?.label ? item.label : String(item);
  })();

  const topAdd = (() => {
    if (!insight?.add_to_diet) return null;
    const arr = Array.isArray(insight.add_to_diet)
      ? insight.add_to_diet
      : Object.values(insight.add_to_diet);
    if (arr.length === 0) return null;
    const item = arr[0] as { label?: string } | string;
    return typeof item === "object" && item?.label ? item.label : String(item);
  })();

  const showRateButton = !!(insight?.prediction && !hasFeedback);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  const cardStyle: React.CSSProperties = {
    background: "#15151f",
    borderRadius: 18,
    border: "1px solid #1e1e2e",
    padding: "16px",
    marginBottom: 12,
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontFamily: "Georgia, serif",
    fontSize: 15,
    fontWeight: 600,
    color: "#e0e0e0",
    marginBottom: 12,
  };

  const monoSmall: React.CSSProperties = {
    fontFamily: "SF Mono, ui-monospace, monospace",
    fontSize: 10,
    color: "#666",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      onClick={handleInteraction}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        minHeight: "100dvh",
        background: "#0A0A0F",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        paddingBottom: 90,
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          maxWidth: 430,
          margin: "0 auto",
          padding: "0 16px",
        }}
      >
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                               */}
        {/* ------------------------------------------------------------------ */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 56,
            paddingBottom: 8,
          }}
        >
          <div>
            {syncing && (
              <p style={{ ...monoSmall, color: "#7EB8A4", marginBottom: 2 }}>
                ↻ syncing…
              </p>
            )}
            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 26,
                fontWeight: 700,
                color: "#f0f0f0",
                margin: 0,
              }}
            >
              {getGreeting()}
            </h1>
            <p style={{ ...monoSmall, marginTop: 2 }}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "America/Denver",
              })}
            </p>
          </div>
          <Link href="/settings" onClick={handleInteraction}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "#15151f",
                border: "1px solid #1e1e2e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#666"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
          </Link>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Pull-to-refresh hint                                                 */}
        {/* ------------------------------------------------------------------ */}
        <p
          style={{
            ...monoSmall,
            textAlign: "center",
            marginBottom: 8,
            fontSize: 9,
            color: "#333",
          }}
        >
          pull down to sync
        </p>

        {loading ? (
          /* ---------------------------------------------------------------- */
          /* Loading skeleton                                                  */
          /* ---------------------------------------------------------------- */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SkeletonCard height={90} />
            <SkeletonCard height={130} />
            <SkeletonCard height={200} />
            <SkeletonCard height={150} />
            <SkeletonCard height={180} />
            <SkeletonCard height={140} />
          </div>
        ) : (
          <>
            {/* -------------------------------------------------------------- */}
            {/* Insight preview card                                             */}
            {/* -------------------------------------------------------------- */}
            {insight && (
              <Link href="/insights" onClick={handleInteraction} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    ...cardStyle,
                    borderColor: flareRiskColor(insight.flare_risk_level) + "44",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <span style={sectionHeadingStyle}>Today&rsquo;s Insight</span>
                    <span
                      style={{
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 10,
                        fontWeight: 700,
                        color: flareRiskColor(insight.flare_risk_level),
                        background:
                          flareRiskColor(insight.flare_risk_level) + "22",
                        borderRadius: 8,
                        padding: "3px 10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {insight.flare_risk_level ?? "Unknown"} Risk
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {topAvoid && (
                      <div
                        style={{
                          flex: 1,
                          background: "#FF6B6B18",
                          borderRadius: 10,
                          padding: "8px 10px",
                          border: "1px solid #FF6B6B33",
                        }}
                      >
                        <p style={{ ...monoSmall, color: "#FF6B6B", marginBottom: 4 }}>
                          avoid
                        </p>
                        <p
                          style={{
                            fontFamily: "Georgia, serif",
                            fontSize: 12,
                            color: "#e0e0e0",
                            margin: 0,
                          }}
                        >
                          {topAvoid}
                        </p>
                      </div>
                    )}
                    {topAdd && (
                      <div
                        style={{
                          flex: 1,
                          background: "#7EB8A418",
                          borderRadius: 10,
                          padding: "8px 10px",
                          border: "1px solid #7EB8A433",
                        }}
                      >
                        <p style={{ ...monoSmall, color: "#7EB8A4", marginBottom: 4 }}>
                          add
                        </p>
                        <p
                          style={{
                            fontFamily: "Georgia, serif",
                            fontSize: 12,
                            color: "#e0e0e0",
                            margin: 0,
                          }}
                        >
                          {topAdd}
                        </p>
                      </div>
                    )}
                  </div>

                  <p
                    style={{
                      ...monoSmall,
                      textAlign: "right",
                      marginTop: 10,
                      color: "#7EB8A4",
                      fontSize: 9,
                    }}
                  >
                    tap for full insight →
                  </p>
                </div>
              </Link>
            )}

            {/* -------------------------------------------------------------- */}
            {/* Gut Score card                                                   */}
            {/* -------------------------------------------------------------- */}
            <div
              style={{
                ...cardStyle,
                background: "linear-gradient(135deg, #1a2a24 0%, #15151f 100%)",
                borderColor: "#7EB8A433",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p style={{ ...monoSmall, marginBottom: 4 }}>gut score</p>
                  <span
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 64,
                      fontWeight: 700,
                      color: gutScoreColor(),
                      lineHeight: 1,
                    }}
                  >
                    {gutScore}
                  </span>
                  <p
                    style={{
                      fontFamily: "SF Mono, ui-monospace, monospace",
                      fontSize: 12,
                      color: gutScoreColor(),
                      marginTop: 4,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {gutScoreLabel()}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ ...monoSmall, marginBottom: 6 }}>today</p>
                  <p style={{ ...monoSmall, marginBottom: 2 }}>
                    {meals.length} meal{meals.length !== 1 ? "s" : ""} logged
                  </p>
                  {oura && (
                    <p style={{ ...monoSmall }}>
                      readiness {oura.readiness_score ?? "—"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Oura Ring section                                                */}
            {/* -------------------------------------------------------------- */}
            <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span style={sectionHeadingStyle}>Oura Ring</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {ouraLastSync && (
                    <span style={{ ...monoSmall, fontSize: 9 }}>
                      {minutesAgo(ouraLastSync)}
                    </span>
                  )}
                  <button
                    onClick={handleManualSync}
                    disabled={syncing}
                    style={{
                      fontFamily: "SF Mono, ui-monospace, monospace",
                      fontSize: 9,
                      color: syncing ? "#444" : "#7EB8A4",
                      background: "transparent",
                      border: "1px solid " + (syncing ? "#333" : "#7EB8A444"),
                      borderRadius: 8,
                      padding: "4px 10px",
                      cursor: syncing ? "default" : "pointer",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {syncing ? (
                      <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>
                        ↻
                      </span>
                    ) : (
                      "sync"
                    )}
                  </button>
                </div>
              </div>

              {oura ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <OuraCard
                    label="Readiness"
                    value={oura.readiness_score}
                    unit="/ 100"
                    color="#7EB8A4"
                  />
                  <OuraCard
                    label="Sleep"
                    value={oura.sleep_score}
                    unit="/ 100"
                    color="#A8B4FF"
                  />
                  <OuraCard
                    label="HRV Balance"
                    value={oura.hrv_balance !== null ? Math.round(oura.hrv_balance) : null}
                    unit="ms"
                    color="#FFD93D"
                    prefix={oura.hrv_balance !== null && oura.hrv_balance >= 0 ? "+" : ""}
                  />
                  <OuraCard
                    label="Resting HR"
                    value={oura.resting_heart_rate}
                    unit="bpm"
                    color="#FF8C42"
                  />
                  <OuraCard
                    label="Steps"
                    value={oura.steps !== null ? oura.steps.toLocaleString() : null}
                    unit="steps"
                    color="#FFD93D"
                  />
                  <OuraCard
                    label="Active Cal"
                    value={oura.active_calories}
                    unit="kcal"
                    color="#C8A4FF"
                  />
                  <OuraCard
                    label="Stress High"
                    value={oura.stress_high_minutes}
                    unit="min"
                    color="#FF6B6B"
                  />
                  <OuraCard
                    label="Body Temp"
                    value={oura.body_temperature_deviation !== null
                      ? parseFloat(oura.body_temperature_deviation.toFixed(2))
                      : null}
                    unit="°C dev"
                    color="#4ECDC4"
                    prefix={
                      oura.body_temperature_deviation !== null &&
                      oura.body_temperature_deviation >= 0
                        ? "+"
                        : ""
                    }
                  />
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px 0",
                    color: "#444",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "SF Mono, ui-monospace, monospace",
                      fontSize: 11,
                    }}
                  >
                    No Oura data for today
                  </p>
                  <p style={{ ...monoSmall, marginTop: 4, fontSize: 9 }}>
                    tap sync to fetch latest
                  </p>
                </div>
              )}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Weight section                                                   */}
            {/* -------------------------------------------------------------- */}
            {weights.length > 0 && (
              <div style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={sectionHeadingStyle}>Weight</span>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#FFD93D",
                      }}
                    >
                      {currentWeight !== null ? `${currentWeight} ${weightUnit}` : "—"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <p style={{ ...monoSmall, marginBottom: 2 }}>7-day avg</p>
                    <p
                      style={{
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 13,
                        color: "#e0e0e0",
                      }}
                    >
                      {avgWeight !== null ? `${avgWeight} ${weightUnit}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ ...monoSmall, marginBottom: 2 }}>7-day change</p>
                    <p
                      style={{
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 13,
                        color:
                          weightDelta === null
                            ? "#666"
                            : weightDelta > 0
                            ? "#FF6B6B"
                            : weightDelta < 0
                            ? "#7EB8A4"
                            : "#666",
                      }}
                    >
                      {weightDelta !== null
                        ? `${weightDelta > 0 ? "+" : ""}${weightDelta} ${weightUnit}`
                        : "—"}
                    </p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={80}>
                  <LineChart
                    data={weightChartData}
                    margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 8,
                        fill: "#444",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e1e2e",
                        border: "1px solid #2e2e3e",
                        borderRadius: 8,
                        fontFamily: "SF Mono, ui-monospace, monospace",
                        fontSize: 10,
                        color: "#e0e0e0",
                      }}
                      itemStyle={{ color: "#FFD93D" }}
                      formatter={(value: number) => [`${value} ${weightUnit}`, "weight"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#FFD93D"
                      strokeWidth={2}
                      dot={{ fill: "#FFD93D", r: 3, strokeWidth: 0 }}
                      activeDot={{ fill: "#FFD93D", r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* Recent meals                                                     */}
            {/* -------------------------------------------------------------- */}
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

            {/* -------------------------------------------------------------- */}
            {/* Today supplements                                                */}
            {/* -------------------------------------------------------------- */}
            {supplements.length > 0 && (
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
            )}

            {/* -------------------------------------------------------------- */}
            {/* Rate Today button                                                */}
            {/* -------------------------------------------------------------- */}
            {showRateButton && (
              <button
                onClick={() => {
                  handleInteraction();
                  openFeedbackModal();
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #7EB8A4 0%, #4ECDC4 100%)",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: 12,
                  fontFamily: "SF Mono, ui-monospace, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0A0A0F",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Rate Today
              </button>
            )}
          </>
        )}
      </div>

      <NavBar />
    </div>
  );
}
