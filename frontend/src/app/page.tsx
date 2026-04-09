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

import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import { cn } from "../lib/utils";

// Wallet & Solana Hooks
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { transcribeAudio, fetchFastVoiceReply } from "../lib/api";
import { saveManualPreferences, saveVoicePreferences, getRelayOpts } from "../lib/savePreferences";
import { getProgram, getProvider, initializeGuestOnChain, fetchGuestProfile } from "../lib/solana";
import { deriveGuestPda, ORIN_PROGRAM_ID } from "../lib/pda";
import idl from "../../idl/orin_identity.json";

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
      <path d="M289.333 452.901C289.691 450.36 290.282 447.371 290.876 444.851C297.134 417.654 313.959 394.067 337.636 379.302C361.664 364.349 390.715 359.749 418.185 366.548C446.847 374.627 468.432 390.973 483.721 416.916C497.092 439.605 497.745 472.576 496.479 498.613C496.815 535.146 497.487 576.636 496.317 612.838C504.746 617.675 507.147 619.235 516.725 621.689C524.711 623.734 562.854 620.099 566.245 623.718C565.996 626.021 563.423 626.26 561.39 626.32C554.135 626.534 546.865 626.236 539.594 626.227L491.541 626.212L293.318 626.181L248.682 626.146C243.139 626.17 222.518 627.366 219.108 624.25C221.166 621.213 244.353 622.101 248.652 622.084L299.494 621.853L505.945 622.15C491.712 615.107 477.643 607.937 462.741 602.279C407.484 581.297 346.545 574.153 287.763 578.888C278.2 579.659 257.547 581.239 248.572 583.091L246.38 581.92C260.42 578.892 274.355 577.112 288.581 575.288C288.738 550.009 288.711 524.729 288.5 499.45C288.466 483.671 288.196 468.672 289.333 452.901Z" fill="#222"/>
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

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <motion.div
    onClick={onClick}
    whileHover={onClick ? { scale: 1.02, backgroundColor: "#161616" } : {}}
    whileTap={onClick ? { scale: 0.98 } : {}}
    className={cn(
      "bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-6 transition-all relative overflow-hidden",
      onClick && "cursor-pointer",
      className
    )}
  >
    {children}
  </motion.div>
);

const StatusBadge = ({ active, label }: { active: boolean; label: string }) => (
  <div className={cn(
    "flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.3em] backdrop-blur-sm",
    active
      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
      : "bg-zinc-900/50 border border-zinc-800 text-zinc-500"
  )}>
    <div className={cn(
      "w-1.5 h-1.5 rounded-full",
      active ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-zinc-600"
    )} />
    {label}
  </div>
);

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
      <motion.div variants={itemVariants} className="flex flex-col items-center space-y-8">
        <Logo className="w-28 h-28 md:w-36 md:h-36" />
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-light tracking-tighter font-serif">ORIN</h1>
          <p className="text-accent font-mono text-[10px] md:text-xs uppercase tracking-[0.5em]">Your Personal AI Concierge</p>
          <p className="text-zinc-400 text-lg md:text-xl font-light font-serif opacity-60">
            Every space knows your song.
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="w-full max-w-sm space-y-6 mt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="[&>button]:w-full [&>button]:justify-center">
            <WalletMultiButton />
          </div>
          <p className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
            Connect with Phantom or Coinbase
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-16 grid grid-cols-3 gap-8 w-full max-w-lg">
        {[
          { icon: Brain, label: "AI Agent" },
          { icon: Fingerprint, label: "On-Chain Identity" },
          { icon: Shield, label: "Privacy First" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-3 opacity-40">
            <item.icon size={20} className="text-accent" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{item.label}</span>
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
      detail: "Temperature, lighting, music. All personalized, all remembered.",
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
      className="min-h-screen flex flex-col items-center justify-center p-6 max-w-lg mx-auto"
    >
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-zinc-500 hover:text-accent transition-colors z-50 group"
      >
        <div className="w-9 h-9 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center group-hover:border-accent/40 transition-all">
          <ChevronLeft size={18} />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:inline">Back</span>
      </button>

      <AnimatePresence mode="wait">
        {step < 3 ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full text-center space-y-8"
          >
            {/* Logo at top of every slide */}
            <Logo className="w-10 h-10 mx-auto opacity-30" />

            <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center text-accent mx-auto">
              {React.createElement(slides[step].icon, { size: 32 })}
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-light font-serif">{slides[step].title}</h2>
              <p className="text-zinc-400 text-base leading-relaxed">{slides[step].desc}</p>
              <p className="text-accent/50 font-mono text-[10px] uppercase tracking-widest">{slides[step].detail}</p>
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 justify-center pt-4">
              {slides.map((_, i) => (
                <div key={i} className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === step ? "bg-accent w-6" : "bg-zinc-800"
                )} />
              ))}
            </div>

            <button
              onClick={() => setStep(step + 1)}
              className="bg-accent text-black px-8 py-3 rounded-xl font-medium hover:bg-accent-light transition-all accent-glow text-sm"
            >
              {step < 2 ? "Next" : "Set Up Profile"} <ArrowRight size={14} className="inline ml-1" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-8"
          >
            <div className="text-center space-y-4">
              <Logo className="w-16 h-16 mx-auto" />
              <h2 className="text-3xl font-light font-serif">What should we call you?</h2>
              <p className="text-zinc-500 text-sm">
                This name will be linked to your wallet identity on Solana.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onComplete(name.trim()); }}
                placeholder="e.g. Shalom"
                autoFocus
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            <button
              onClick={() => { if (name.trim()) onComplete(name.trim()); }}
              disabled={!name.trim()}
              className={cn(
                "w-full py-4 rounded-xl font-bold transition-all text-sm",
                name.trim()
                  ? "bg-accent text-black accent-glow hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
              )}
            >
              Create ORIN Identity →
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
  onLogout
}: {
  guestName: string;
  guestEmail: string;
  walletAddress: string;
  profileData: any;
  isProfileLoading: boolean;
  setProfileData: (data: any) => void;
  onLogout: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [temperature, setTemperature] = useState(22);
  const [brightness, setBrightness] = useState(60);
  const [lightingMode, setLightingMode] = useState<"warm" | "cold" | "ambient">("warm");
  const [musicOn, setMusicOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "orin"; text: string}>>([
    { role: "orin", text: `Welcome, ${guestName}. I'm ORIN, your personal AI concierge. How can I help you today?` },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [activeRequests, setActiveRequests] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wallet = useWallet();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const playAudio = async (base64: string, mimeType: string) => {
    try {
      const audio = new Audio("data:" + mimeType + ";base64," + base64);
      await audio.play();
    } catch (e) {
      console.warn("[ORIN] Audio play blocked or failed. User interaction might be required.", e);
    }
  };

  const handleVoiceCommand = async (text: string) => {
    if (!text.trim() || !wallet.publicKey) return;
    
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
      const fastResult = await fetchFastVoiceReply({
        userInput: text,
        guestContext: { name: guestName, loyaltyPoints: currentPoints?.toNumber?.() || Number(currentPoints) || 0, history: chatHistory }
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

      // 4. Only trigger the heavier /voice-command + Solana flow if fastIntent === true
      if (fastResult.fastIntent) {
        const guestPda = deriveGuestPda(guestName, wallet.publicKey).pda;
        const provider = getProvider(wallet);
        const program = getProgram(provider, idl as any);
        
          const currentPoints = profileData?.loyaltyPoints ?? profileData?.loyalty_points;
          const res = await saveVoicePreferences(
            program,
            guestPda,
            wallet.publicKey,
            text,
            { temp: temperature, lighting: lightingMode, brightness, musicOn, services: [], raw_response: "" },
            { name: guestName, loyaltyPoints: currentPoints?.toNumber?.() || Number(currentPoints) || 0, history: chatHistory },
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
          if (res.aiResult.temp !== undefined) setTemperature(Number(res.aiResult.temp));
          if (res.aiResult.lighting !== undefined) setLightingMode(res.aiResult.lighting);
          if (res.aiResult.brightness !== undefined) setBrightness(Number(res.aiResult.brightness));
          if (res.aiResult.musicOn !== undefined) setMusicOn(Boolean(res.aiResult.musicOn));
          
          // Handle service requests from AI
          if (res.aiResult.services && Array.isArray(res.aiResult.services) && res.aiResult.services.length > 0) {
            setActiveRequests(prev => [...new Set([...prev, ...res.aiResult.services])]);
          }
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
    }
  };

  const handleSaveSetup = async () => {
    if (!wallet.publicKey) return;
    setIsSaving(true);
    try {
      const guestPda = deriveGuestPda(guestName, wallet.publicKey).pda;
      const provider = getProvider(wallet);
      const program = getProgram(provider, idl as any);

      const res = await saveManualPreferences(
        program,
        guestPda,
        wallet.publicKey,
        { temp: temperature, lighting: lightingMode, brightness, musicOn, services: [], raw_response: "" },
        { name: guestName, loyaltyPoints: profileData?.loyaltyPoints?.toNumber?.() || Number(profileData?.loyaltyPoints) || 0, history: [] },
        guestName
      );
      const sigText = res.solanaTxSignature ? `\nSignature: ${res.solanaTxSignature.slice(0,10)}...` : ``;
      alert(`Success: Environment applied.${sigText}`);
    } catch (e: any) {
      alert(`Error saving setup: ${e.message}`);
    } finally {
      setIsSaving(false);
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
    }
  };

  const handleCheckout = async () => {
    alert("Checkout UI Active. Requesting endpoint from backend...");
    // This will be wired up once the backend dev provides the endpoint.
  };

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
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Active Requests</p>
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
                  className="text-zinc-500 hover:text-white transition-colors p-1"
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
            <p className="text-zinc-500 text-xs">ORIN learns from every interaction to personalize your experience</p>
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
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Environment</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Thermometer, label: "Temperature", value: `${temperature}°C`, color: "text-accent" },
            { icon: Lightbulb, label: "Lighting", value: lightingMode, color: "text-accent" },
            { icon: Music, label: "Ambient", value: musicOn ? "Playing" : "Off", color: "text-accent" },
            { icon: Shield, label: "Privacy", value: "Active", color: "text-emerald-500" },
          ].map((item) => (
            <Card key={item.label} className="space-y-3 p-4">
              <item.icon size={18} className={item.color} />
              <div>
                <p className="text-zinc-500 text-[9px] uppercase tracking-widest">{item.label}</p>
                <p className="font-bold text-lg capitalize">{item.value}</p>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          <Card onClick={() => setActiveTab("assistant")} className="flex items-center gap-4 p-5 group hover:border-accent/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-black transition-all duration-500">
              <MessageSquare size={22} />
            </div>
            <div>
              <h4 className="font-bold text-sm">Talk to ORIN</h4>
              <p className="text-zinc-500 text-xs">Voice or text</p>
            </div>
          </Card>
          <Card onClick={() => setActiveTab("control")} className="flex items-center gap-4 p-5 group hover:border-accent/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-black transition-all duration-500">
              <Zap size={22} />
            </div>
            <div>
              <h4 className="font-bold text-sm">Room Control</h4>
              <p className="text-zinc-500 text-xs">Manual adjustments</p>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants}>
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Your ORIN Stats</p>
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-4">
            <p className="text-2xl font-bold text-accent font-mono">{loyaltyPoints}</p>
            <p className="text-zinc-500 text-[9px] uppercase tracking-widest mt-1">ORIN Points</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-2xl font-bold font-mono">{stayCount}</p>
            <p className="text-zinc-500 text-[9px] uppercase tracking-widest mt-1">Activations</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-2xl font-bold font-mono text-emerald-500">✓</p>
            <p className="text-zinc-500 text-[9px] uppercase tracking-widest mt-1">Verified</p>
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
      className="flex flex-col h-[calc(100svh-140px)] md:h-[calc(100vh-160px)]"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-3 py-1 border-b border-zinc-900/30">
        <div>
          <h2 className="text-lg md:text-xl font-light font-serif">ORIN Assistant</h2>
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">AI Concierge</p>
        </div>
        <StatusBadge active={true} label="Live" />
      </motion.div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-4 pr-1">
        {chatMessages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn("flex gap-3", msg.role === "user" && "justify-end")}
          >
            {msg.role === "orin" && (
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <Brain size={16} />
              </div>
            )}
            <div className={cn(
              "p-4 rounded-2xl max-w-[80%]",
              msg.role === "orin"
                ? "bg-emerald-500/5 border border-emerald-500/10 rounded-tl-none"
                : "bg-accent text-[#332F2E] rounded-tr-none"
            )}>
              <p className="text-sm">{msg.text}</p>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice / Text Input */}
      <motion.div variants={itemVariants} className="pt-4 border-t border-zinc-900">
        <div className="flex flex-col md:flex-row md:items-center gap-4 lg:gap-6">
          {/* Voice Toggle */}
          <div className="flex items-center gap-3 justify-center md:justify-start shrink-0">
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={cn(
                "w-12 h-12 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all",
                isRecording
                  ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                  : "bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20"
              )}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            {isRecording && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-[10px] font-mono uppercase tracking-widest"
              >
                Listening...
              </motion.p>
            )}
          </div>

          {/* Text Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tell ORIN what you want..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chatInput.trim()) {
                  handleVoiceCommand(chatInput);
                }
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-5 pr-14 text-sm focus:outline-none focus:border-accent/50 transition-colors"
            />
            <button
              onClick={() => {
                if (chatInput.trim()) {
                  handleVoiceCommand(chatInput);
                }
              }}
              className="absolute right-1.5 top-1.5 w-8 h-8 md:w-9 md:h-9 rounded-lg bg-accent flex items-center justify-center text-[#332F2E] hover:bg-accent-light transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
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
        <h2 className="text-2xl font-light font-serif">Room Control</h2>
        <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Manual environment adjustments</p>
      </motion.div>

      {/* Scene Presets */}
      <motion.div variants={itemVariants}>
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Scene Presets</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: "Relax", icon: Moon, temp: 23, bright: 40, light: "warm" as const },
            { name: "Focus", icon: Zap, temp: 21, bright: 85, light: "cold" as const },
            { name: "Sleep", icon: Coffee, temp: 19, bright: 10, light: "ambient" as const },
          ].map((scene) => (
            <Card
              key={scene.name}
              onClick={() => {
                setTemperature(scene.temp);
                setBrightness(scene.bright);
                setLightingMode(scene.light);
              }}
              className={cn(
                "flex flex-col items-center gap-3 p-4 transition-all",
                lightingMode === scene.light ? "border-accent bg-accent/10" : "hover:bg-zinc-900/50"
              )}
            >
              <scene.icon size={20} className="text-accent" />
              <span className="font-bold text-xs">{scene.name}</span>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Temperature */}
      <motion.div variants={itemVariants}>
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-accent">
              <Thermometer size={20} />
              <span className="font-bold text-base">Temperature</span>
            </div>
            <span className="text-2xl font-mono font-bold">{temperature}°C</span>
          </div>
          <input
            type="range" min={16} max={30} step={0.5} value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-[#C4A97A]"
          />
        </Card>
      </motion.div>

      {/* Brightness */}
      <motion.div variants={itemVariants}>
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-accent">
              <Lightbulb size={20} />
              <span className="font-bold text-base">Brightness</span>
            </div>
            <span className="text-2xl font-mono font-bold">{brightness}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={1} value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value))}
            className="w-full accent-[#C4A97A]"
          />
          <div className="grid grid-cols-3 gap-2">
            {(["warm", "cold", "ambient"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLightingMode(mode)}
                className={cn(
                  "text-[10px] font-mono uppercase tracking-widest py-2.5 rounded-xl transition-all",
                  lightingMode === mode ? "bg-accent text-black font-bold" : "bg-zinc-900/50 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                {mode}
              </button>
            ))}
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
                musicOn ? "bg-accent" : "bg-zinc-800"
              )}
            >
              <motion.div
                animate={{ x: musicOn ? 24 : 2 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-black"
              />
            </button>
          </div>
          {musicOn && (
            <div className="flex items-center gap-4">
              <Volume2 size={18} className="text-accent" />
              <div>
                <p className="font-bold text-sm">Midnight in Tokyo</p>
                <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Lo-fi Ambient</p>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={itemVariants}>
        <button
          onClick={handleSaveSetup}
          disabled={isSaving}
          className={cn(
            "w-full py-4 rounded-xl font-bold transition-all text-sm",
            isSaving
              ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
              : "bg-accent text-black accent-glow hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          {isSaving ? "Saving to blockchain..." : "Save my setup →"}
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
        <Card className="bg-zinc-900/50 border-zinc-800 p-8 flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center text-accent text-4xl font-bold">
            {guestName.charAt(0).toUpperCase()}
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-bold">{guestName}</h3>
            <p className="text-zinc-500 text-xs font-mono">{walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}</p>
          </div>
          {isProfileLoading ? (
            <div className="flex items-center gap-2 bg-zinc-900 text-zinc-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-zinc-800 animate-pulse">
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
              className="flex items-center gap-2 bg-zinc-800 text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 transition-colors"
            >
              <Shield size={12} /> {isSaving ? "Initializing..." : "Create On-Chain Identity"}
            </button>
          )}
          <p className="text-zinc-600 text-[10px] uppercase tracking-widest">
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
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Saved Preferences</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Thermometer, label: "Sleep Temp", value: "19°C" },
            { icon: Lightbulb, label: "Lighting", value: "Warm" },
            { icon: Music, label: "Music", value: "Ambient" },
            { icon: Globe, label: "Region", value: "Global" },
          ].map((pref) => (
            <Card key={pref.label} className="p-4 space-y-2">
              <pref.icon size={16} className="text-accent" />
              <p className="text-zinc-500 text-[9px] uppercase tracking-widest">{pref.label}</p>
              <p className="font-bold">{pref.value}</p>
            </Card>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">On-Chain Identity</p>
        <Card className="space-y-3 p-6">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-xs">Wallet</span>
            <span className="font-mono text-xs text-zinc-300">{walletAddress.slice(0, 12)}...{walletAddress.slice(-8)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-xs">Network</span>
            <span className="text-accent font-mono text-xs">Solana Devnet</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-xs">Program</span>
            <span className="font-mono text-[10px] text-zinc-500">FqtrH...boYk</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-xs">Status</span>
            <span className="text-emerald-500 font-mono text-xs font-bold">Authenticated</span>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="p-6 text-center space-y-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-widest">
            Your data is encrypted and stored on Solana.<br />
            Owned by you. Portable across every ORIN space.
          </p>
          <Logo className="w-8 h-8 mx-auto opacity-30" />
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3 text-zinc-500 hover:text-red-400 transition-colors text-sm"
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
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/50">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <span className="text-white/80 text-sm font-bold uppercase tracking-wider">ORIN</span>
        </div>
        <StatusBadge active={true} label="ORIN Active" />
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 max-w-2xl mx-auto w-full no-scrollbar",
        activeTab === "assistant" ? "h-full overflow-hidden flex flex-col px-6" : "overflow-y-auto p-6 pb-24"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(activeTab === "assistant" && "flex-1 flex flex-col")}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-zinc-900/50 px-6 py-3 z-50">
        <div className="flex justify-around max-w-2xl mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all relative group py-1",
                activeTab === tab.id ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <tab.icon size={20} className={cn("transition-transform", activeTab === tab.id && "scale-110")} />
              <span className="text-[9px] font-mono uppercase tracking-widest">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(196,169,122,0.6)]"
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

  // Initial Sync
  useEffect(() => {
    if (connected && publicKey && wallet && !profileData && !isProfileLoading) {
      syncProfile();
    }
  }, [connected, publicKey, wallet, syncProfile, profileData, isProfileLoading]);

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
          <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse">
            Initializing ORIN
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white selection:bg-accent selection:text-black">
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
          <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Dashboard
              guestName={guestName}
              guestEmail={guestEmail}
              walletAddress={walletAddress}
              profileData={profileData}
              isProfileLoading={isProfileLoading}
              setProfileData={setProfileData}
              onLogout={handleLogout}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
