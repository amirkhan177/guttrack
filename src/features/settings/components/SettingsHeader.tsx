"use client";

import { useRouter } from "next/navigation";
import { BORDER, CARD, MONO } from "./SettingsUI";

export function SettingsHeader() {
  const router = useRouter();

  return (
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
  );
}
