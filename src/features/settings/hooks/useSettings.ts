"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getPinFromSession,
  isSessionExpired,
  refreshActivity,
  clearSession,
} from "@/lib/crypto";
import { LoadUserDataUseCase } from "../use-cases/LoadUserDataUseCase";
import { LoadUserStatsUseCase } from "../use-cases/LoadUserStatsUseCase";
import { UpdateSettingsUseCase } from "../use-cases/UpdateSettingsUseCase";
import { OuraSettingsUseCase } from "../use-cases/OuraSettingsUseCase";
import { DeleteUserDataUseCase } from "../use-cases/DeleteUserDataUseCase";

export function useSettings() {
  const router = useRouter();

  // Oura
  const [ouraToken, setOuraToken] = useState("");
  const [ouraConnected, setOuraConnected] = useState(false);
  const [ouraLastSync, setOuraLastSync] = useState<string | null>(null);
  const [ouraSaving, setOuraSaving] = useState(false);
  const [ouraTestResult, setOuraTestResult] = useState<string | null>(null);

  // AI
  const [aiKey, setAIKey] = useState("");
  const [aiSaving, setAISaving] = useState(false);

  // Notifications
  const [mealReminders, setMealReminders] = useState(false);
  const [breakfastTime, setBreakfastTime] = useState("08:00");
  const [lunchTime, setLunchTime] = useState("12:30");
  const [dinnerTime, setDinnerTime] = useState("19:00");
  const [feedbackReminder, setFeedbackReminder] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  // Account
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");

  // Health profile
  const [age, setAge] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Data stats
  const [stats, setStats] = useState<Record<string, number | null>>({
    meals: null,
    supplements: null,
    labs: null,
    insights: null,
    feedback: null,
  });

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Use Cases
  const loadUserDataUC = new LoadUserDataUseCase();
  const loadUserStatsUC = new LoadUserStatsUseCase();
  const updateSettingsUC = new UpdateSettingsUseCase();
  const ouraSettingsUC = new OuraSettingsUseCase();
  const deleteUserDataUC = new DeleteUserDataUseCase();

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
    const data = await loadUserDataUC.execute();
    if (!data) {
      router.replace("/auth");
      return;
    }

    setOuraConnected(data.oura_connected);
    setOuraLastSync(data.oura_last_sync);
    setAIKey(data.ai_api_key);
    setMealReminders(data.meal_reminders);
    setBreakfastTime(data.breakfast_time);
    setLunchTime(data.lunch_time);
    setDinnerTime(data.dinner_time);
    setFeedbackReminder(data.feedback_reminder);
    setWeightUnit(data.weight_unit as "lbs" | "kg");
    setAge(data.age ? String(data.age) : "");
    setEthnicity(data.ethnicity || "");
    
    if (data.height_cm) {
      const totalIn = Math.round(data.height_cm / 2.54);
      setHeightFt(String(Math.floor(totalIn / 12)));
      setHeightIn(String(totalIn % 12));
    }

    const statsData = await loadUserStatsUC.execute();
    if (statsData) {
      setStats(statsData);
    }
  }

  async function saveOuraToken() {
    if (!ouraToken.trim()) return;
    const cleanToken = ouraToken.trim();
    setOuraToken(cleanToken);
    setOuraSaving(true);
    refreshActivity();
    console.log("[settings] Attempting to connect Oura...");
    try {
      await ouraSettingsUC.connect(cleanToken);
      setOuraConnected(true);
      console.log("[settings] Oura connected successfully.");
      alert("Oura Ring connected!");
    } catch (err) {
      console.error("[settings] Oura connection failed:", err);
      alert(err instanceof Error ? err.message : "Failed to connect Oura");
    } finally {
      setOuraSaving(false);
    }
  }

  async function testOuraConnection() {
    setOuraTestResult(null);
    refreshActivity();
    console.log("[settings] Running Oura sync test...");
    try {
      await ouraSettingsUC.sync();
      setOuraTestResult("Connection successful");
      setOuraLastSync(new Date().toISOString());
      console.log("[settings] Oura sync test successful.");
    } catch (err) {
      console.error("[settings] Oura sync test failed:", err);
      setOuraTestResult("Connection failed");
    }
  }

  async function saveAIKey() {
    if (!aiKey.trim()) return;
    setAIKey(aiKey.trim());
    setAISaving(true);
    refreshActivity();
    console.log("[settings] Attempting to save AI API key...");
    try {
      await updateSettingsUC.updateAIKey(aiKey.trim());
      console.log("[settings] AI API key saved successfully.");
      alert("AI API key saved!");
    } catch (err) {
      console.error("[settings] Failed to save AI API key:", err);
      alert("Failed to save AI API key. Check console for details.");
    } finally {
      setAISaving(false);
    }
  }

  async function saveNotifications() {
    setNotifSaving(true);
    refreshActivity();
    try {
      await updateSettingsUC.updateNotifications({
        meal_reminders: mealReminders,
        breakfast_time: breakfastTime,
        lunch_time: lunchTime,
        dinner_time: dinnerTime,
        feedback_reminder: feedbackReminder,
      });
    } finally {
      setNotifSaving(false);
    }
  }

  async function saveWeightUnit(unit: "lbs" | "kg") {
    setWeightUnit(unit);
    refreshActivity();
    await updateSettingsUC.updateWeightUnit(unit);
  }

  async function saveHealthProfile() {
    setProfileSaving(true);
    refreshActivity();
    const heightCm = heightFt || heightIn
      ? Math.round((parseInt(heightFt || "0") * 12 + parseInt(heightIn || "0")) * 2.54)
      : null;
    try {
      await updateSettingsUC.updateHealthProfile({
        age: age ? parseInt(age) : null,
        ethnicity: ethnicity || null,
        height_cm: heightCm,
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      await deleteUserDataUC.execute();
      clearSession();
      router.replace("/auth");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    refreshActivity();
    // We actually just want to sign out, not delete data here.
    // The monolithic code had: 
    // await supabase.auth.signOut();
    // clearSession();
    // router.replace("/auth");
    
    // I should probably add a SignOut method to some use case or just call supabase here.
    // Let's use the supabase from LoadUserDataUseCase for simplicity or just import it.
    const { createSupabaseBrowserClient } = await import("@/lib/supabase");
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    clearSession();
    router.replace("/auth");
  }

  return {
    ouraToken, setOuraToken,
    ouraConnected,
    ouraLastSync,
    ouraSaving,
    ouraTestResult,
    saveOuraToken,
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
  };
}
