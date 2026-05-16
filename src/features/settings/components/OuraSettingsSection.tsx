"use client";

import {
  SectionLabel,
  Card,
  ActionButton,
  GREEN,
  MONO,
} from "./SettingsUI";

interface OuraSettingsSectionProps {
  ouraConnected: boolean;
  ouraLastSync: string | null;
  testOuraConnection: () => void;
}

export function OuraSettingsSection({
  ouraConnected,
  ouraLastSync,
  testOuraConnection,
}: OuraSettingsSectionProps) {
  return (
    <>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <ActionButton
            onClick={() => window.location.href = "/api/oura/connect"}
            variant="green"
            fullWidth
          >
            {ouraConnected ? "RECONNECT OURA RING" : "CONNECT OURA RING"}
          </ActionButton>
          
          <ActionButton
            onClick={testOuraConnection}
            variant="ghost"
            disabled={!ouraConnected}
            fullWidth
          >
            TEST SYNC
          </ActionButton>
        </div>
      </Card>
    </>
  );
}
