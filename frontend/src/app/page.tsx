"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const GuestDashboard = dynamic(() => import("@/components/GuestDashboard"), {
  ssr: false,
});

const RoomControl = dynamic(() => import("@/components/RoomControl"), {
  ssr: false,
});

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function Home() {
  const [view, setView] = useState<"dashboard" | "controls">("dashboard");

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Nav ─────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-logo" style={{ cursor: "pointer" }} onClick={() => setView("dashboard")}>
          ORIN<span>.</span>
        </div>
        <WalletMultiButton />
      </nav>

      {/* ── Content ────────────────────────────── */}
      <div style={{ flex: 1, padding: "80px 60px", position: "relative" }}>
        <div className="page-glow" />
        <div style={{ position: "relative" }}>
          {view === "dashboard" ? (
            <GuestDashboard onEnterRoom={() => setView("controls")} />
          ) : (
            <RoomControl />
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="orin-footer">
        <div className="nav-logo" style={{ fontSize: 18 }}>ORIN<span>.</span></div>
        <div className="footer-meta">Solana Devnet · Hash-Lock Privacy</div>
        <div className="footer-copy">© 2026 ORIN Labs</div>
      </footer>
    </main>
  );
}
