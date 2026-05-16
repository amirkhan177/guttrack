"use client";

import { useSettings } from "@/src/features/settings/hooks/useSettings";
import { BG } from "@/src/features/settings/components/SettingsUI";
import { SettingsHeader } from "@/src/features/settings/components/SettingsHeader";
import { OuraSettingsSection } from "@/src/features/settings/components/OuraSettingsSection";
import { AISettingsSection } from "@/src/features/settings/components/AISettingsSection";
import { NotificationSettingsSection } from "@/src/features/settings/components/NotificationSettingsSection";
import { HealthProfileSection } from "@/src/features/settings/components/HealthProfileSection";
import { AccountSettingsSection } from "@/src/features/settings/components/AccountSettingsSection";
import { DangerZoneSection } from "@/src/features/settings/components/DangerZoneSection";
import { clearSession } from "@/lib/crypto";

export default function SettingsPage() {
  const {
    ouraConnected,
    ouraLastSync,
    testOuraConnection,

    aiKey, setAIKey,
    aiSaving,
    saveAIKey,

    mealReminders, setMealReminders,
    breakfastTime, setBreakfastTime,
    lunchTime, setLunchTime,
    dinnerTime, setDinnerTime,
    feedbackReminder, setFeedbackReminder,
    notifSaving,
    saveNotifications,

    weightUnit,
    saveWeightUnit,

    age, setAge,
    heightFt, setHeightFt,
    heightIn, setHeightIn,
    ethnicity, setEthnicity,
    profileSaving,
    saveHealthProfile,

    stats,

    showDeleteConfirm, setShowDeleteConfirm,
    deleting,
    handleDeleteAll,
    handleSignOut,
    refreshActivity,
  } = useSettings();

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
      <SettingsHeader />

      <div style={{ padding: "0 20px" }}>
        <OuraSettingsSection
          ouraConnected={ouraConnected}
          ouraLastSync={ouraLastSync}
          testOuraConnection={testOuraConnection}
        />

        <AISettingsSection
          aiKey={aiKey}
          setAIKey={setAIKey}
          aiSaving={aiSaving}
          saveAIKey={saveAIKey}
        />

        <NotificationSettingsSection
          mealReminders={mealReminders}
          setMealReminders={setMealReminders}
          breakfastTime={breakfastTime}
          setBreakfastTime={setBreakfastTime}
          lunchTime={lunchTime}
          setLunchTime={setLunchTime}
          dinnerTime={dinnerTime}
          setDinnerTime={setDinnerTime}
          feedbackReminder={feedbackReminder}
          setFeedbackReminder={setFeedbackReminder}
          notifSaving={notifSaving}
          saveNotifications={saveNotifications}
        />

        <HealthProfileSection
          age={age}
          setAge={setAge}
          heightFt={heightFt}
          setHeightFt={setHeightFt}
          heightIn={heightIn}
          setHeightIn={setHeightIn}
          ethnicity={ethnicity}
          setEthnicity={setEthnicity}
          profileSaving={profileSaving}
          saveHealthProfile={saveHealthProfile}
        />

        <AccountSettingsSection
          weightUnit={weightUnit}
          saveWeightUnit={saveWeightUnit}
          stats={stats}
          clearSession={clearSession}
        />

        <DangerZoneSection
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          deleting={deleting}
          handleDeleteAll={handleDeleteAll}
          handleSignOut={handleSignOut}
        />
      </div>
    </div>
  );
}
