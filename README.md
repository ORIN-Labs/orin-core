# ORIN Core �Y>�️

> **Every space knows your song.**

ORIN is a revolutionary DePIN protocol that recognizes users across physical spaces hotels, homes, and cars and automatically synchronizes their environment to their saved preferences via Solana based identities.

---

## 🏗️ Phase 1: MVP Architecture
- **[On-chain]** **Sovereign Identity:** Anchor-based Guest PDA structure for immutable preference storage.
- **[Middleware]** **Real-time Bridge:** High-performance Node.js & Firebase synchronization for sub-second physical response.
- **[Physical]** **IoT Control:** Integrated Philips Hue & Google Nest control logic (Mocked for Phase 1 Demo).

## 🧩 Modular Layers & Current Status

### 👑 CEO & Product Visionary
**Status:** Active & Scaling by @Shalom

The "Navigator" of ORIN, bridging technical innovation with real-world hospitality business.
- **Business Development:** Leading partnerships with hotel chains and the Solana ecosystem.
- **Fundraising & Growth:** Managing hackathon submissions, VC relations, and grant applications.
- **Product Quality (CPO):** Defining the "Premium & Seamless" brand identity and ensuring the UX meets global hospitality standards.
- **Strategy:** Aligning the "Web2.5" roadmap with long-term market demands.

### 🎨 Frontend Layer (UI/UX)
**Status:** In Progress by @Defidoctor10

The frontend is the "Entry Point" for guests, focusing on high-end animations and seamless Web3 onboarding.
- **Key Tech:** Next.js 15, Tailwind CSS, Framer Motion (for "butter-smooth" animations).
- **Identity:** Integration with Privy/Dynamic for Email-to-Wallet onboarding (Social Login).
- **State Management:** Real-time sync with Solana Devnet via `@solana/web3.js` and our Backend Hub.
- **Deliverables:** Guest Dashboard, Room Control Interface, and Service Booking.

### 🏗️ Backend & Settlement Layer (The Hub)
**Status:** Core Ready by @dex_p (Kyle Meng)

The "Brain" that bridges the physical IoT world with the Solana blockchain.
- **Blockchain:** Solana Program (Anchor Framework) deployed on Devnet.
- **Event Listener:** Real-time monitoring of Program ID: `FqtrHgdYTph1DSP9jDYD7xrKPrjSjCTtnw6fyKMmboYk`.
- **IoT Bridge:** MQTT protocol integration to sync On-chain Preferences to physical hardware (Nest, Hue, etc.).
- **Gas Relayer:** Handling meta-transactions to ensure guests never see a "Gas Fee" error.

### 🧠 AI Intelligence Layer (Concierge)
**Status:** Ready for @federico to implement.

The "Intent Translator" that turns guest natural language into on-chain states.
- **Core Logic:** Gemini 1.5 Flash via LangChain + Deepgram Aura voice.
- **Function:** Mapping *"I'm feeling cold"* -> `Instruction: update_preferences(temp: 24.5)`.
- **Task:** Define System Prompts and response schemas for the "ORIN Concierge".

## 🛠️ Tech Stack
- **L1 & Logic:** `Solana` / `Anchor` / `Rust`
- **Infrastructure:** `Node.js` / `TypeScript` / `Firebase Real-time DB`
- **UI/UX:** `Next.js` / `Tailwind CSS` / `Solana Wallet Adapter`

## 📂 Project Structure
- `programs/` - The source of truth: Smart contracts in Rust.
- `backend/` - The nervous system: Node.js listener and Firebase sync logic.
- `frontend/` - The interface: Web3 dashboard for guest management.
- `docs/` - Architecture diagrams and vision briefs.

## 👥 Core Team
- **Shalom:** Founder & Visionary (10+ years in Hospitality)
- **Kyle Meng:** Technical Lead (Smart Contracts & Backend)
- **Defi Mantle:** Frontend & UI/UX Engineer
- **Federico:** AI & Smart Logic Engineer
- **Victor:** Strategy & M&A

Privacy-First Architecture: ORIN utilizes an Off-Chain Data / On-Chain Verification (Hash-Lock) strategy. Sensitve guest preferences are never stored as plaintext on-chain, ensuring 100% GDPR compliance and E2E privacy.

---
*Built with passion for the Solana Network State Spring 2026 Hackathon.*

## AI Agent (Backend)

The ORIN AI concierge implementation is available at:

- `backend/src/ai_agent.ts`

Full documentation:

- `docs/AI_AGENT_GUIDE.md`

Required backend environment variables:

- `GOOGLE_API_KEY`
- `DEEPGRAM_API_KEY`

Optional:

- `GOOGLE_MODEL`
- `DEEPGRAM_TTS_MODEL`
- `DEEPGRAM_TTS_MODEL`

## Update 2026-03 (Backend Refactor)

This repository now includes a production-oriented backend architecture:

- `backend/src/config/env.ts`: strict env parsing with `zod`
- `backend/src/config/validate_env.ts`: fail-fast startup validation
- `backend/src/shared/constants.ts`: centralized `PROGRAM_ID`, `RPC_ENDPOINT`, Anchor account names
- `backend/src/shared/hash.ts`: shared canonical hashing (`stableStringify` + SHA-256)
- `backend/src/shared/logger.ts`: structured logging (`pino`) with `request_id`
- `backend/src/state/*`: persistence layer via `IStateProvider` + Redis implementation
- `backend/src/api/server.ts`: production API route `POST /api/v1/voice-command`
- `backend/src/listener.ts`: secure gateway (on-chain hash verification -> MQTT -> voice feedback)

New orchestration script:

```bash
cd backend
npm run dev:all
```

Required runtime variables are documented in:

- `.env.example`
- `backend/.env.example`

## Quick Start (Beginner Friendly)

If you are new to the project, follow these exact steps.

### 1. Install dependencies

```bash
npm install
cd backend
npm install
```

### 2. Create environment file

```bash
cd backend
cp .env.example .env
```

If you do not have Redis yet, set:

```env
STATE_PROVIDER=memory
```

### 3. Validate backend config

```bash
cd backend
npm run validate:env
```

### 4. Start backend services

```bash
cd backend
npm run dev:all
```

Expected:

- API running (`/health`)
- Secure Gateway listener running

### 5. Optional simulation

In another terminal:

```bash
cd backend
npm run simulate
```

### 6. Where to read more

- Development flow: `docs/DEVELOPMENT_GUIDE.md`
- Frontend/chain integration: `docs/INTEGRATION_SPEC.md`
- AI agent details: `docs/AI_AGENT_GUIDE.md`


