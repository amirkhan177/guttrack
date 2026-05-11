"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { LabResult } from "@/lib/supabase";
import {
  getPinFromSession,
  isSessionExpired,
  refreshActivity,
} from "@/lib/crypto";
import NavBar from "@/components/NavBar";

// ─── Design tokens ───────────────────────────────────────────────────────────

const BG = "#0A0A0F";
const CARD = "#15151f";
const BORDER = "#1e1e2e";
const GREEN = "#7EB8A4";
const RED = "#FF6B6B";
const ORANGE = "#FF8C42";
const MONO: React.CSSProperties = {
  fontFamily: "SF Mono, ui-monospace, monospace",
};

type Status = "Normal" | "Elevated" | "Low";

type ExtractedLab = {
  name: string;
  value: string;
  unit: string;
  status: "Normal" | "Elevated" | "Low" | "Unknown";
  reference_range: string;
  date: string | null;
};

const STATUS_COLORS: Record<Status, string> = {
  Normal: GREEN,
  Elevated: RED,
  Low: ORANGE,
};

function statusColor(s: string | null): string {
  return STATUS_COLORS[(s as Status) ?? "Normal"] ?? GREEN;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Swipe-to-delete row ─────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LabsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload / AI extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedLabs, setExtractedLabs] = useState<ExtractedLab[]>([]);
  const [savingExtracted, setSavingExtracted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formStatus, setFormStatus] = useState<Status>("Normal");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
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

  async function loadData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      return;
    }
    setUserId(user.id);

    const { data } = await supabase
      .from("lab_results")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    setResults((data as LabResult[]) ?? []);
    setLoading(false);
  }

  // Alias so handleSaveExtracted can call it without circular ref issues
  const loadLabs = loadData;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setExtractError('');
    setExtractedLabs([]);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/labs/extract', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setExtractedLabs(data.labs);
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveExtracted() {
    setSavingExtracted(true);
    const supabaseClient = createSupabaseBrowserClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { setSavingExtracted(false); return; }

    const rows = extractedLabs.map((lab) => ({
      user_id: user.id,
      name: lab.name,
      value: lab.value,
      unit: lab.unit || null,
      status: lab.status === 'Unknown' ? null : lab.status,
      date: lab.date || null,
    }));

    await supabaseClient.from('lab_results').insert(rows);
    setExtractedLabs([]);
    setSavingExtracted(false);
    await loadLabs();
  }

  function openSheet() {
    setFormName("");
    setFormValue("");
    setFormUnit("");
    setFormStatus("Normal");
    setFormDate(new Date().toISOString().split("T")[0]);
    setSheetOpen(true);
    refreshActivity();
  }

  async function handleSave() {
    if (!formName.trim() || !userId) return;
    setSaving(true);
    refreshActivity();
    await supabase.from("lab_results").insert({
      user_id: userId,
      name: formName.trim(),
      value: formValue.trim() || null,
      unit: formUnit.trim() || null,
      status: formStatus,
      date: formDate || null,
    });
    setSheetOpen(false);
    await loadData();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    refreshActivity();
    await supabase.from("lab_results").delete().eq("id", id);
    setResults((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        paddingBottom: 100,
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
          Lab Results
        </h1>
        <button
          onClick={openSheet}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1px solid ${BORDER}`,
            background: CARD,
            color: GREEN,
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

      <div style={{ padding: "20px 20px 0" }}>
        {/* ── Kaiser FHIR card ── */}
        <div
          style={{
            border: `1px dashed ${BORDER}`,
            background: CARD,
            borderRadius: 18,
            padding: "16px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              ...MONO,
              fontSize: 10,
              color: GREEN,
              letterSpacing: "0.12em",
              marginBottom: 10,
            }}
          >
            KAISER PERMANENTE
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 4 }}>
                Health Records Integration
              </div>
              <div style={{ ...MONO, fontSize: 10, color: "#555" }}>
                Connects in future version
              </div>
            </div>
            <button
              disabled
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
                background: "#0A0A0F",
                color: "#555",
                ...MONO,
                fontSize: 10,
                letterSpacing: "0.08em",
                cursor: "not-allowed",
              }}
            >
              CONNECT VIA FHIR
            </button>
          </div>
        </div>

        {/* ── Upload Lab Report card ── */}
        <div
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            padding: 16,
            marginBottom: 24,
          }}
        >
          {/* Header row */}
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                ...MONO,
                fontSize: 10,
                color: GREEN,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              UPLOAD LAB REPORT
            </div>
            <div
              style={{
                ...MONO,
                fontSize: 9,
                color: '#555',
                marginTop: 2,
              }}
            >
              PDF or screenshot · PII never stored
            </div>
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Upload area or loading state */}
          {extracting ? (
            <div
              style={{
                textAlign: 'center',
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              `}</style>
              <div
                style={{
                  fontSize: 24,
                  color: GREEN,
                  display: 'inline-block',
                  animation: 'spin 1.2s linear infinite',
                  lineHeight: 1,
                }}
              >
                ◌
              </div>
              <div style={{ ...MONO, fontSize: 11, color: GREEN, letterSpacing: '0.1em' }}>
                ANALYZING WITH AI...
              </div>
            </div>
          ) : extractedLabs.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1.5px dashed #1e1e2e',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 28, lineHeight: 1 }}>📄</div>
              <div style={{ color: '#666', fontSize: 13 }}>Tap to upload</div>
              <div style={{ ...MONO, fontSize: 10, color: '#444' }}>PDF, JPG, PNG · Max 10MB</div>
            </div>
          ) : null}

          {/* Error state */}
          {extractError ? (
            <div
              style={{
                ...MONO,
                fontSize: 12,
                color: '#FF6B6B',
                marginTop: 10,
              }}
            >
              {extractError}
            </div>
          ) : null}

          {/* Extracted results review */}
          {extractedLabs.length > 0 && (
            <div>
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...MONO, fontSize: 10, color: GREEN, letterSpacing: '0.1em' }}>
                    EXTRACTED RESULTS
                  </span>
                  <span
                    style={{
                      ...MONO,
                      fontSize: 9,
                      color: GREEN,
                      background: `${GREEN}22`,
                      border: `1px solid ${GREEN}`,
                      borderRadius: 6,
                      padding: '2px 7px',
                    }}
                  >
                    {extractedLabs.length} FOUND
                  </span>
                </div>
                <button
                  onClick={() => setExtractedLabs([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    ...MONO,
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  ✕ CLEAR
                </button>
              </div>

              {/* Editable rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {extractedLabs.map((lab, idx) => {
                  const labStatusColor =
                    lab.status === 'Normal'
                      ? GREEN
                      : lab.status === 'Elevated'
                      ? RED
                      : lab.status === 'Low'
                      ? ORANGE
                      : '#666';
                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#0A0A0F',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 12,
                        padding: '12px 12px 10px',
                        position: 'relative',
                      }}
                    >
                      {/* Remove row button */}
                      <button
                        onClick={() =>
                          setExtractedLabs((prev) => prev.filter((_, i) => i !== idx))
                        }
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: 'none',
                          border: 'none',
                          color: '#555',
                          fontSize: 13,
                          cursor: 'pointer',
                          lineHeight: 1,
                          padding: 2,
                        }}
                      >
                        ✕
                      </button>

                      {/* Name input */}
                      <input
                        value={lab.name}
                        onChange={(e) =>
                          setExtractedLabs((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, name: e.target.value } : l))
                          )
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${BORDER}`,
                          color: '#e8e8f0',
                          fontSize: 14,
                          fontWeight: 600,
                          outline: 'none',
                          width: 'calc(100% - 24px)',
                          paddingBottom: 4,
                          marginBottom: 8,
                          fontFamily: 'system-ui, sans-serif',
                        }}
                      />

                      {/* Value + Unit row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <input
                          value={lab.value}
                          onChange={(e) =>
                            setExtractedLabs((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, value: e.target.value } : l
                              )
                            )
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            borderBottom: `1px solid ${BORDER}`,
                            color: labStatusColor,
                            ...MONO,
                            fontSize: 14,
                            fontWeight: 700,
                            outline: 'none',
                            width: 80,
                            paddingBottom: 4,
                          }}
                        />
                        <input
                          value={lab.unit}
                          onChange={(e) =>
                            setExtractedLabs((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, unit: e.target.value } : l
                              )
                            )
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            borderBottom: `1px solid ${BORDER}`,
                            color: '#666',
                            ...MONO,
                            fontSize: 11,
                            outline: 'none',
                            width: 70,
                            paddingBottom: 4,
                          }}
                        />
                      </div>

                      {/* Status pill selector */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: lab.reference_range ? 8 : 0 }}>
                        {(['Normal', 'Elevated', 'Low'] as const).map((s) => {
                          const sc = s === 'Normal' ? GREEN : s === 'Elevated' ? RED : ORANGE;
                          const active = lab.status === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                setExtractedLabs((prev) =>
                                  prev.map((l, i) => (i === idx ? { ...l, status: s } : l))
                                )
                              }
                              style={{
                                padding: '3px 9px',
                                borderRadius: 6,
                                border: `1px solid ${active ? sc : BORDER}`,
                                background: active ? `${sc}18` : 'transparent',
                                color: active ? sc : '#555',
                                ...MONO,
                                fontSize: 9,
                                cursor: 'pointer',
                                letterSpacing: '0.06em',
                              }}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>

                      {/* Reference range */}
                      {lab.reference_range ? (
                        <div
                          style={{
                            ...MONO,
                            fontSize: 10,
                            color: '#555',
                          }}
                        >
                          Ref: {lab.reference_range}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Upload different file link */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#555',
                  ...MONO,
                  fontSize: 10,
                  cursor: 'pointer',
                  padding: '0 0 12px',
                  display: 'block',
                  letterSpacing: '0.06em',
                }}
              >
                UPLOAD DIFFERENT FILE
              </button>

              {/* Save all button */}
              <button
                onClick={handleSaveExtracted}
                disabled={savingExtracted}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  background: GREEN,
                  color: '#0A0A0F',
                  ...MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: savingExtracted ? 'not-allowed' : 'pointer',
                  opacity: savingExtracted ? 0.5 : 1,
                  letterSpacing: '0.08em',
                }}
              >
                {savingExtracted ? 'SAVING...' : 'SAVE ALL TO LABS'}
              </button>
            </div>
          )}
        </div>

        {/* ── Results list ── */}
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
        ) : results.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#444",
              padding: 40,
              ...MONO,
              fontSize: 11,
            }}
          >
            NO LAB RESULTS YET
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((result) => {
              const col = statusColor(result.status);
              return (
                <SwipeRow
                  key={result.id}
                  onDelete={() => handleDelete(result.id)}
                >
                  <div
                    style={{
                      background: CARD,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 18,
                      padding: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    {/* Left: name + date */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#e8e8f0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {result.name}
                      </div>
                      <div
                        style={{
                          ...MONO,
                          fontSize: 11,
                          color: "#555",
                          marginTop: 4,
                        }}
                      >
                        {formatDate(result.date)}
                      </div>
                    </div>

                    {/* Right: value + status badge */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          ...MONO,
                          fontSize: 15,
                          fontWeight: 700,
                          color: col,
                        }}
                      >
                        {result.value ?? "—"}
                        {result.unit && (
                          <span
                            style={{
                              fontSize: 10,
                              color: col,
                              marginLeft: 3,
                              fontWeight: 400,
                            }}
                          >
                            {result.unit}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          ...MONO,
                          fontSize: 9,
                          color: col,
                          background: `${col}18`,
                          border: `1px solid ${col}44`,
                          padding: "2px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {result.status ?? "Normal"}
                      </div>
                    </div>
                  </div>
                </SwipeRow>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
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
                margin: "0 0 20px",
              }}
            >
              Add Lab Result
            </h2>

            <label style={labelStyle}>Test Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Fasting Glucose"
              style={inputStyle}
            />

            <label style={labelStyle}>Value</label>
            <input
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder='e.g. 98 or ">140" or "Negative"'
              style={inputStyle}
            />

            <label style={labelStyle}>Unit</label>
            <input
              value={formUnit}
              onChange={(e) => setFormUnit(e.target.value)}
              placeholder="e.g. mg/dL"
              style={inputStyle}
            />

            <label style={labelStyle}>Status</label>
            <div
              style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
            >
              {(["Normal", "Elevated", "Low"] as Status[]).map((s) => {
                const col = STATUS_COLORS[s];
                const active = formStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormStatus(s)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: `1px solid ${active ? col : BORDER}`,
                      background: active ? `${col}18` : CARD,
                      color: active ? col : "#666",
                      ...MONO,
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: col,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {s}
                  </button>
                );
              })}
            </div>

            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={{
                ...inputStyle,
                colorScheme: "dark",
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
                background: formName.trim() ? GREEN : "#333",
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

// ─── Shared input styles ─────────────────────────────────────────────────────

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
