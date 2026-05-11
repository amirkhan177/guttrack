"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  hashPin,
  storePinSession,
  clearSession,
  incrementPinAttempts,
} from "@/lib/crypto";
import { setupPushNotifications } from "@/lib/notifications";

type PinMode = "entry" | "setup" | "confirm";

export default function PinPage() {
  const router = useRouter();
  const [mode, setMode] = useState<PinMode>("entry");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [shake, setShake] = useState(false);
  const [dotsColor, setDotsColor] = useState("#7EB8A4");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      setMode(user.user_metadata?.pin_hash ? "entry" : "setup");
      setLoading(false);
    }
    init();
  }, [router]);

  const triggerShake = useCallback((color = "#FF6B6B") => {
    setDotsColor(color);
    setShake(true);
    setTimeout(() => { setShake(false); setDotsColor("#7EB8A4"); }, 600);
  }, []);

  const handleDigit = useCallback(async (digit: string) => {
    const currentPin = mode === "confirm" ? confirmPin : pin;
    const setter = mode === "confirm" ? setConfirmPin : setPin;
    if (currentPin.length >= 4) return;
    const next = currentPin + digit;
    setter(next);
    if (next.length < 4) return;

    const supabase = createSupabaseBrowserClient();

    if (mode === "setup") {
      setPin(next);
      setMode("confirm");
      return;
    }

    if (mode === "confirm") {
      if (next !== pin) {
        setError("PINs do not match");
        triggerShake();
        setTimeout(() => { setConfirmPin(""); setPin(""); setMode("setup"); setError(""); }, 800);
        return;
      }
      const hash = await hashPin(next);
      await supabase.auth.updateUser({ data: { pin_hash: hash } });
      storePinSession(next);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await setupPushNotifications(user.id);
      router.replace("/dashboard");
      return;
    }

    // entry mode
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth"); return; }
    const hash = await hashPin(next);
    if (hash === user.user_metadata?.pin_hash) {
      storePinSession(next);
      router.replace("/dashboard");
    } else {
      const attempts = incrementPinAttempts();
      if (attempts >= 10) {
        clearSession();
        await supabase.auth.signOut();
        router.replace("/auth");
        return;
      }
      setError(`INCORRECT PIN · ${10 - attempts} ATTEMPTS REMAINING`);
      triggerShake();
      setTimeout(() => { setPin(""); setError(""); }, 800);
    }
  }, [mode, pin, confirmPin, router, triggerShake]);

  const handleDelete = useCallback(() => {
    if (mode === "confirm") setConfirmPin(p => p.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  }, [mode]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0A0A0F" }}>
        <div style={{ fontSize: 32 }}>⚕</div>
      </div>
    );
  }

  const currentPin = mode === "confirm" ? confirmPin : pin;
  const title = mode === "setup" ? "CREATE A PIN" : mode === "confirm" ? "CONFIRM YOUR PIN" : "WELCOME BACK";
  const subtitle = mode === "setup" ? "Your PIN encrypts all your data" : mode === "confirm" ? "Enter your PIN again" : "";
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      minHeight: "100vh", padding: "48px 24px", background: "#0A0A0F",
    }}>
      {/* Top: logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚕</div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, color: "#e8e8f0", margin: 0 }}>GutTrack</h1>
      </div>

      {/* Middle: dots + keypad */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "SF Mono, monospace", fontSize: 11, letterSpacing: "0.15em", color: "#7EB8A4", marginBottom: 4 }}>
            {title}
          </p>
          {subtitle && <p style={{ fontSize: 12, color: "#666" }}>{subtitle}</p>}
        </div>

        {/* Dot indicators */}
        <div style={{
          display: "flex", gap: 20,
          animation: shake ? "shake 0.5s ease-in-out" : "none",
        }}>
          <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 10%,30%,50%,70%,90%{transform:translateX(-8px)} 20%,40%,60%,80%{transform:translateX(8px)} }`}</style>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: "50%",
              background: i < currentPin.length ? dotsColor : "transparent",
              border: `2px solid ${i < currentPin.length ? dotsColor : "#333"}`,
              transition: "all 0.15s",
            }} />
          ))}
        </div>

        {error && (
          <p style={{ fontFamily: "SF Mono, monospace", fontSize: 11, color: "#FF6B6B", textAlign: "center" }}>
            {error}
          </p>
        )}

        {/* Keypad grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
          width: "100%", maxWidth: 280,
        }}>
          {keys.map((key, idx) => {
            if (key === "") {
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {mode === "entry" && <span style={{ fontSize: 24, opacity: 0.4 }}>🪪</span>}
                </div>
              );
            }
            if (key === "del") {
              return (
                <button key={idx} onClick={handleDelete} style={{
                  width: 70, height: 70, margin: "0 auto", borderRadius: "50%",
                  background: "#15151f", color: "#e8e8f0", border: "1px solid #1e1e2e",
                  fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>⌫</button>
              );
            }
            return (
              <button key={idx} onClick={() => handleDigit(key)} style={{
                width: 70, height: 70, margin: "0 auto", borderRadius: "50%",
                background: "#15151f", color: "#e8e8f0", border: "1px solid #1e1e2e",
                fontSize: 22, fontWeight: 300, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{key}</button>
            );
          })}
        </div>
      </div>

      {/* Bottom: label */}
      <p style={{ fontFamily: "SF Mono, monospace", fontSize: 10, letterSpacing: "0.2em", color: "#1e1e2e" }}>
        AES-256 ENCRYPTED
      </p>
    </div>
  );
}
