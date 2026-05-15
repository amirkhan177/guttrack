"use client";

import { useState } from "react";

// ─── Design tokens ───────────────────────────────────────────────────────────

export const BG = "#0A0A0F";
export const CARD = "#15151f";
export const BORDER = "#1e1e2e";
export const GREEN = "#7EB8A4";
export const RED = "#FF6B6B";
export const MONO: React.CSSProperties = {
  fontFamily: "SF Mono, ui-monospace, monospace",
};

// ─── Small components ─────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
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

export function Card({
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

export function FieldLabel({ children }: { children: React.ReactNode }) {
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

export function MaskedInput({
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

export function Toggle({
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

export function ActionButton({
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

export function DataRow({
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

export function DeleteConfirmOverlay({
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
          TYPE &quot;DELETE&quot; TO CONFIRM
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
