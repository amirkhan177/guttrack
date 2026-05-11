"use client";

async function deriveKey(pin: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("guttrack-salt-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`guttrack-pin:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function encryptData(data: string, pin: string): Promise<string> {
  const key = await deriveKey(pin);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode.apply(null, Array.from(combined)));
}

export async function decryptData(
  ciphertext: string,
  pin: string
): Promise<string> {
  const key = await deriveKey(pin);
  const combined = new Uint8Array(
    atob(ciphertext)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}

export function storePinSession(pin: string): void {
  sessionStorage.setItem("gut_pin", pin);
  sessionStorage.setItem("gut_last_activity", Date.now().toString());
  sessionStorage.setItem("gut_pin_attempts", "0");
}

export function getPinFromSession(): string | null {
  return sessionStorage.getItem("gut_pin");
}

export function refreshActivity(): void {
  sessionStorage.setItem("gut_last_activity", Date.now().toString());
}

export function isSessionExpired(): boolean {
  const last = sessionStorage.getItem("gut_last_activity");
  if (!last) return true;
  return Date.now() - parseInt(last) > 5 * 60 * 1000;
}

export function clearSession(): void {
  sessionStorage.removeItem("gut_pin");
  sessionStorage.removeItem("gut_last_activity");
  sessionStorage.removeItem("gut_pin_attempts");
}

export function incrementPinAttempts(): number {
  const current = parseInt(sessionStorage.getItem("gut_pin_attempts") ?? "0");
  const next = current + 1;
  sessionStorage.setItem("gut_pin_attempts", next.toString());
  return next;
}

export function getPinAttempts(): number {
  return parseInt(sessionStorage.getItem("gut_pin_attempts") ?? "0");
}
