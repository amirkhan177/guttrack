"use client";

import {
  SectionLabel,
  Card,
  FieldLabel,
  MaskedInput,
  ActionButton,
} from "./SettingsUI";

interface AISettingsSectionProps {
  aiKey: string;
  setAIKey: (val: string) => void;
  aiSaving: boolean;
  saveAIKey: () => void;
}

export function AISettingsSection({
  aiKey,
  setAIKey,
  aiSaving,
  saveAIKey,
}: AISettingsSectionProps) {
  return (
    <>
      <SectionLabel>AI Model (Baidu CoBuddy)</SectionLabel>
      <Card>
        <div>
          <FieldLabel>OpenRouter API Key</FieldLabel>
          <MaskedInput
            value={aiKey}
            onChange={setAIKey}
            placeholder="sk-or-v1-..."
          />
        </div>
        <ActionButton
          onClick={saveAIKey}
          variant="green"
          disabled={aiSaving || !aiKey.trim()}
        >
          {aiSaving ? "SAVING..." : "SAVE"}
        </ActionButton>
      </Card>
    </>
  );
}
