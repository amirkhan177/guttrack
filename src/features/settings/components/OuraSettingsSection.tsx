"use client";

import {
  SectionLabel,
  Card,
  FieldLabel,
  MaskedInput,
  ActionButton,
  GREEN,
  RED,
  MONO,
} from "./SettingsUI";

interface OuraSettingsSectionProps {
  ouraToken: string;
  setOuraToken: (val: string) => void;
  ouraConnected: boolean;
  ouraLastSync: string | null;
  ouraSaving: boolean;
  ouraTestResult: string | null;
  saveOuraToken: () => void;
  testOuraConnection: () => void;
}

export function OuraSettingsSection({
  ouraToken,
  setOuraToken,
  ouraConnected,
  ouraLastSync,
  ouraSaving,
  ouraTestResult,
  saveOuraToken,
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
    </>
  );
}
