"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", icon: "⚕", label: "HOME" },
  { href: "/log", icon: "✏️", label: "LOG" },
  { href: "/insights", icon: "🧠", label: "INSIGHTS" },
  { href: "/supplements", icon: "💊", label: "SUPPS" },
  { href: "/labs", icon: "🔬", label: "LABS" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 pb-safe"
      style={{
        background: "rgba(10, 10, 15, 0.95)",
        borderTop: "1px solid #1e1e2e",
        backdropFilter: "blur(20px)",
        zIndex: 50,
      }}
    >
      <div className="mx-auto flex items-center justify-around py-2" style={{ maxWidth: 430 }}>
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-1 py-1 px-3 transition-all"
            >
              <span className="text-xl" style={{ filter: active ? "none" : "grayscale(1) opacity(0.4)" }}>
                {tab.icon}
              </span>
              <span
                className="text-xs tracking-widest"
                style={{
                  fontFamily: "SF Mono, monospace",
                  color: active ? "#7EB8A4" : "#444",
                  fontSize: "8px",
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
