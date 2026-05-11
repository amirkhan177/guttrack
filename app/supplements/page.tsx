"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Supplement, SupplementLog } from "@/lib/supabase";
import {
  getPinFromSession,
  isSessionExpired,
  refreshActivity,
  clearSession,
} from "@/lib/crypto";
import NavBar from "@/components/NavBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type Unit = "mg" | "g" | "ml" | "capsules" | "tablets";
type Frequency =
  | "Daily"
  | "Twice Daily"
  | "Three Times Daily"
  | "Weekly"
  | "As Needed";
type TimeOfDay = "Morning" | "Afternoon" | "Evening" | "Night";
type Category = "supplement" | "medication";
type TabView = "supplements" | "medications";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_ORDER: TimeOfDay[] = ["Morning", "Afternoon", "Evening", "Night"];

const QUICK_ADDS_SUPPLEMENTS = [
  "L-Glutamine",
  "Fish Oil Omega-3",
  "Probiotic Lactobacillus",
  "Vitamin D",
  "Magnesium",
  "Collagen",
];

const QUICK_ADDS_MEDICATIONS = [
  "Lisinopril",
  "Omeprazole",
  "Prednisone",
  "Budesonide",
  "Mesalamine",
  "Methotrexate",
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG = "#0A0A0F";
const CARD = "#15151f";
const BORDER = "#1e1e2e";
const GREEN = "#7EB8A4";
const YELLOW = "#FFD93D";
const RED = "#FF6B6B";
const ORANGE = "#FF8C42";

const MONO: React.CSSProperties = {
  fontFamily: "SF Mono, ui-monospace, monospace",
};

// ─── Overdue logic ────────────────────────────────────────────────────────────

function isOverdue(timeOfDay: TimeOfDay): boolean {
  const hour = new Date().getHours();
  if (timeOfDay === "Morning") return hour > 10;
  if (timeOfDay === "Afternoon") return hour > 15;
  if (timeOfDay === "Evening") return hour > 20;
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Segmented Picker ─────────────────────────────────────────────────────────

function SegmentedPicker<T extends string>({
  options,
  value,
  onChange,
  accentColor = GREEN,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  accentColor?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${value === opt ? accentColor : BORDER}`,
            background: value === opt ? `${accentColor}22` : CARD,
            color: value === opt ? accentColor : "#888",
            fontSize: 11,
            ...MONO,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Swipeable Row ────────────────────────────────────────────────────────────

function SwipeRow({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const THRESHOLD = 80;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setOffset(Math.max(dx, -THRESHOLD - 20));
  }

  function handleTouchEnd() {
    if (offset < -THRESHOLD / 2) {
      setOffset(-THRESHOLD);
    } else {
      setOffset(0);
    }
    startX.current = null;
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18 }}>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: THRESHOLD,
          background: RED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 18,
          cursor: "pointer",
        }}
        onClick={() => {
          setOffset(0);
          onDelete();
        }}
      >
        <span style={{ color: "#fff", fontSize: 11, ...MONO, fontWeight: 700 }}>
          DELETE
        </span>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current === null ? "transform 0.2s" : "none",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Supplement Row ───────────────────────────────────────────────────────────

function SupplementRow({
  supp,
  taken,
  onToggle,
  onDelete,
}: {
  supp: Supplement;
  taken: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isMed = supp.category === "medication";
  const overdue = isMed && !taken && isOverdue(supp.time_of_day as TimeOfDay);

  const toggleBg = isMed
    ? taken
      ? RED
      : `${RED}20`
    : taken
    ? GREEN
    : "#15151f";
  const toggleBorder = isMed
    ? taken
      ? "none"
      : `2px solid ${RED}`
    : taken
    ? "none"
    : `2px solid ${BORDER}`;
  const toggleGlow = isMed
    ? taken
      ? `0 0 12px ${RED}55`
      : "none"
    : taken
    ? `0 0 12px ${GREEN}55`
    : "none";

  return (
    <SwipeRow onDelete={onDelete}>
      <div
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderLeft: isMed ? `3px solid ${RED}` : `1px solid ${BORDER}`,
          borderRadius: 18,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Toggle circle */}
        <button
          onClick={onToggle}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: toggleBorder,
            background: toggleBg,
            flexShrink: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: toggleGlow,
          }}
        >
          {taken && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8l3.5 3.5L13 4"
                stroke="#0A0A0F"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: taken ? "#666" : "#e8e8f0",
                textDecoration: taken ? "line-through" : "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {supp.name}
            </div>
            {overdue && (
              <span
                style={{
                  ...MONO,
                  fontSize: 9,
                  color: RED,
                  background: `${RED}18`,
                  border: `1px solid ${RED}44`,
                  padding: "1px 5px",
                  borderRadius: 4,
                  letterSpacing: "0.06em",
                  flexShrink: 0,
                }}
              >
                OVERDUE
              </span>
            )}
            {isMed && (
              <span
                style={{
                  ...MONO,
                  fontSize: 8,
                  color: YELLOW,
                  background: `${YELLOW}15`,
                  border: `1px solid ${YELLOW}33`,
                  padding: "1px 5px",
                  borderRadius: 4,
                  letterSpacing: "0.04em",
                  flexShrink: 0,
                }}
              >
                Assumed daily by AI
              </span>
            )}
          </div>
          {supp.dosage && (
            <div
              style={{
                ...MONO,
                fontSize: 12,
                color: "#666",
                marginTop: 2,
              }}
            >
              {supp.dosage}
              {supp.unit}
            </div>
          )}
          <div
            style={{
              ...MONO,
              fontSize: 10,
              color: "#555",
              marginTop: 2,
            }}
          >
            {supp.frequency}
          </div>
        </div>

        {/* Frequency badge */}
        <div
          style={{
            ...MONO,
            fontSize: 9,
            color: "#555",
            background: BORDER,
            padding: "3px 8px",
            borderRadius: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            flexShrink: 0,
          }}
        >
          {supp.frequency === "Daily"
            ? "1x"
            : supp.frequency === "Twice Daily"
            ? "2x"
            : supp.frequency === "Three Times Daily"
            ? "3x"
            : supp.frequency === "Weekly"
            ? "Wkly"
            : "PRN"}
        </div>
      </div>
    </SwipeRow>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SupplementsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<TabView>("supplements");

  // Bottom sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  // Form fields
  const [formCategory, setFormCategory] = useState<Category>("supplement");
  const [formName, setFormName] = useState("");
  const [formDosage, setFormDosage] = useState("");
  const [formUnit, setFormUnit] = useState<Unit>("mg");
  const [formFrequency, setFormFrequency] = useState<Frequency>("Daily");
  const [formTime, setFormTime] = useState<TimeOfDay>("Morning");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Session guard ──
  useEffect(() => {
    const pin = getPinFromSession();
    if (!pin || isSessionExpired()) {
      router.replace("/pin");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      return;
    }
    setUserId(user.id);

    const [{ data: supps }, { data: logsData }] = await Promise.all([
      supabase
        .from("supplements")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("supplement_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayStr()),
    ]);

    setSupplements((supps as Supplement[]) ?? []);
    setLogs((logsData as SupplementLog[]) ?? []);
    setLoading(false);
  }, [supabase, router]);

  function openSheet(name = "", category: Category = "supplement") {
    setFormCategory(category);
    setFormName(name);
    setFormDosage("");
    setFormUnit("mg");
    setFormFrequency("Daily");
    setFormTime("Morning");
    setFormNotes("");
    setSheetOpen(true);
    refreshActivity();
  }

  async function handleSave() {
    if (!formName.trim() || !userId) return;
    setSaving(true);
    refreshActivity();
    await supabase.from("supplements").insert({
      user_id: userId,
      name: formName.trim(),
      dosage: formDosage ? parseFloat(formDosage) : null,
      unit: formUnit,
      frequency: formFrequency,
      time_of_day: formTime,
      notes: formNotes.trim() || null,
      active: true,
      category: formCategory,
    });
    setSheetOpen(false);
    await loadData();
    setSaving(false);
  }

  async function toggleTaken(supp: Supplement) {
    if (!userId) return;
    refreshActivity();
    const existing = logs.find((l) => l.supplement_id === supp.id);
    if (existing) {
      await supabase.from("supplement_logs").delete().eq("id", existing.id);
      setLogs((prev) => prev.filter((l) => l.id !== existing.id));
    } else {
      const { data } = await supabase
        .from("supplement_logs")
        .insert({
          user_id: userId,
          supplement_id: supp.id,
          taken_at: new Date().toISOString(),
          date: todayStr(),
        })
        .select()
        .single();
      if (data) setLogs((prev) => [...prev, data as SupplementLog]);
    }
  }

  async function softDelete(supp: Supplement) {
    refreshActivity();
    await supabase
      .from("supplements")
      .update({ active: false })
      .eq("id", supp.id);
    setSupplements((prev) => prev.filter((s) => s.id !== supp.id));
  }

  // ── Derived data ──
  const supplementsList = supplements.filter((s) => s.category !== "medication");
  const medicationsList = supplements.filter((s) => s.category === "medication");

  const takenCount = logs.length;
  const totalCount = supplements.length;
  const pct = totalCount > 0 ? (takenCount / totalCount) * 100 : 0;

  const activeList = activeTab === "supplements" ? supplementsList : medicationsList;

  const grouped = TIME_ORDER.reduce<Record<TimeOfDay, Supplement[]>>(
    (acc, t) => {
      acc[t] = activeList.filter((s) => s.time_of_day === t);
      return acc;
    },
    { Morning: [], Afternoon: [], Evening: [], Night: [] }
  );

  const quickAdds =
    activeTab === "supplements" ? QUICK_ADDS_SUPPLEMENTS : QUICK_ADDS_MEDICATIONS;

  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        paddingBottom: 80,
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
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 22,
            color: "#e8e8f0",
            margin: 0,
          }}
        >
          {activeTab === "supplements" ? "Supplements" : "Medications"}
        </h1>
        <button
          onClick={() => openSheet("", activeTab === "medications" ? "medication" : "supplement")}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1px solid ${BORDER}`,
            background: CARD,
            color: activeTab === "medications" ? RED : GREEN,
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          +
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "16px 20px 0",
        }}
      >
        {(["supplements", "medications"] as TabView[]).map((tab) => {
          const selected = activeTab === tab;
          const accentColor = tab === "medications" ? RED : GREEN;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 20,
                border: `1px solid ${selected ? accentColor : BORDER}`,
                background: selected ? `${accentColor}15` : "transparent",
                color: selected ? accentColor : "#555",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.15s",
                ...MONO,
              }}
            >
              {tab === "supplements" ? "SUPPLEMENTS" : "MEDICATIONS"}
            </button>
          );
        })}
      </div>

      {/* ── Progress bar (combined) ── */}
      <div style={{ padding: "16px 20px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              ...MONO,
              fontSize: 9,
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {takenCount} of {totalCount} taken today
          </span>
          <span style={{ ...MONO, fontSize: 10, color: GREEN }}>
            {Math.round(pct)}%
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
              width: `${pct}%`,
              background: GREEN,
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* ── Medications header label ── */}
      {activeTab === "medications" && (
        <div
          style={{
            padding: "16px 20px 0",
          }}
        >
          <span
            style={{
              ...MONO,
              fontSize: 10,
              color: RED,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            DAILY MEDICATIONS
          </span>
        </div>
      )}

      {/* ── List ── */}
      <div style={{ padding: "20px 20px 0" }}>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              color: "#444",
              padding: 40,
              ...MONO,
              fontSize: 11,
            }}
          >
            LOADING...
          </div>
        ) : activeList.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#444",
              padding: 40,
              ...MONO,
              fontSize: 11,
            }}
          >
            {activeTab === "supplements"
              ? "NO SUPPLEMENTS YET"
              : "NO MEDICATIONS YET"}
          </div>
        ) : (
          TIME_ORDER.map((time) => {
            const group = grouped[time];
            if (group.length === 0) return null;
            return (
              <div key={time} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    ...MONO,
                    fontSize: 9,
                    color: "#555",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {time}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.map((supp) => {
                    const taken = logs.some((l) => l.supplement_id === supp.id);
                    return (
                      <SupplementRow
                        key={supp.id}
                        supp={supp}
                        taken={taken}
                        onToggle={() => toggleTaken(supp)}
                        onDelete={() => softDelete(supp)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Quick add chips ── */}
      <div style={{ padding: "8px 0 0" }}>
        <div
          style={{
            ...MONO,
            fontSize: 9,
            color: "#555",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "0 20px",
            marginBottom: 10,
          }}
        >
          Quick Add
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingLeft: 20,
            paddingRight: 20,
            paddingBottom: 4,
            scrollbarWidth: "none",
          }}
        >
          {quickAdds.map((name) => (
            <button
              key={name}
              onClick={() =>
                openSheet(
                  name,
                  activeTab === "medications" ? "medication" : "supplement"
                )
              }
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 20,
                border: `1px solid ${BORDER}`,
                background: CARD,
                color: "#888",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom sheet overlay ── */}
      {sheetOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            style={{
              background: "#12121a",
              borderTop: `1px solid ${BORDER}`,
              borderRadius: "24px 24px 0 0",
              width: "100%",
              maxWidth: 430,
              padding: "24px 20px 40px",
              maxHeight: "85vh",
              overflowY: "auto",
              animation: "slideUp 0.25s ease",
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>

            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                background: BORDER,
                borderRadius: 2,
                margin: "0 auto 20px",
              }}
            />

            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 18,
                color: "#e8e8f0",
                margin: "0 0 16px",
              }}
            >
              Add {formCategory === "medication" ? "Medication" : "Supplement"}
            </h2>

            {/* Category toggle */}
            <label style={labelStyle}>Category</label>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {(["supplement", "medication"] as Category[]).map((cat) => {
                  const selected = formCategory === cat;
                  const color = cat === "medication" ? RED : GREEN;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 8,
                        border: `1px solid ${selected ? color : BORDER}`,
                        background: selected ? `${color}22` : CARD,
                        color: selected ? color : "#888",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        ...MONO,
                      }}
                    >
                      {cat === "supplement" ? "SUPPLEMENT" : "MEDICATION"}
                    </button>
                  );
                })}
              </div>
              {formCategory === "medication" && (
                <div
                  style={{
                    ...MONO,
                    fontSize: 10,
                    color: YELLOW,
                    marginTop: 8,
                  }}
                >
                  Required daily
                </div>
              )}
            </div>

            {/* Name */}
            <label style={labelStyle}>Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={
                formCategory === "medication" ? "e.g. Omeprazole" : "e.g. Vitamin D"
              }
              style={inputStyle}
            />

            {/* Dosage */}
            <label style={labelStyle}>Dosage</label>
            <input
              type="number"
              value={formDosage}
              onChange={(e) => setFormDosage(e.target.value)}
              placeholder="e.g. 500"
              style={inputStyle}
            />

            {/* Unit */}
            <label style={labelStyle}>Unit</label>
            <div style={{ marginBottom: 16 }}>
              <SegmentedPicker<Unit>
                options={["mg", "g", "ml", "capsules", "tablets"]}
                value={formUnit}
                onChange={setFormUnit}
              />
            </div>

            {/* Frequency */}
            <label style={labelStyle}>Frequency</label>
            <div style={{ marginBottom: 16 }}>
              <SegmentedPicker<Frequency>
                options={[
                  "Daily",
                  "Twice Daily",
                  "Three Times Daily",
                  "Weekly",
                  "As Needed",
                ]}
                value={formFrequency}
                onChange={setFormFrequency}
              />
            </div>

            {/* Time of day */}
            <label style={labelStyle}>Time of Day</label>
            <div style={{ marginBottom: 16 }}>
              <SegmentedPicker<TimeOfDay>
                options={["Morning", "Afternoon", "Evening", "Night"]}
                value={formTime}
                onChange={setFormTime}
              />
            </div>

            {/* Notes */}
            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any notes..."
              rows={3}
              style={{
                ...inputStyle,
                resize: "none",
                height: "auto",
                lineHeight: 1.5,
              }}
            />

            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 14,
                border: "none",
                background: formName.trim()
                  ? formCategory === "medication"
                    ? RED
                    : GREEN
                  : "#333",
                color: formName.trim() ? "#0A0A0F" : "#666",
                fontWeight: 700,
                fontSize: 14,
                cursor: formName.trim() ? "pointer" : "not-allowed",
                marginTop: 8,
                transition: "all 0.2s",
                ...MONO,
              }}
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}

// ── Shared input styles ────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "SF Mono, ui-monospace, monospace",
  fontSize: 9,
  color: "#555",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #1e1e2e",
  background: "#0A0A0F",
  color: "#e8e8f0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 16,
  fontFamily: "system-ui, sans-serif",
};
