"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

import { calculateGutScore } from "@/lib/gutScore";
import { useFeedbackModal } from "@/contexts/FeedbackModalContext";
import NavBar from "@/src/shared/components/NavBar";
import { Supplement } from "@/src/core/entities/Supplement";

// New Components
import SkeletonCard from "@/src/features/dashboard/components/SkeletonCard";
import InsightPreview from "@/src/features/dashboard/components/InsightPreview";
import GutScoreCard from "@/src/features/dashboard/components/GutScoreCard";
import OuraRingSection from "@/src/features/dashboard/components/OuraRingSection";
import WeightSection from "@/src/features/dashboard/components/WeightSection";
import MealsSection from "@/src/features/dashboard/components/MealsSection";
import SupplementsSection from "@/src/features/dashboard/components/SupplementsSection";

// Hooks
import { useDashboardData } from "@/src/features/dashboard/hooks/useDashboardData";
import { useSessionGuard } from "@/src/features/auth/hooks/useSessionGuard";

// Helpers
import { getGreeting, monoSmall } from "@/lib/dashboard-helpers";
import { getMtnDate } from "@/lib/dates";

export default function DashboardPage() {
  const { openFeedbackModal } = useFeedbackModal();
  const { handleInteraction, checkSession } = useSessionGuard();
  const {
    meals,
    oura,
    insight,
    weights,
    supplements,
    supplementLogs,
    hasFeedback,
    loading,
    weightUnit,
    ouraLastSync,
    setOuraLastSync,
    refresh
  } = useDashboardData();

  const [syncing, setSyncing] = useState(false);

  // Pull-to-refresh state
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Session guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!checkSession()) return;
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, [checkSession]);

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
        await refresh();
        setSyncing(false);
      }
    },
    [handleInteraction, refresh]
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
    await refresh();
    setSyncing(false);
  }, [handleInteraction, refresh, setOuraLastSync]);

  const toggleSupplement = useCallback(
    async (supp: Supplement) => {
      handleInteraction();
      // This part still needs refactoring to a use-case or better repo call, 
      // but for now keeping it simple to just get the page working with the new structure.
      // Ideally this goes into a useSupplement mutation hook.
      const today = getMtnDate(0);
      const { createSupabaseBrowserClient } = await import("@/lib/supabase");
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const alreadyTaken = supplementLogs.some((l) => l.supplement_id === supp.id);

      if (alreadyTaken) {
        await supabase
          .from("supplement_logs")
          .delete()
          .eq("user_id", user.id)
          .eq("supplement_id", supp.id)
          .eq("date", today);
      } else {
        await supabase
          .from("supplement_logs")
          .insert({
            user_id: user.id,
            supplement_id: supp.id,
            taken_at: new Date().toISOString(),
            date: today,
          });
      }
      refresh();
    },
    [supplementLogs, handleInteraction, refresh]
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
