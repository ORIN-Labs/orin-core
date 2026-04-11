"use client";

/**
 * ORIN Core — Personal AI Concierge App
 * ======================================
 * Restructured per Adjustment.md:
 * - Individual user experience (not hotel management)
 * - Wallet login (Phantom/Coinbase)
 * - Personal onboarding flow
 * - Assistant-first interface
 * - Real blockchain integration via Hash-Lock workflow
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Brain,
  Fingerprint,
  ChevronRight,
  Home,
  Thermometer,
  Lightbulb,
  Music,
  Shield,
  Check,
  MapPin,
  Clock,
  Zap,
  Send,
  ChevronLeft,
  Settings,
  User,
  Mic,
  MicOff,
  Wallet,
  Sparkles,
  Globe,
  Star,
  ArrowRight,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Coffee,
  LogOut,
  Activity,
  MessageSquare,
  Camera,
} from "lucide-react";
import { cn } from "../lib/utils";

// Wallet & Solana Hooks
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { transcribeAudio, fetchFastVoiceReply, fetchDeviceStatus, fetchTtsAudio } from "../lib/api";
import { saveManualPreferences, saveVoicePreferences, getRelayOpts } from "../lib/savePreferences";
import { getProgram, getProvider, initializeGuestOnChain, fetchGuestProfile, getConnection } from "../lib/solana";
import { deriveGuestPda, ORIN_PROGRAM_ID } from "../lib/pda";
import idl from "../../idl/orin_identity.json";

// --- Theme Context ---
const ThemeContext = React.createContext<{ theme: "dark" | "light"; toggleTheme: () => void }>({
  theme: "dark",
  toggleTheme: () => {},
});

export const useTheme = () => React.useContext(ThemeContext);

// Dynamic imports for wallet components (SSR-incompatible)
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

// --- Types ---

type View = "landing" | "onboarding" | "dashboard";
type DashboardTab = "home" | "assistant" | "control" | "profile";

// --- Logo ---

const Logo = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 800 800"
    className={cn("w-12 h-12", className)}
  >
    <path d="M0 0L800 0L800 800L0 800L0 0Z" fill="transparent"/>
    <g transform="matrix(1.7 0 0 1.7 -267 -438)">
      <path d="M289.333 452.901C289.691 450.36 290.282 447.371 290.876 444.851C297.134 417.654 313.959 394.067 337.636 379.302C361.664 364.349 390.715 359.749 418.185 366.548C446.847 374.627 468.432 390.973 483.721 416.916C497.092 439.605 497.745 472.576 496.479 498.613C496.815 535.146 497.487 576.636 496.317 612.838C504.746 617.675 507.147 619.235 516.725 621.689C524.711 623.734 562.854 620.099 566.245 623.718C565.996 626.021 563.423 626.26 561.39 626.32C554.135 626.534 546.865 626.236 539.594 626.227L491.541 626.212L293.318 626.181L248.682 626.146C243.139 626.17 222.518 627.366 219.108 624.25C221.166 621.213 244.353 622.101 248.652 622.084L299.494 621.853L505.945 622.15C491.712 615.107 477.643 607.937 462.741 602.279C407.484 581.297 346.545 574.153 287.763 578.888C278.2 579.659 257.547 581.239 248.572 583.091L246.38 581.92C260.42 578.892 274.355 577.112 288.581 575.288C288.738 550.009 288.711 524.729 288.5 499.45C288.466 483.671 288.196 468.672 289.333 452.901Z" fill="#000000" />
      <defs>
        <linearGradient id="gradient_0" gradientUnits="userSpaceOnUse" x1="367.52817" y1="684.8429" x2="451.23749" y2="480.24564">
          <stop offset="0" stopColor="#80663C"/>
          <stop offset="1" stopColor="#C4A97A"/>
        </linearGradient>
      </defs>
      <path fill="url(#gradient_0)" d="M289.333 452.901C290.342 453.038 292.73 453.434 293.627 453.46C292.274 469.185 293.124 477.695 292.948 492.94C292.514 520.283 292.381 547.63 292.55 574.977C308.155 574.268 323.56 573.299 339.186 574.121C367.102 575.589 396.059 578.55 423.058 585.984L423.062 500.692C423.051 492.925 422.331 467.089 423.583 460.669C423.849 464.009 423.868 465.701 423.708 469.051C442.211 474.979 457.132 486.796 474.064 495.984C478.311 498.289 491.237 505.849 495.593 504.029C495.826 502.243 495.692 499.612 496.479 498.613C496.815 535.146 497.487 576.636 496.317 612.838C504.746 617.675 507.147 619.235 516.725 621.689C524.711 623.734 562.854 620.099 566.245 623.718C565.996 626.021 563.423 626.26 561.39 626.32C554.135 626.534 546.865 626.236 539.594 626.227L491.541 626.212L293.318 626.181L248.682 626.146C243.139 626.17 222.518 627.366 219.108 624.25C221.166 621.213 244.353 622.101 248.652 622.084L299.494 621.853L505.945 622.15C491.712 615.107 477.643 607.937 462.741 602.279C407.484 581.297 346.545 574.153 287.763 578.888C278.2 579.659 257.547 581.239 248.572 583.091L246.38 581.92C260.42 578.892 274.355 577.112 288.581 575.288C288.738 550.009 288.711 524.729 288.5 499.45C288.466 483.671 288.196 468.672 289.333 452.901Z"/>
      <defs>
        <linearGradient id="gradient_1" gradientUnits="userSpaceOnUse" x1="391.8938" y1="478.52383" x2="420.37872" y2="367.02933">
          <stop offset="0" stopColor="#CDB080"/>
          <stop offset="1" stopColor="#FFE0B2"/>
        </linearGradient>
      </defs>
      <path fill="url(#gradient_1)" d="M289.333 452.901C289.691 450.36 290.282 447.371 290.876 444.851C297.134 417.654 313.959 394.067 337.636 379.302C361.664 364.349 390.715 359.749 418.185 366.548C446.847 374.627 468.432 390.973 483.721 416.916C497.092 439.605 497.745 472.576 496.479 498.613C495.692 499.612 495.826 502.243 495.593 504.029C491.237 505.849 478.311 498.289 474.064 495.984C457.132 486.796 442.211 474.979 423.708 469.051C423.868 465.701 423.849 464.009 423.583 460.669C423.053 439.017 441.508 416.7 460.773 408.544C464.009 407.174 467.188 406.01 470.509 404.875C453.044 385.587 440.873 377.276 415.193 369.954C386.707 364.337 361.948 368.251 337.158 384.31C316.322 397.808 299.555 422.121 294.756 446.619C294.294 448.884 293.917 451.166 293.627 453.46C292.73 453.434 290.342 453.038 289.333 452.901Z"/>
      <path fill="#77613E" d="M248.572 583.091C239.736 584.279 229.876 587.206 221.989 588.022C224.859 586.171 242.308 582.632 246.38 581.92L248.572 583.091Z"/>
    </g>
  </svg>
);

// --- Shared UI Components ---

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
  const { theme } = useTheme();
  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { scale: 1.01, backgroundColor: "var(--card-hover)" } : {}}
      whileTap={onClick ? { scale: 0.99 } : {}}
      className={cn(
        "border border-border rounded-2xl p-6 transition-all relative overflow-hidden",
        theme === "light" ? "bg-white text-text-primary" : "bg-card text-text-primary",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

const StatusBadge = ({ active, label }: { active: boolean; label: string }) => {
  const { theme } = useTheme();
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.3em] backdrop-blur-sm",
      active
        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
        : theme === "light" 
          ? "bg-white border-border text-text-muted" 
          : "bg-card/50 border-border text-text-muted"
    )}>
      <div className={cn(
        "w-1.5 h-1.5 rounded-full",
        active ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-text-muted/40"
      )} />
      {label}
    </div>
  );
};

// ============================================================
// LANDING PAGE — Wallet Connect
// ============================================================

const LandingPage = ({ onConnect }: { onConnect: () => void }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as any } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen flex flex-col items-center justify-center p-6 md:p-12 max-w-2xl mx-auto text-center"
    >
      <motion.div variants={itemVariants} className="flex flex-col items-center space-y-6 md:space-y-8">
        <Logo className="w-24 h-24 md:w-32 md:h-32 mb-2" />
        <div className="space-y-3 md:space-y-4">
          <h1 className="text-6xl md:text-8xl font-light tracking-tighter font-serif leading-none">ORIN</h1>
          <p className="text-accent font-mono text-[9px] md:text-xs uppercase tracking-[0.4em] md:tracking-[0.6em] font-bold">Your Personal AI Concierge</p>
          <p className="text-text-secondary text-base md:text-xl font-light font-serif opacity-40 italic mt-4">
            Every space knows your song.
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="w-full max-w-[280px] xs:max-w-sm space-y-6 mt-10 md:mt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="[&>button]:w-full [&>button]:justify-center [&>button]:h-12 md:[&>button]:h-14 [&>button]:rounded-xl md:[&>button]:rounded-2xl">
            <WalletMultiButton />
          </div>
          <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest px-8">
            Connect with Phantom or Coinbase
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-16 md:mt-24 grid grid-cols-1 xs:grid-cols-3 gap-8 md:gap-12 w-full max-w-lg">
        {[
          { icon: Brain, label: "AI Agent" },
          { icon: Fingerprint, label: "On-Chain Identity" },
          { icon: Shield, label: "Privacy First" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2 md:gap-3 opacity-25 hover:opacity-100 transition-opacity duration-500">
            <item.icon className="w-[18px] h-[18px] md:w-5 md:h-5 text-text-primary" />
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-muted">{item.label}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
};

// ============================================================
// ONBOARDING FLOW — Register name to wallet
// ============================================================

const OnboardingFlow = ({ onComplete, onBack }: { onComplete: (name: string) => void; onBack: () => void }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");

  const slides = [
    {
      icon: Sparkles,
      title: "Meet ORIN",
      desc: "Your personal AI concierge that remembers your preferences and adapts every environment to you.",
      detail: "Powered by Solana blockchain for portable, self-sovereign identity.",
    },
    {
      icon: Brain,
      title: "How it works",
      desc: "Tell ORIN what you want, by voice or text. It learns your preferences and adjusts your space automatically.",
      detail: "Climate, lighting, music. All personalized, all remembered.",
    },
    {
      icon: Fingerprint,
      title: "Your identity",
      desc: "Register your name to create a portable identity on Solana. Your preferences travel with you.",
      detail: "Privacy-first: only a hash of your data lives on-chain.",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const handleBack = () => {
    if (step === 0) {
      onBack();
    } else {
      setStep(step - 1);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen flex flex-col items-center justify-center p-6 xs:p-10 max-w-lg mx-auto relative overflow-hidden"
    >
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-text-muted hover:text-accent transition-colors z-50 group"
      >
        <div className="w-10 h-10 rounded-full bg-card/50 border border-border flex items-center justify-center group-hover:border-accent/40 transition-all">
          <ChevronLeft size={18} />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] hidden xs:inline">Back</span>
      </button>

      <AnimatePresence mode="wait">
        {step < 3 ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full text-center space-y-6 md:space-y-8"
          >
            <Logo className="w-8 h-8 mx-auto opacity-30" />

            <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-accent/10 flex items-center justify-center text-accent mx-auto">
              {React.createElement(slides[step].icon, { size: 28 })}
            </div>
            <div className="space-y-3 md:space-y-4 px-2">
              <h2 className="text-3xl md:text-4xl font-light font-serif leading-tight">{slides[step].title}</h2>
              <p className="text-text-secondary text-sm md:text-base leading-relaxed">{slides[step].desc}</p>
              <p className="text-accent/50 font-mono text-[9px] md:text-[10px] uppercase tracking-widest">{slides[step].detail}</p>
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 justify-center pt-2 md:pt-4">
              {slides.map((_, i) => (
                <div key={i} className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  i === step ? "bg-accent w-5" : "bg-border/50"
                )} />
              ))}
            </div>

            <button
              onClick={() => setStep(step + 1)}
              className="w-full xs:w-auto bg-accent text-[#332F2E] px-10 py-3.5 md:py-3 rounded-xl font-bold md:font-medium hover:bg-accent-light transition-all accent-glow text-sm"
            >
              {step < 2 ? "Continue" : "Register Identity"} <ArrowRight size={14} className="inline ml-1" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-8 px-2"
          >
            <div className="text-center space-y-4">
              <Logo className="w-12 h-12 md:w-16 md:h-16 mx-auto" />
              <h2 className="text-3xl font-light font-serif leading-tight">Identity Registration</h2>
              <p className="text-text-muted text-sm leading-relaxed px-4">
                What should we call you? This name will be encrypted onto your Solana identity.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-text-muted text-[9px] font-mono uppercase tracking-[0.2em] ml-1">Legal Name / Alias</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onComplete(name.trim()); }}
                placeholder="e.g. Satoshi"
                autoFocus
                className="w-full bg-input-bg border border-border rounded-xl py-4 px-4 text-base md:text-sm focus:outline-none focus:border-accent/50 transition-colors shadow-inner"
              />
            </div>

            <button
              onClick={() => { if (name.trim()) onComplete(name.trim()); }}
              disabled={!name.trim()}
              className={cn(
                "w-full py-4.5 md:py-4 rounded-xl font-bold transition-all text-sm md:text-base",
                name.trim()
                  ? "bg-accent text-[#332F2E] accent-glow"
                  : "bg-card/50 text-text-muted/40 cursor-not-allowed border border-border/50"
              )}
            >
              Initialize Identity →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================
// DASHBOARD — Main App (post-login)
// ============================================================

const Dashboard = ({
  guestName,
  guestEmail,
  walletAddress,
  profileData,
  isProfileLoading,
  setProfileData,
  onLogout,
  theme,
  toggleTheme
}: {
  guestName: string;
  guestEmail: string;
  walletAddress: string;
  profileData: any;
  isProfileLoading: boolean;
  setProfileData: (data: any) => void;
  onLogout: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [target_temp_c, setTargetTempC] = useState(22);
  const [brightness, setBrightness] = useState(60);
  const [lightingMode, setLightingMode] = useState<"warm" | "cold" | "ambient">("warm");
  const [musicOn, setMusicOn] = useState(true);
  const [musicTrack, setMusicTrack] = useState("Midnight in Tokyo");
  const [isRecording, setIsRecording] = useState(false);
  const [nestMode, setNestMode] = useState("HEAT");
  const [hueColor, setHueColor] = useState("#C4A97A");
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  // Anti-Flicker Guard: Prevents stale ground-truth from overwriting recent user changes
  const lastInteractionRef = useRef<number>(0);
  const setInteractionTimestamp = () => { lastInteractionRef.current = Date.now(); };
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "orin"; text: string}>>([
    { role: "orin", text: `Welcome, ${guestName}. I'm ORIN, your personal AI concierge. How can I help you today?` },
  ]);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Load profile image from local storage on mount
  useEffect(() => {
    const savedImg = localStorage.getItem(`orin_profile_img_${walletAddress}`);
    if (savedImg) setProfileImage(savedImg);
  }, [walletAddress]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for local storage reliability
        alert("Image too large. Please select an image under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfileImage(base64String);
        localStorage.setItem(`orin_profile_img_${walletAddress}`, base64String);
      };
      reader.readAsDataURL(file);
    }
  };
  const [chatInput, setChatInput] = useState("");
  const [activeRequests, setActiveRequests] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wallet = useWallet();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Memoized PDA Authority — ensures consistency across all syncs and listeners
  const guestPda = useMemo(() => {
    if (!wallet.publicKey) return null;
    return deriveGuestPda(guestName, wallet.publicKey).pda;
  }, [guestName, wallet.publicKey]);

  const playAudio = async (base64: string, mimeType: string) => {
    try {
      const audio = new Audio("data:" + mimeType + ";base64," + base64);
      await audio.play();
    } catch (e) {
      console.warn("[ORIN] Audio play blocked or failed. User interaction might be required.", e);
    }
  };

  /**
   * Consolidates all Dashboard UI updates from AI (flat) or Backend ground-truth (nested).
   * Ensures visual sliders always match the internal state logic exactly.
   */
  const syncUIState = useCallback((state: any) => {
    if (!state) return;
    
    // Pessimistic Guard: Skip ground-truth if user recently interacted (3s quiet period)
    const isRecentInteraction = Date.now() - lastInteractionRef.current < 3000;

    // 1. Handle Nested Device Status structure (RoomDeviceState)
    if (state.nest?.target_temp_c !== undefined && !isRecentInteraction) setTargetTempC(Number(state.nest.target_temp_c));
    if (state.nest?.mode !== undefined && !isRecentInteraction) setNestMode(state.nest.mode);
    
    if (state.hue?.brightness !== undefined && !isRecentInteraction) setBrightness(Number(state.hue.brightness));
    if (state.hue?.color !== undefined && !isRecentInteraction) setHueColor(state.hue.color);
    
    if (state.lighting !== undefined && !isRecentInteraction) setLightingMode(state.lighting);
    
    // 2. Handle Flat AI Response structure (OrinAgentOutput)
    // AI responses are triggered by user interaction, so we allow them through
    if (state.temp !== undefined) setTargetTempC(Number(state.temp));
    if (state.brightness !== undefined) setBrightness(Number(state.brightness));
    if (state.lighting !== undefined) setLightingMode(state.lighting);
    if (state.musicOn !== undefined) setMusicOn(!!state.musicOn);

    // Common fields
    if (state.musicOn !== undefined || state.music !== undefined) {
      setMusicOn(state.musicOn ?? !!state.music);
    }
    if (state.music && typeof state.music === "string") {
      setMusicTrack(state.music);
    }
    if (state.services && Array.isArray(state.services)) {
      setActiveRequests(prev => [...new Set([...prev, ...state.services])]);
    }
  }, []);

  /**
   * Refreshes dashboard from the live backend device state.
   */
  const refreshGroundTruth = useCallback(async () => {
    if (!walletAddress || !guestPda) return;
    try {
      const status = await fetchDeviceStatus(guestPda.toBase58());
      syncUIState(status);
    } catch (e) {
      console.warn("[ORIN] Failed to fetch ground truth device status", e);
    }
  }, [walletAddress, guestPda, syncUIState]);

  // Initial and periodic ground-truth sync
  useEffect(() => {
    refreshGroundTruth();
    
    // Initial welcome announcement using the production-grade TTS pipeline
    const playWelcome = async () => {
        try {
            const welcome = await fetchTtsAudio(`Welcome to your private residence, ${guestName}. I am ORIN, your personal AI concierge. All systems are online.`);
            playAudio(welcome.audioBase64, welcome.mimeType);
        } catch (e) {
            console.warn("[ORIN] Failed to play property welcome", e);
        }
    };
    playWelcome();

    const interval = setInterval(refreshGroundTruth, 30000); // 30s ground-truth sync
    return () => clearInterval(interval);
  }, [refreshGroundTruth, guestName]);

  // On-chain state listener (WebSocket)
  useEffect(() => {
    if (!profileData || !walletAddress || !guestPda) return;
    try {
      const conn = getConnection();
      const subId = conn.onAccountChange(guestPda, async (accInfo) => {
        console.log("[ORIN] On-chain profile change detected. Re-syncing...");
        const provider = getProvider(wallet);
        const program = getProgram(provider, idl as any);
        const profile = await fetchGuestProfile(program, guestPda);
        if (profile) setProfileData(profile);
      }, "confirmed");
      return () => {
        conn.removeAccountChangeListener(subId);
      };
    } catch (e) {
      console.warn("[ORIN] Failed to setup WebSocket listener", e);
    }
  }, [profileData, walletAddress, guestPda, wallet, setProfileData]);

  const handleTextSend = () => {
    if (!chatInput.trim()) return;
    handleVoiceCommand(chatInput.trim());
    setChatInput("");
  };

  const handleVoiceCommand = async (text: string) => {
    if (!text.trim() || !wallet.publicKey) return;
    setIsProcessingVoice(true);
    
    setChatInput("");
    // Push the text to UI instantly if it wasn't already pushed by the audio transcriber
    setChatMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === "user" && lastMsg.text === text) return prev; // Avoid dupes from Voice
        return [...prev, { role: "user", text }];
    });
    setChatMessages((prev) => [...prev, { role: "orin", text: `I'll adjust that for you right away, ${guestName}. Processing your request...` }]);

    try {
      // 1. Fire /voice-fast FIRST — get instant subtitle + audio
      const chatHistory = chatMessages.slice(-6).map(m => m.text);
      const currentPoints = profileData?.loyaltyPoints ?? profileData?.loyalty_points;
      const initialPrefs = { target_temp_c, lighting: lightingMode, brightness, musicOn };
      
      const fastResult = await fetchFastVoiceReply({
        userInput: text,
        guestContext: { 
          name: guestName, 
          loyaltyPoints: currentPoints?.toNumber?.() || Number(currentPoints) || 0, 
          history: chatHistory,
          currentPreferences: initialPrefs
        }
      });

      // 2. Instantly render the text subtitle from voice-fast
      if (fastResult.text) {
        setChatMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { role: "orin", text: fastResult.text! };
          return newMsgs;
        });
      }

      // 3. Play audio (non-blocking)
      if (fastResult.audioBase64) {
        playAudio(fastResult.audioBase64, fastResult.mimeType);
      }

      // 3b. Sync UI state instantly if fast leg returned intent
      let activePrefs = { ...initialPrefs, services: [], raw_response: "" };
      if (fastResult.aiResult) {
        syncUIState(fastResult.aiResult);
        // Merge fast results into the payload for the heavy leg to prevent state overwrite
        activePrefs = { ...activePrefs, ...fastResult.aiResult };
      }

      // 4. Only trigger the heavier /voice-command + Solana flow if fastIntent === true
      if (fastResult.fastIntent && guestPda) {
        const provider = getProvider(wallet);
        const program = getProgram(provider, idl as any);
        
        const res = await saveVoicePreferences(
        program,
        guestPda,
        wallet.publicKey!,
        text,
        activePrefs,
        { 
          name: guestName, 
          loyaltyPoints: currentPoints?.toNumber?.() || Number(currentPoints) || 0, 
          history: chatHistory,
          currentPreferences: activePrefs
        },
        guestName,
          (asyncText: string) => {
            setChatMessages((prev) => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = { role: "orin", text: asyncText };
              return newMsgs;
            });
          }
        );
        
        // Update local React state from AI interpretation to keep UI in sync
        if (res.aiResult) {
          syncUIState(res.aiResult);
        }

        // Append signature silently to chat if it was required
        const sigStr = res.solanaTxSignature;
        if (sigStr) {
          setChatMessages((prev) => {
            const newMsgs = [...prev];
            const currentText = newMsgs[newMsgs.length - 1].text;
            newMsgs[newMsgs.length - 1] = { role: "orin", text: `${currentText} (Signature: ${sigStr.slice(0, 8)}...)` };
            return newMsgs;
          });
        }
      }
    } catch (e: any) {
      setChatMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: "orin", text: `API Error: ${e.message}` };
        return newMsgs;
      });
    } finally {
      setIsProcessingVoice(false);
      refreshGroundTruth();
    }
  };

  const handleSaveSetup = async () => {
    if (!wallet.publicKey || !guestPda) return;
    setIsSaving(true);
    setInteractionTimestamp();
    try {
      const provider = getProvider(wallet);
      const program = getProgram(provider, idl as any);

      const res = await saveManualPreferences(
        program,
        guestPda,
        wallet.publicKey,
        { target_temp_c, lighting: lightingMode, brightness, musicOn, services: [], raw_response: "" },
        { 
          name: guestName, 
          loyaltyPoints: profileData?.loyaltyPoints?.toNumber?.() || Number(profileData?.loyaltyPoints) || 0, 
          history: [],
          currentPreferences: { target_temp_c, lighting: lightingMode, brightness, musicOn }
        },
        guestName
      );
      const sigText = res.solanaTxSignature ? `\n\nTX Signature: ${res.solanaTxSignature.slice(0,12)}...` : ``;
      alert(`Success: Environment preferences synchronized.\n\nTransaction was subsidized by ORIN Relay (Gasless).${sigText}`);
    } catch (e: any) {
      alert(`Error saving setup: ${e.message}`);
    } finally {
      setIsSaving(false);
      refreshGroundTruth();
    }
  };

  const handleInitializeIdentity = async () => {
    if (!wallet.publicKey) return;
    setIsSaving(true);
    try {
      const { pda, identifierHash } = deriveGuestPda(guestName, wallet.publicKey);
      const provider = getProvider(wallet);
      const program = getProgram(provider, idl as any);

      const sig = await initializeGuestOnChain(
        program,
        pda,
        wallet.publicKey,
        identifierHash,
        guestName,
        getRelayOpts()
      );
      
      alert(`Identity Created: ${sig.slice(0, 10)}...`);
      setProfileData({ isInitialized: true, stayCount: 0, loyaltyPoints: 0 });
    } catch (e: any) {
      alert(`Error initializing identity: ${e.message}`);
    } finally {
      setIsSaving(false);
      refreshGroundTruth(); // Confirm backend/MQTT state is in sync after manual change
    }
  };

  const handleCheckout = async () => {
    alert("Checkout UI Active. Requesting endpoint from backend...");
    // This will be wired up once the backend dev provides the endpoint.
  };

  const startRecording = () => setIsRecording(true);
  const stopRecording = () => setIsRecording(false);

  useEffect(() => {
    let active = true;

    if (isRecording) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        if (!active) {
            // User stopped clicking while we were getting permission
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
        recorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          
          setChatMessages((prev) => [...prev, { role: "user", text: "🎙️ (Audio recording)" }]);
          try {
            const text = await transcribeAudio(blob);
            setChatMessages((prev) => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = { role: "user", text };
              return newMsgs;
            });
            handleVoiceCommand(text);
          } catch (e: any) {
            setChatMessages((prev) => [...prev, { role: "orin", text: `Transcription failed: ${e.message}` }]);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }).catch(e => {
          if (active) {
            alert('Microphone access denied or unavailable.');
            setIsRecording(false);
          }
      });
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        // Critical: Stop all tracks to turn off the mic hardware/LED
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }

    return () => {
        active = false;
        // Also cleanup if the whole component unmounts
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [isRecording]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "assistant") {
      scrollToBottom();
    }
  }, [chatMessages, activeTab]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 }
  };

  // Consolidate access to on-chain data with robust camel/snake-case fallbacks
  const pointsRaw = profileData?.loyaltyPoints ?? profileData?.loyalty_points;
  const stayRaw = profileData?.stayCount ?? profileData?.stay_count;

  const loyaltyPoints = pointsRaw?.toString?.() || "0";
  const stayCount = stayRaw || 0;

  // --- HOME TAB ---
  const renderHome = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome Header */}
      <motion.div variants={itemVariants} className="space-y-2">
        <p className="text-accent font-mono text-[10px] uppercase tracking-[0.4em]">Good evening</p>
        <h1 className="text-4xl md:text-5xl font-light font-serif leading-tight">
          Welcome, <span className="text-accent">{guestName}</span>.
        </h1>
      </motion.div>

      {/* Active Requests (Visible only if requests exist) */}
      {activeRequests.length > 0 && (
        <motion.div variants={itemVariants}>
          <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest mb-3">Active Requests</p>
          <div className="space-y-2">
            {activeRequests.map((req, i) => (
              <Card key={i} className="flex items-center justify-between border-accent/20 bg-accent/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <Check size={16} />
                  </div>
                  <span className="text-sm font-medium">{req}</span>
                </div>
                <button 
                  onClick={() => setActiveRequests(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-text-muted hover:text-text-primary transition-colors p-1"
                >
                  <ChevronRight size={16} />
                </button>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* ORIN Status */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <StatusBadge active={true} label="ORIN Active" />
        <StatusBadge active={true} label="Preferences Synced" />
      </motion.div>

      {/* Preference Recording Indicator */}
      <motion.div variants={itemVariants}>
        <Card className="bg-accent/5 border-accent/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Activity size={20} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Your preferences are being recorded</p>
            <p className="text-text-muted text-xs">ORIN learns from every interaction to personalize your experience</p>
          </div>
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-accent"
          />
        </Card>
      </motion.div>

      {/* Environmental Data */}
      <motion.div variants={itemVariants}>
        <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest mb-3">Environment</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Thermometer, label: "Climate", value: `${target_temp_c}°C · ${nestMode}`, color: "text-accent" },
            { icon: Lightbulb, label: "Lighting", value: lightingMode, color: "text-accent" },
            { icon: Music, label: "Ambient", value: musicOn ? "Playing" : "Off", color: "text-accent" },
            { icon: Shield, label: "Privacy", value: "Active", color: "text-emerald-500" },
          ].map((item) => (
            <Card key={item.label} className="space-y-2 md:space-y-3 p-3 md:p-4">
              <item.icon size={16} className={item.color} />
              <div>
                <p className="text-text-muted text-[8px] md:text-[9px] uppercase tracking-widest leading-tight">{item.label}</p>
                <p className="font-bold text-base md:text-lg capitalize">{item.value}</p>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card onClick={() => setActiveTab("assistant")} className="flex items-center gap-4 p-4 md:p-5 group hover:border-accent/30 transition-all cursor-pointer">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-[#332F2E] transition-all duration-500 flex-shrink-0">
              <MessageSquare className="w-5 h-5 md:w-[22px] md:h-[22px]" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Talk to ORIN</h4>
              <p className="text-text-muted text-[10px] md:text-xs">Voice or text</p>
            </div>
          </Card>
          <Card onClick={() => setActiveTab("control")} className="flex items-center gap-4 p-4 md:p-5 group hover:border-accent/30 transition-all cursor-pointer">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-[#332F2E] transition-all duration-500 flex-shrink-0">
              <Zap className="w-5 h-5 md:w-[22px] md:h-[22px]" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Room Control</h4>
              <p className="text-text-muted text-[10px] md:text-xs">Manual adjustments</p>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants}>
        <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest mb-3">Your ORIN Stats</p>
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-4">
            <p className="text-2xl font-bold text-accent font-mono">{loyaltyPoints}</p>
            <p className="text-text-muted text-[9px] uppercase tracking-widest mt-1">ORIN Points</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-2xl font-bold font-mono">{stayCount}</p>
            <p className="text-text-muted text-[9px] uppercase tracking-widest mt-1">Activations</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-2xl font-bold font-mono text-emerald-500">✓</p>
            <p className="text-text-muted text-[9px] uppercase tracking-widest mt-1">Verified</p>
          </Card>
        </div>
      </motion.div>
    </motion.div>
  );

  // --- ASSISTANT TAB ---
  const renderAssistant = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col h-[calc(100dvh-150px)] md:h-[calc(100vh-160px)]"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-2 pb-2 border-b border-border/30">
        <div>
          <h2 className="text-lg md:text-xl font-light font-serif">ORIN Assistant</h2>
          <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest">AI Concierge</p>
        </div>
        <div className="flex items-center gap-2">
           <StatusBadge active={true} label={isRecording ? "Recording" : "Live"} />
        </div>
      </motion.div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-6 px-1">
        {chatMessages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div className={cn(
              "px-4 py-3 rounded-2xl max-w-[85%] shadow-sm",
              msg.role === "orin"
                ? "bg-card border border-border text-text-primary rounded-tl-none font-light leading-relaxed"
                : "bg-accent text-[#332F2E] font-medium rounded-tr-none shadow-accent/10"
            )}>
              <p className="text-sm md:text-base">{msg.text}</p>
            </div>
          </motion.div>
        ))}
        {isProcessingVoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex gap-1.5 px-4 py-3 bg-card border border-border/50 rounded-2xl">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  className="w-1.5 h-1.5 rounded-full bg-accent/40"
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area — Fixed at bottom of container */}
      <motion.div variants={itemVariants} className="pt-3 border-t border-border -mx-1">
        <div className="flex items-center gap-2 bg-input-bg rounded-2xl p-1.5 border border-border focus-within:border-accent/40 transition-all">
          <input
            type="text"
            placeholder="Tell ORIN..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chatInput.trim()) {
                handleTextSend();
              }
            }}
            className="flex-1 bg-transparent border-none outline-none px-3 text-sm md:text-base"
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "p-2.5 rounded-xl transition-all",
              isRecording ? "bg-red-500 text-white animate-pulse" : "text-text-muted hover:text-accent hover:bg-accent/10"
            )}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={handleTextSend}
            disabled={!chatInput.trim()}
            className="p-2.5 bg-accent text-[#332F2E] rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  // --- CONTROL TAB ---
  const renderControl = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h2 className="text-xl md:text-2xl font-light font-serif">Room Control</h2>
        <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest">Manual environment adjustments</p>
      </motion.div>

      {/* Scene Presets */}
      <motion.div variants={itemVariants}>
        <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest mb-3">Scene Presets</p>
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {[
            { name: "Relax", icon: Moon, temp: 23, bright: 40, light: "warm" as const },
            { name: "Focus", icon: Zap, temp: 21, bright: 85, light: "cold" as const },
            { name: "Sleep", icon: Coffee, temp: 19, bright: 10, light: "ambient" as const },
          ].map((scene) => (
            <Card
              key={scene.name}
              onClick={() => {
                setTargetTempC(scene.temp);
                setBrightness(scene.bright);
                setLightingMode(scene.light);
              }}
              className={cn(
                "flex flex-col items-center gap-2 md:gap-3 p-3 md:p-5 transition-all cursor-pointer",
                lightingMode === scene.light 
                  ? "border-accent bg-accent/20 accent-glow shadow-accent/20" 
                  : "border-border hover:bg-card-hover"
              )}
            >
              <scene.icon size={20} className={lightingMode === scene.light ? "text-accent" : "text-text-muted"} />
              <span className={cn("font-bold text-[10px] md:text-xs uppercase tracking-widest", lightingMode === scene.light ? "text-accent" : "text-text-secondary")}>
                {scene.name}
              </span>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Temperature & Brightness — Combined for better vertical scrolling */}
      <motion.div variants={itemVariants} className="space-y-4">
        <Card className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Temp Control */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-accent">
                <Thermometer size={18} />
                <span className="font-bold text-sm md:text-base uppercase tracking-wider">Climate</span>
              </div>
              <span className="text-xl md:text-2xl font-mono font-bold">{target_temp_c}°C</span>
            </div>
            <div className="pt-2 px-1">
              <input
                type="range" min={16} max={30} step={0.5} value={target_temp_c}
                onChange={(e) => setTargetTempC(parseFloat(e.target.value))}
                className="w-full accent-accent h-2 rounded-lg cursor-pointer bg-border appearance-none"
              />
            </div>
          </div>

          <div className="h-px bg-border/20 mx-2" />

          {/* Brightness Control */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-accent">
                <Lightbulb size={18} />
                <span className="font-bold text-sm md:text-base uppercase tracking-wider">Brightness</span>
              </div>
              <span className="text-xl md:text-2xl font-mono font-bold">{brightness}%</span>
            </div>
            <div className="pt-2 px-1">
              <input
                type="range" min={0} max={100} step={1} value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-full accent-accent h-2 rounded-lg cursor-pointer bg-border appearance-none"
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Music */}
      <motion.div variants={itemVariants}>
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-accent">
              <Music size={20} />
              <span className="font-bold text-base">Ambient Music</span>
            </div>
            <button
              onClick={() => setMusicOn(!musicOn)}
              className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-500",
                musicOn ? "bg-accent" : "bg-card-hover border border-border"
              )}
            >
              <motion.div
                animate={{ x: musicOn ? 24 : 2 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-background"
              />
            </button>
          </div>
          {musicOn && (
            <div className="flex items-center gap-4">
              <Volume2 size={18} className="text-accent" />
              <div className="flex-1">
                <p className="font-bold text-sm truncate">{musicTrack}</p>
                <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest">Lo-fi Ambient</p>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={itemVariants} className="relative">
        <button
          onClick={handleSaveSetup}
          disabled={isSaving}
          className={cn(
            "w-full py-4 rounded-xl font-bold transition-all text-sm relative overflow-hidden group border",
            isSaving
              ? "bg-card/50 text-text-muted/50 cursor-not-allowed border-border"
              : "bg-accent text-[#332F2E] accent-glow hover:scale-[1.02] active:scale-[0.98] border-accent"
          )}
        >
          {isSaving ? "Syncing to Solana..." : "Save my setup →"}
          {!isSaving && (
            <div className="absolute top-0 right-0 bg-accent/10 text-accent px-2 py-0.5 text-[8px] uppercase tracking-tighter rounded-bl-lg font-mono font-bold">
              Gasless Sync
            </div>
          )}
        </button>
      </motion.div>
    </motion.div>
  );

  // --- PROFILE TAB ---
  const renderProfile = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 border-border p-8 flex flex-col items-center space-y-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-accent/10 border-2 border-accent/20 flex items-center justify-center text-accent text-4xl font-bold overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                guestName.charAt(0).toUpperCase()
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent text-[#332F2E] flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100">
              <Camera size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-bold">{guestName}</h3>
            <p className="text-text-muted text-xs font-mono">{walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}</p>
          </div>
          {isProfileLoading ? (
            <div className="flex items-center gap-2 bg-card/80 text-text-muted text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-border animate-pulse">
              <Activity size={12} className="animate-spin" /> Syncing with Solana...
            </div>
          ) : profileData ? (
            <div className="flex items-center gap-2 bg-accent/10 text-accent text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-accent/20">
              <Shield size={12} /> ORIN Identity Verified
            </div>
          ) : (
            <button
              onClick={handleInitializeIdentity}
              disabled={isSaving}
              className="flex items-center gap-2 bg-card border border-border text-text-muted text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest hover:bg-card-hover transition-colors"
            >
              <Shield size={12} /> {isSaving ? "Initializing..." : "Create On-Chain Identity"}
            </button>
          )}
          <p className="text-text-muted text-[10px] uppercase tracking-widest">
            {stayCount} activations · <span className="text-accent">{loyaltyPoints}</span> pts
          </p>
          <button
            onClick={handleCheckout}
            className="text-accent text-[10px] font-bold uppercase tracking-widest hover:underline mt-2"
          >
            Finalize Stay & Redeem Rewards →
          </button>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest mb-3">Saved Preferences</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Thermometer, label: "Sleep Temp", value: "19°C" },
            { icon: Lightbulb, label: "Lighting", value: "Warm" },
            { icon: Music, label: "Music", value: "Ambient" },
            { icon: Globe, label: "Region", value: "Global" },
          ].map((pref) => (
            <Card key={pref.label} className="p-4 space-y-2">
              <pref.icon size={16} className="text-accent" />
              <p className="text-text-muted text-[9px] uppercase tracking-widest">{pref.label}</p>
              <p className="font-bold">{pref.value}</p>
            </Card>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <p className="text-text-muted text-[10px] font-mono uppercase tracking-widest mb-3">On-Chain Identity</p>
        <Card className="space-y-3 p-6">
          <div className="flex justify-between items-center">
            <span className="text-text-muted text-xs">Wallet</span>
            <span className="font-mono text-xs text-text-secondary">{walletAddress.slice(0, 12)}...{walletAddress.slice(-8)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted text-xs">Network</span>
            <span className="text-accent font-mono text-xs">Solana Devnet</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted text-xs">Program</span>
            <span className="font-mono text-[10px] text-text-muted">FqtrH...boYk</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted text-xs">Status</span>
            <span className="text-emerald-500 font-mono text-xs font-bold">Authenticated</span>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="p-6 text-center space-y-3">
          <p className="text-text-muted text-[10px] uppercase tracking-widest">
            Your data is encrypted and stored on Solana.<br />
            Owned by you. Portable across every ORIN space.
          </p>
          <Logo className="w-8 h-8 mx-auto opacity-30" />
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3 text-text-muted hover:text-red-400 transition-colors text-sm"
        >
          <LogOut size={16} /> Disconnect Wallet
        </button>
      </motion.div>
    </motion.div>
  );

  // --- Tab Renderer ---
  const renderContent = () => {
    switch (activeTab) {
      case "home": return renderHome();
      case "assistant": return renderAssistant();
      case "control": return renderControl();
      case "profile": return renderProfile();
    }
  };

  const tabs: Array<{ id: DashboardTab; icon: any; label: string }> = [
    { id: "home", icon: Home, label: "Home" },
    { id: "assistant", icon: MessageSquare, label: "ORIN" },
    { id: "control", icon: Zap, label: "Control" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col overflow-hidden">
      {/* Top Bar — Refactored for Mobile */}
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border/50 flex-shrink-0 bg-background/80 backdrop-blur-md z-[60]">
        <div className="flex items-center gap-2 md:gap-3">
          <Logo className="w-7 h-7 md:w-8 md:h-8" />
          <div className="flex flex-col">
            <span className="text-text-secondary text-[10px] md:text-sm font-bold uppercase tracking-wider leading-none">ORIN</span>
            <span className="text-accent font-mono text-[8px] md:text-[9px] uppercase tracking-widest mt-0.5 animate-pulse truncate max-w-[80px] md:max-w-none">
              {guestPda ? `ROOM_${guestPda.toBase58().slice(0, 4)}` : "ROOM_INIT"}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-card border border-border text-text-muted hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="hidden xs:block">
            <StatusBadge active={true} label="ORIN Active" />
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 md:p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area — Viewport Hardened */}
      <div className={cn(
        "flex-1 max-w-2xl mx-auto w-full no-scrollbar relative",
        activeTab === "assistant" 
          ? "h-[calc(100dvh-120px)] md:h-[calc(100vh-160px)] overflow-hidden flex flex-col px-4 md:px-6" 
          : "overflow-y-auto p-4 md:p-6 pb-32 md:pb-48"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${theme}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(activeTab === "assistant" && "flex-1 flex flex-col")}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Nav — Refined for Premium Mobile Feel */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-2xl border-t border-border/50 pb-safe z-[60]">
        <div className="flex justify-around items-center max-w-2xl mx-auto px-4 py-2 md:py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all relative group py-2 md:py-1 px-4 rounded-2xl active:bg-accent/5",
                activeTab === tab.id ? "text-accent" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <tab.icon size={20} className={cn("transition-all duration-300", activeTab === tab.id ? "scale-110 drop-shadow-[0_0_8px_var(--color-accent)]" : "group-hover:scale-110")} />
              <span className={cn("text-[8px] md:text-[9px] font-mono uppercase tracking-[0.2em] transition-all", activeTab === tab.id ? "opacity-100" : "opacity-60")}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]"
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP — State Machine
// ============================================================

export default function App() {
  const { connected, publicKey, disconnect } = useWallet();
  const wallet = useAnchorWallet();
  const [view, setView] = useState<View>("landing");
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [profileData, setProfileData] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [hasAttemptedSync, setHasAttemptedSync] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Load theme from local storage as early as possible
  useEffect(() => {
    const savedTheme = localStorage.getItem("orin_theme") as "dark" | "light";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("light", savedTheme === "light");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("orin_theme", newTheme);
    document.documentElement.classList.toggle("light", newTheme === "light");
  };

  // Boot animation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsLoading(false), 500);
          return 100;
        }
        return prev + 3;
      });
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Detect wallet connection → navigate to onboarding or dashboard
  useEffect(() => {
    if (!isLoading && connected && publicKey && wallet) {
      const addr = publicKey.toBase58();
      setWalletAddress(addr);

      // Check if returning user
      const savedName = localStorage.getItem("orin_guest_name");
      if (savedName) {
        setGuestName(savedName);
        setView("dashboard");
      } else if (view === "landing") {
        setView("onboarding");
      }
    }
  }, [isLoading, connected, publicKey, wallet]);

  const syncProfile = useCallback(async (nameOverride?: string) => {
    if (!connected || !publicKey || !wallet) return;
    
    setIsProfileLoading(true);
    try {
      const name = nameOverride || localStorage.getItem("orin_guest_name") || "";
      const { pda } = deriveGuestPda(name, publicKey);
      const provider = getProvider(wallet);
      const program = getProgram(provider, idl as any);
      const profile = await fetchGuestProfile(program, pda);
      
      if (profile) {
        setProfileData(profile);
        if (profile.name && profile.name !== name) {
          setGuestName(profile.name);
          localStorage.setItem("orin_guest_name", profile.name);
        }
      }
    } catch (e) {
      console.error("Profile sync failed", e);
    } finally {
      setIsProfileLoading(false);
    }
  }, [connected, publicKey, wallet]);

  // Initial Sync — Fixed to avoid infinite RPC retries
  useEffect(() => {
    if (connected && publicKey && wallet && !profileData && !isProfileLoading && !hasAttemptedSync) {
      setHasAttemptedSync(true);
      syncProfile();
    }
  }, [connected, publicKey, wallet, syncProfile, profileData, isProfileLoading, hasAttemptedSync]);

  // Detect wallet disconnect → go back to landing
  useEffect(() => {
    if (!isLoading && !connected && view !== "landing") {
      setView("landing");
    }
  }, [connected, isLoading]);

  const handleOnboardingComplete = (name: string) => {
    setGuestName(name);
    localStorage.setItem("orin_guest_name", name);
    setView("dashboard");
    syncProfile(name);
  };

  const handleLogout = () => {
    localStorage.removeItem("orin_guest_name");
    localStorage.removeItem("orin_guest_email");
    setGuestName("");
    setGuestEmail("");
    setProfileData(null);
    setHasAttemptedSync(false);
    disconnect();
    setView("landing");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center space-y-8"
        >
          <Logo className="w-32 h-32" />
          <div className="w-48 h-1 bg-border/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-text-muted font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse">
            Initializing ORIN
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="min-h-screen bg-background text-text-primary selection:bg-accent selection:text-text-primary relative overflow-hidden">
        <div className="relative z-10 flex flex-col min-h-screen">
          <AnimatePresence mode="wait">
          {view === "landing" && (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LandingPage onConnect={() => setView("onboarding")} />
            </motion.div>
          )}
          {view === "onboarding" && (
            <motion.div key="onboarding" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <OnboardingFlow onComplete={handleOnboardingComplete} onBack={() => { disconnect(); setView("landing"); }} />
            </motion.div>
          )}
          {view === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <Dashboard
                guestName={guestName}
                guestEmail={guestEmail}
                walletAddress={walletAddress}
                profileData={profileData}
                isProfileLoading={isProfileLoading}
                setProfileData={setProfileData}
                onLogout={handleLogout}
                theme={theme}
                toggleTheme={toggleTheme}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </ThemeContext.Provider>
  );
}
