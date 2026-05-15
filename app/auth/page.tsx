"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const mono = "SF Mono, ui-monospace, monospace";
const serif = "Georgia, serif";

export default function AuthPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const codeLength = method === "email" ? 8 : 6;

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    
    let result;
    if (method === "email") {
      result = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
    } else {
      result = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true },
      });
    }

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      setCode(new Array(codeLength).fill(""));
      setStep("code");
    }
  }

  async function handleVerify() {
    const token = code.join("");
    if (token.length < codeLength) return;
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    
    let result;
    if (method === "email") {
      result = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
    } else {
      result = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
    }

    setLoading(false);
    if (result.error) {
      setError("Invalid code. Try again.");
      setCode(new Array(codeLength).fill(""));
      inputRefs.current[0]?.focus();
    } else {
      router.replace("/pin");
    }
  }

  function handleCodeInput(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < codeLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== "")) {
      // auto-submit when all filled
      handleVerify();
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, codeLength);
    if (!pasted) return;
    const next = [...code];
    for (let i = 0; i < codeLength; i++) next[i] = pasted[i] ?? "";
    setCode(next);
    const lastFilled = Math.min(pasted.length, codeLength - 1);
    inputRefs.current[lastFilled]?.focus();
  }

  return (
    <div style={{ background: "#0A0A0F", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚕</div>
          <h1 style={{ fontFamily: serif, fontSize: 28, color: "#e8e8f0", margin: 0 }}>GutTrack</h1>
          <p style={{ fontFamily: mono, fontSize: 11, color: "#555", marginTop: 6, letterSpacing: "0.08em" }}>
            YOUR PERSONAL GUT HEALTH AI
          </p>
        </div>

        {step === "identifier" ? (
          <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", background: "#15151f", borderRadius: 12, padding: 4, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setMethod("phone")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 10,
                  border: "none",
                  background: method === "phone" ? "#1e1e2e" : "transparent",
                  color: method === "phone" ? "#7EB8A4" : "#555",
                  fontFamily: mono,
                  fontSize: 10,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                SMS
              </button>
              <button
                type="button"
                onClick={() => setMethod("email")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 10,
                  border: "none",
                  background: method === "email" ? "#1e1e2e" : "transparent",
                  color: method === "email" ? "#7EB8A4" : "#555",
                  fontFamily: mono,
                  fontSize: 10,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                EMAIL
              </button>
            </div>

            {method === "email" ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1.5px solid #1e1e2e",
                  background: "#15151f",
                  color: "#e8e8f0",
                  fontFamily: mono,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#7EB8A4")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e2e")}
              />
            ) : (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15551234567"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1.5px solid #1e1e2e",
                  background: "#15151f",
                  color: "#e8e8f0",
                  fontFamily: mono,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#7EB8A4")}
                onBlur={(e) => (e.target.style.borderColor = "#1e1e2e")}
              />
            )}

            {error && (
              <p style={{ fontFamily: mono, fontSize: 11, color: "#FF6B6B", textAlign: "center" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (method === "email" ? !email : !phone)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                border: "1.5px solid #7EB8A4",
                background: "transparent",
                color: "#7EB8A4",
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.12em",
                cursor: loading || (method === "email" ? !email : !phone) ? "not-allowed" : "pointer",
                opacity: loading || (method === "email" ? !email : !phone) ? 0.4 : 1,
              }}
            >
              {loading ? "SENDING..." : "SEND CODE"}
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: mono, fontSize: 11, color: "#7EB8A4", letterSpacing: "0.1em", marginBottom: 4 }}>
                CODE SENT TO
              </p>
              <p style={{ fontFamily: mono, fontSize: 12, color: "#888" }}>{method === "email" ? email : phone}</p>
            </div>

            {/* OTP input */}
            <div style={{ display: "flex", gap: 6 }} onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeInput(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  autoFocus={i === 0}
                  style={{
                    width: method === "email" ? 34 : 44,
                    height: 52,
                    textAlign: "center",
                    borderRadius: 10,
                    border: `1.5px solid ${digit ? "#7EB8A4" : "#1e1e2e"}`,
                    background: "#15151f",
                    color: "#e8e8f0",
                    fontFamily: mono,
                    fontSize: 20,
                    fontWeight: 700,
                    outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7EB8A4")}
                  onBlur={(e) => (e.target.style.borderColor = digit ? "#7EB8A4" : "#1e1e2e")}
                />
              ))}
            </div>

            {error && (
              <p style={{ fontFamily: mono, fontSize: 11, color: "#FF6B6B", textAlign: "center" }}>{error}</p>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || code.some((d) => !d)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                border: "1.5px solid #7EB8A4",
                background: "transparent",
                color: "#7EB8A4",
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.12em",
                cursor: loading || code.some((d) => !d) ? "not-allowed" : "pointer",
                opacity: loading || code.some((d) => !d) ? 0.4 : 1,
              }}
            >
              {loading ? "VERIFYING..." : "VERIFY"}
            </button>

            <button
              onClick={() => { setStep("identifier"); setCode(new Array(codeLength).fill("")); setError(""); }}
              style={{
                background: "transparent",
                border: "none",
                color: "#555",
                fontFamily: mono,
                fontSize: 11,
                cursor: "pointer",
                letterSpacing: "0.06em",
              }}
            >
              ← use different {method}
            </button>
          </div>
        )}

        <p style={{ fontFamily: mono, fontSize: 9, color: "#2a2a3a", textAlign: "center", marginTop: 40, letterSpacing: "0.08em" }}>
          AES-256 ENCRYPTED · NO PASSWORD STORED
        </p>
      </div>
    </div>
  );
}
