"use client";

import {
  SectionLabel,
  Card,
  ActionButton,
  DeleteConfirmOverlay,
  RED,
  CARD,
  BORDER,
  MONO,
} from "./SettingsUI";

interface DangerZoneSectionProps {
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (val: boolean) => void;
  deleting: boolean;
  handleDeleteAll: () => void;
  handleSignOut: () => void;
}

export function DangerZoneSection({
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleting,
  handleDeleteAll,
  handleSignOut,
}: DangerZoneSectionProps) {
  return (
    <>
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
    </>
  );
}
