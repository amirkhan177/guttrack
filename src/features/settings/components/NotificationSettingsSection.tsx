"use client";

import {
  SectionLabel,
  Card,
  Toggle,
  ActionButton,
  BG,
  BORDER,
  MONO,
} from "./SettingsUI";

interface NotificationSettingsSectionProps {
  mealReminders: boolean;
  setMealReminders: (val: boolean) => void;
  breakfastTime: string;
  setBreakfastTime: (val: string) => void;
  lunchTime: string;
  setLunchTime: (val: string) => void;
  dinnerTime: string;
  setDinnerTime: (val: string) => void;
  feedbackReminder: boolean;
  setFeedbackReminder: (val: boolean) => void;
  notifSaving: boolean;
  saveNotifications: () => void;
}

export function NotificationSettingsSection({
  mealReminders,
  setMealReminders,
  breakfastTime,
  setBreakfastTime,
  lunchTime,
  setLunchTime,
  dinnerTime,
  setDinnerTime,
  feedbackReminder,
  setFeedbackReminder,
  notifSaving,
  saveNotifications,
}: NotificationSettingsSectionProps) {
  return (
    <>
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
    </>
  );
}
