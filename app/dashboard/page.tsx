"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

// New Components
import SkeletonCard from "@/components/dashboard/SkeletonCard";
import InsightPreview from "@/components/dashboard/InsightPreview";
import GutScoreCard from "@/components/dashboard/GutScoreCard";
import OuraRingSection from "@/components/dashboard/OuraRingSection";
import WeightSection from "@/components/dashboard/WeightSection";
import MealsSection from "@/components/dashboard/MealsSection";
import SupplementsSection from "@/components/dashboard/SupplementsSection";

// Helpers
import { getMtnDate, getMtnDateTimeRange } from "@/lib/dates";
import { getGreeting, monoSmall } from "@/lib/dashboard-helpers";

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

  const handleInteraction = useCallback(() => {
    if (typeof window !== "undefined") refreshActivity();
  }, []);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const today = getMtnDate(0);
    const yesterday = getMtnDate(-1);
    const { start, end } = getMtnDateTimeRange();

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

    const mergedOura = (() => {
      const yest = ouraYestRes.data as OuraMetrics | null;
      const tod = ouraTodayRes.data as OuraMetrics | null;
      if (!yest && !tod) return null;
      if (!yest) return tod;
      if (!tod) return yest;
      const merged = { ...yest };
      for (const key of Object.keys(tod) as (keyof OuraMetrics)[]) {
        if (tod[key] !== null && tod[key] !== undefined) {
          (merged as Record<string, unknown>)[key] = tod[key];
        }
      }
      return merged;
    })();

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
  // Handlers
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
          // ignore
        }
        await loadData();
        setSyncing(false);
      }
    },
    [handleInteraction, loadData]
  );

  const handleManualSync = useCallback(async () => {
    handleInteraction();
    setSyncing(true);
    try {
      const res = await fetch("/api/oura/sync", { method: "POST" });
      const data = (await res.json()) as { synced_at?: string };
      if (data.synced_at) setOuraLastSync(data.synced_at);
    } catch {
      // ignore
    }
    await loadData();
    setSyncing(false);
  }, [handleInteraction, loadData]);

  const toggleSupplement = useCallback(
    async (supp: Supplement) => {
      handleInteraction();
      const today = getMtnDate(0);
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const alreadyTaken = supplementLogs.some((l) => l.supplement_id === supp.id);

      if (alreadyTaken) {
        await supabase
          .from("supplement_logs")
          .delete()
          .eq("user_id", user.id)
          .eq("supplement_id", supp.id)
          .eq("date", today);

        setSupplementLogs((prev) => prev.filter((l) => l.supplement_id !== supp.id));
      } else {
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
  // Derived
  // ---------------------------------------------------------------------------
  const gutScore = calculateGutScore(meals, oura);
  const showRateButton = !!(insight?.prediction && !hasFeedback);

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
        {/* Header */}
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
            {insight && (
              <InsightPreview insight={insight} handleInteraction={handleInteraction} />
            )}

            <GutScoreCard gutScore={gutScore} meals={meals} oura={oura} />

            <OuraRingSection 
              oura={oura} 
              ouraLastSync={ouraLastSync} 
              syncing={syncing} 
              handleManualSync={handleManualSync} 
            />

            <WeightSection weights={weights} weightUnit={weightUnit} />

            <MealsSection meals={meals} handleInteraction={handleInteraction} />

            <SupplementsSection 
              supplements={supplements} 
              supplementLogs={supplementLogs} 
              toggleSupplement={toggleSupplement} 
            />

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
