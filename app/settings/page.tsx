"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  getPinFromSession,
  isSessionExpired,
  refreshActivity,
  clearSession,
} from "@/lib/crypto";

// ─── Design tokens ───────────────────────────────────────────────────────────

const BG = "#0A0A0F";
const CARD = "#15151f";
const BORDER = "#1e1e2e";
const GREEN = "#7EB8A4";
const RED = "#FF6B6B";
const MONO: React.CSSProperties = {
  fontFamily: "SF Mono, ui-monospace, monospace",
};

// ─── Small components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...MONO,
        fontSize: 9,
        color: "#555",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 8,
        marginTop: 24,
        paddingLeft: 2,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${danger ? RED : BORDER}`,
        borderRadius: 18,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...MONO,
        fontSize: 9,
        color: "#555",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function MaskedInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: BG,
          color: "#e8e8f0",
          fontSize: 13,
          outline: "none",
          fontFamily: "system-ui, sans-serif",
        }}
      />
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: BG,
          color: "#666",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {revealed ? "🙈" : "👁"}
      </button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: checked ? GREEN : BORDER,
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          display: "block",
        }}
      />
    </button>
  );
}

function ActionButton({
  onClick,
  children,
  variant = "default",
  fullWidth,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "green" | "danger" | "ghost";
  fullWidth?: boolean;
  disabled?: boolean;
}) {
  const colors = {
    default: { bg: BORDER, color: "#e8e8f0", border: BORDER },
    green: { bg: GREEN, color: "#0A0A0F", border: GREEN },
    danger: { bg: `${RED}18`, color: RED, border: RED },
    ghost: { bg: "transparent", color: "#666", border: BORDER },
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "11px 18px",
        borderRadius: 12,
        border: `1px solid ${c.border}`,
        background: disabled ? "#222" : c.bg,
        color: disabled ? "#555" : c.color,
        ...MONO,
        fontSize: 11,
        letterSpacing: "0.06em",
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : undefined,
        textAlign: "center",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function DataRow({
  label,
  count,
}: {
  label: string;
  count: number | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 0",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <span style={{ color: "#888", fontSize: 13 }}>{label}</span>
      <span style={{ ...MONO, fontSize: 14, color: GREEN, fontWeight: 600 }}>
        {count === null ? "—" : count}
      </span>
    </div>
  );
}

// ─── Delete confirmation overlay ──────────────────────────────────────────────

function DeleteConfirmOverlay({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#12121a",
          border: `1px solid ${RED}`,
          borderRadius: 20,
          padding: 24,
          width: "100%",
          maxWidth: 360,
        }}
      >
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 18,
            color: RED,
            marginBottom: 12,
          }}
        >
          Delete All Data
        </div>
        <p style={{ color: "#888", fontSize: 13, lineHeight: 1.5, margin: "0 0 20px" }}>
          This will permanently delete all your meals, supplements, lab results,
          insights, and account data. This cannot be undone.
        </p>
        <div
          style={{
            ...MONO,
            fontSize: 10,
            color: "#555",
            letterSpacing: "0.1em",
            marginBottom: 8,
          }}
        >
          TYPE "DELETE" TO CONFIRM
        </div>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${confirmText === "DELETE" ? RED : BORDER}`,
            background: BG,
            color: RED,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 16,
            fontFamily: "system-ui, sans-serif",
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: CARD,
              color: "#888",
              ...MONO,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmText !== "DELETE"}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: `1px solid ${RED}`,
              background: confirmText === "DELETE" ? RED : "#333",
              color: confirmText === "DELETE" ? "#fff" : "#555",
              ...MONO,
              fontSize: 11,
              cursor: confirmText === "DELETE" ? "pointer" : "not-allowed",
              fontWeight: 700,
              transition: "all 0.2s",
            }}
          >
            DELETE ALL
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Oura
  const [ouraToken, setOuraToken] = useState("");
  const [ouraConnected, setOuraConnected] = useState(false);
  const [ouraLastSync, setOuraLastSync] = useState<string | null>(null);
  const [ouraSaving, setOuraSaving] = useState(false);
  const [ouraTestResult, setOuraTestResult] = useState<string | null>(null);

  // Claude AI
  const [claudeKey, setClaudeKey] = useState("");
  const [claudeSaving, setClaudeSaving] = useState(false);

  // Notifications
  const [mealReminders, setMealReminders] = useState(false);
  const [breakfastTime, setBreakfastTime] = useState("08:00");
  const [lunchTime, setLunchTime] = useState("12:30");
  const [dinnerTime, setDinnerTime] = useState("19:00");
  const [feedbackReminder, setFeedbackReminder] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  // Account
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");

  // Health profile
  const [age, setAge] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Data stats
  const [stats, setStats] = useState<Record<string, number | null>>({
    meals: null,
    supplements: null,
    labs: null,
    insights: null,
    feedback: null,
  });

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Session guard ──
  useEffect(() => {
    const pin = getPinFromSession();
    if (!pin || isSessionExpired()) {
      router.replace("/pin");
      return;
    }
    loadUserData();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      return;
    }
    const meta = user.user_metadata ?? {};
    setOuraConnected(!!meta.oura_connected);
    setOuraLastSync(meta.oura_last_sync ?? null);
    setClaudeKey(meta.claude_api_key ?? "");
    setMealReminders(!!meta.meal_reminders);
    setBreakfastTime(meta.breakfast_time ?? "08:00");
    setLunchTime(meta.lunch_time ?? "12:30");
    setDinnerTime(meta.dinner_time ?? "19:00");
    setFeedbackReminder(!!meta.feedback_reminder);
    setWeightUnit(meta.weight_unit === "kg" ? "kg" : "lbs");
    setAge(meta.age ?? "");
    setEthnicity(meta.ethnicity ?? "");
    if (meta.height_cm) {
      const totalIn = Math.round(meta.height_cm / 2.54);
      setHeightFt(String(Math.floor(totalIn / 12)));
      setHeightIn(String(totalIn % 12));
    }
  }

  async function loadStats() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const uid = user.id;

    const [meals, supplements, labs, insights, feedback] = await Promise.all([
      supabase
        .from("meal_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabase
        .from("supplements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("active", true),
      supabase
        .from("lab_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabase
        .from("daily_insights")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabase
        .from("daily_feedback")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
    ]);

    setStats({
      meals: meals.count ?? 0,
      supplements: supplements.count ?? 0,
      labs: labs.count ?? 0,
      insights: insights.count ?? 0,
      feedback: feedback.count ?? 0,
    });
  }

  // ── Oura ──

  async function saveOuraToken() {
    if (!ouraToken.trim()) return;
    setOuraSaving(true);
    refreshActivity();
    try {
      const res = await fetch("/api/oura/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ouraToken }),
      });
      if (res.ok) {
        setOuraConnected(true);
      }
    } finally {
      setOuraSaving(false);
    }
  }

  async function testOuraConnection() {
    setOuraTestResult(null);
    refreshActivity();
    try {
      const res = await fetch("/api/oura/sync", { method: "POST" });
      if (res.ok) {
        setOuraTestResult("Connection successful");
        setOuraLastSync(new Date().toISOString());
      } else {
        setOuraTestResult("Connection failed");
      }
    } catch {
      setOuraTestResult("Connection failed");
    }
  }

  // ── Claude AI ──

  async function saveClaudeKey() {
    if (!claudeKey.trim()) return;
    setClaudeSaving(true);
    refreshActivity();
    await supabase.auth.updateUser({
      data: { claude_api_key: claudeKey.trim() },
    });
    setClaudeSaving(false);
  }

  // ── Notifications ──

  async function saveNotifications() {
    setNotifSaving(true);
    refreshActivity();
    await supabase.auth.updateUser({
      data: {
        meal_reminders: mealReminders,
        breakfast_time: breakfastTime,
        lunch_time: lunchTime,
        dinner_time: dinnerTime,
        feedback_reminder: feedbackReminder,
      },
    });
    setNotifSaving(false);
  }

  // ── Weight unit ──

  async function saveWeightUnit(unit: "lbs" | "kg") {
    setWeightUnit(unit);
    refreshActivity();
    await supabase.auth.updateUser({ data: { weight_unit: unit } });
  }

  async function saveHealthProfile() {
    setProfileSaving(true);
    refreshActivity();
    const heightCm = heightFt || heightIn
      ? Math.round((parseInt(heightFt || "0") * 12 + parseInt(heightIn || "0")) * 2.54)
      : null;
    await supabase.auth.updateUser({
      data: {
        age: age ? parseInt(age) : null,
        ethnicity: ethnicity || null,
        height_cm: heightCm,
      },
    });
    setProfileSaving(false);
  }

  // ── Delete all data ──

  async function handleDeleteAll() {
    setDeleting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const uid = user.id;

    await Promise.all([
      supabase.from("meal_logs").delete().eq("user_id", uid),
      supabase.from("weight_entries").delete().eq("user_id", uid),
      supabase.from("oura_metrics").delete().eq("user_id", uid),
      supabase.from("lab_results").delete().eq("user_id", uid),
      supabase.from("supplements").delete().eq("user_id", uid),
      supabase.from("supplement_logs").delete().eq("user_id", uid),
      supabase.from("daily_insights").delete().eq("user_id", uid),
      supabase.from("daily_feedback").delete().eq("user_id", uid),
    ]);

    await supabase.auth.signOut();
    clearSession();
    router.replace("/auth");
  }

  // ── Sign out ──

  async function handleSignOut() {
    refreshActivity();
    await supabase.auth.signOut();
    clearSession();
    router.replace("/auth");
  }

  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        paddingBottom: 60,
        fontFamily: "system-ui, sans-serif",
      }}
      onClick={refreshActivity}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "56px 20px 0",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1px solid ${BORDER}`,
            background: CARD,
            color: "#888",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 22,
            color: "#e8e8f0",
            margin: 0,
            ...MONO,
            letterSpacing: "0.1em",
          }}
        >
          SETTINGS
        </h1>
      </div>

      <div style={{ padding: "0 20px" }}>
        {/* ── OURA RING ── */}
        <SectionLabel>Oura Ring</SectionLabel>
        <Card>
          {/* Status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: ouraConnected ? GREEN : "#444",
                display: "inline-block",
                boxShadow: ouraConnected ? `0 0 6px ${GREEN}` : "none",
                flexShrink: 0,
              }}
            />
            <span
              style={{ ...MONO, fontSize: 10, color: ouraConnected ? GREEN : "#555" }}
            >
              {ouraConnected ? "CONNECTED" : "NOT CONNECTED"}
            </span>
            {ouraLastSync && (
              <span style={{ ...MONO, fontSize: 9, color: "#444", marginLeft: "auto" }}>
                Last sync: {new Date(ouraLastSync).toLocaleDateString()}
              </span>
            )}
          </div>

          <div>
            <FieldLabel>Personal Access Token</FieldLabel>
            <MaskedInput
              value={ouraToken}
              onChange={setOuraToken}
              placeholder="Enter Oura PAT..."
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <ActionButton
              onClick={saveOuraToken}
              variant="green"
              disabled={ouraSaving || !ouraToken.trim()}
            >
              {ouraSaving ? "SAVING..." : "SAVE"}
            </ActionButton>
            <ActionButton
              onClick={testOuraConnection}
              variant="ghost"
              disabled={!ouraConnected}
            >
              TEST CONNECTION
            </ActionButton>
          </div>

          {ouraTestResult && (
            <div
              style={{
                ...MONO,
                fontSize: 10,
                color: ouraTestResult.includes("successful") ? GREEN : RED,
                paddingTop: 2,
              }}
            >
              {ouraTestResult.toUpperCase()}
            </div>
          )}
        </Card>

        {/* ── CLAUDE AI ── */}
        <SectionLabel>Claude AI</SectionLabel>
        <Card>
          <div>
            <FieldLabel>API Key</FieldLabel>
            <MaskedInput
              value={claudeKey}
              onChange={setClaudeKey}
              placeholder="sk-ant-..."
            />
          </div>
          <ActionButton
            onClick={saveClaudeKey}
            variant="green"
            disabled={claudeSaving || !claudeKey.trim()}
          >
            {claudeSaving ? "SAVING..." : "SAVE"}
          </ActionButton>
        </Card>

        {/* ── NOTIFICATIONS ── */}
        <SectionLabel>Notifications</SectionLabel>
        <Card>
          {/* Meal reminders toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ color: "#e8e8f0", fontSize: 13 }}>
                Meal reminders
              </div>
              <div style={{ ...MONO, fontSize: 10, color: "#555", marginTop: 2 }}>
                Get reminded before meals
              </div>
            </div>
            <Toggle
              checked={mealReminders}
              onChange={setMealReminders}
            />
          </div>

          {/* Time inputs */}
          <div
            style={{
              opacity: mealReminders ? 1 : 0.4,
              transition: "opacity 0.2s",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              { label: "Breakfast", value: breakfastTime, set: setBreakfastTime },
              { label: "Lunch", value: lunchTime, set: setLunchTime },
              { label: "Dinner", value: dinnerTime, set: setDinnerTime },
            ].map(({ label, value, set }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ color: "#888", fontSize: 13 }}>{label}</span>
                <input
                  type="time"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  disabled={!mealReminders}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    background: BG,
                    color: "#e8e8f0",
                    ...MONO,
                    fontSize: 12,
                    outline: "none",
                    colorScheme: "dark",
                    cursor: mealReminders ? "auto" : "not-allowed",
                  }}
                />
              </div>
            ))}
          </div>

          {/* 10pm reminder */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 4,
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <div>
              <div style={{ color: "#e8e8f0", fontSize: 13 }}>
                10pm feedback reminder
              </div>
              <div style={{ ...MONO, fontSize: 10, color: "#555", marginTop: 2 }}>
                Daily check-in prompt
              </div>
            </div>
            <Toggle
              checked={feedbackReminder}
              onChange={setFeedbackReminder}
            />
          </div>

          <ActionButton
            onClick={saveNotifications}
            variant="green"
            fullWidth
            disabled={notifSaving}
          >
            {notifSaving ? "SAVING..." : "SAVE NOTIFICATION SETTINGS"}
          </ActionButton>
        </Card>

        {/* ── HEALTH PROFILE ── */}
        <SectionLabel>Health Profile</SectionLabel>
        <Card>
          <p style={{ color: "#555", fontSize: 11, fontFamily: "SF Mono, monospace", marginBottom: 12 }}>
            Used by AI to personalize gut health insights
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <FieldLabel>Age</FieldLabel>
              <input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 34"
                min={1} max={120}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  background: "#0A0A0F", border: `1px solid #1e1e2e`,
                  color: "#e8e8f0", fontSize: 14, outline: "none",
                }}
              />
            </div>

            <div>
              <FieldLabel>Height</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type="number"
                    value={heightFt}
                    onChange={e => setHeightFt(e.target.value)}
                    placeholder="5"
                    min={0} max={9}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10,
                      background: "#0A0A0F", border: `1px solid #1e1e2e`,
                      color: "#e8e8f0", fontSize: 14, outline: "none",
                    }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 11, fontFamily: "SF Mono, monospace" }}>ft</span>
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type="number"
                    value={heightIn}
                    onChange={e => setHeightIn(e.target.value)}
                    placeholder="10"
                    min={0} max={11}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10,
                      background: "#0A0A0F", border: `1px solid #1e1e2e`,
                      color: "#e8e8f0", fontSize: 14, outline: "none",
                    }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 11, fontFamily: "SF Mono, monospace" }}>in</span>
                </div>
              </div>
            </div>

            <div>
              <FieldLabel>Ethnicity</FieldLabel>
              <select
                value={ethnicity}
                onChange={e => setEthnicity(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  background: "#0A0A0F", border: `1px solid #1e1e2e`,
                  color: ethnicity ? "#e8e8f0" : "#555", fontSize: 14, outline: "none",
                  appearance: "none", cursor: "pointer",
                }}
              >
                <option value="">Select...</option>
                <option value="Asian">Asian</option>
                <option value="Black / African American">Black / African American</option>
                <option value="Hispanic / Latino">Hispanic / Latino</option>
                <option value="Middle Eastern / North African">Middle Eastern / North African</option>
                <option value="Native American / Alaska Native">Native American / Alaska Native</option>
                <option value="Pacific Islander">Pacific Islander</option>
                <option value="South Asian">South Asian</option>
                <option value="White / Caucasian">White / Caucasian</option>
                <option value="Mixed / Multiracial">Mixed / Multiracial</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <button
              onClick={saveHealthProfile}
              disabled={profileSaving}
              style={{
                width: "100%", padding: "12px", borderRadius: 10,
                border: `1px solid #7EB8A4`, background: "transparent",
                color: "#7EB8A4", fontFamily: "SF Mono, monospace", fontSize: 11,
                cursor: "pointer", opacity: profileSaving ? 0.5 : 1,
                letterSpacing: "0.1em",
              }}
            >
              {profileSaving ? "SAVING..." : "SAVE HEALTH PROFILE"}
            </button>
          </div>
        </Card>

        {/* ── ACCOUNT ── */}
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

        {/* ── DATA STATS ── */}
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

        {/* ── DANGER ZONE ── */}
        <SectionLabel>Danger Zone</SectionLabel>
        <Card danger>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 15,
              color: RED,
              marginBottom: 2,
            }}
          >
            Delete All My Data
          </div>
          <p
            style={{
              color: "#888",
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Permanently removes all your health data from GutTrack. This action
            cannot be undone.
          </p>
          <ActionButton
            onClick={() => setShowDeleteConfirm(true)}
            variant="danger"
            fullWidth
          >
            DELETE ALL MY DATA
          </ActionButton>
        </Card>

        {/* ── SIGN OUT ── */}
        <div style={{ marginTop: 24 }}>
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 14,
              border: `1px solid ${BORDER}`,
              background: CARD,
              color: "#888",
              ...MONO,
              fontSize: 12,
              letterSpacing: "0.08em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            SIGN OUT
          </button>
        </div>
      </div>

      {/* ── Delete confirmation overlay ── */}
      {showDeleteConfirm && (
        <DeleteConfirmOverlay
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            handleDeleteAll();
          }}
        />
      )}

      {/* ── Deleting spinner overlay ── */}
      {deleting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ ...MONO, fontSize: 12, color: RED, letterSpacing: "0.1em" }}>
            DELETING DATA...
          </div>
        </div>
      )}
    </div>
  );
}
