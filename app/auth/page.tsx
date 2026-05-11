"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/pin` },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6"
      style={{ background: "#0A0A0F" }}
    >
      <div className="w-full" style={{ maxWidth: "340px" }}>
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">⚕</div>
          <h1
            className="text-3xl mb-2"
            style={{ fontFamily: "Georgia, serif", color: "#e8e8f0" }}
          >
            GutTrack
          </h1>
          <p
            className="text-sm"
            style={{ fontFamily: "SF Mono, monospace", color: "#666" }}
          >
            Your personal gut health AI
          </p>
        </div>

        {sent ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "#15151f", border: "1px solid #1e1e2e" }}
          >
            <div className="text-4xl mb-3">📬</div>
            <p
              className="text-base font-medium mb-1"
              style={{ color: "#7EB8A4" }}
            >
              Sent! Check your email
            </p>
            <p className="text-xs" style={{ color: "#666" }}>
              Click the link in your email to continue
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-4 rounded-2xl text-base outline-none transition-all"
                style={{
                  background: "#15151f",
                  border: "1.5px solid #1e1e2e",
                  color: "#e8e8f0",
                  fontFamily: "SF Mono, monospace",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "#7EB8A4")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "#1e1e2e")
                }
              />
            </div>

            {error && (
              <p
                className="text-xs text-center"
                style={{ color: "#FF6B6B", fontFamily: "SF Mono, monospace" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-4 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: "transparent",
                border: "1.5px solid #7EB8A4",
                color: "#7EB8A4",
                fontFamily: "SF Mono, monospace",
                opacity: loading || !email ? 0.5 : 1,
              }}
            >
              {loading ? "SENDING..." : "SEND MAGIC LINK"}
            </button>
          </form>
        )}

        <p
          className="text-center text-xs mt-8"
          style={{ color: "#333", fontFamily: "SF Mono, monospace" }}
        >
          AES-256 ENCRYPTED · NO PASSWORD STORED
        </p>
      </div>
    </div>
  );
}
