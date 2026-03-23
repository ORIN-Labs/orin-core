import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import { getEnv } from "./config/env";
import { PROGRAM_ID, RPC_ENDPOINT } from "./shared/constants";

/**
 * Integration simulator
 * -------------------------------------------------------------
 * Exercises the production-like pipeline:
 * 1) initialize guest account
 * 2) stage command via API route
 * 3) submit on-chain preferences hash update
 *
 * Note:
 * - This is a deterministic test harness, not production ingress.
 */

const IDL_PATH = "../target/idl/orin_identity.json";
const env = getEnv();

async function runSimulation() {
  console.log("ORIN simulation started.\n");

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const connection = new Connection(RPC_ENDPOINT, "confirmed");

  const secretKeyString = fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const walletKeypair = Keypair.fromSecretKey(secretKey);

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = new Program(idl as anchor.Idl, provider);

  const testEmail = `guest_${Math.floor(Date.now() / 1000)}@orin.network`;
  const emailHashBuffer = createHash("sha256").update(testEmail.toLowerCase().trim()).digest();
  const [guestPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("guest"), emailHashBuffer],
    PROGRAM_ID
  );

  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Guest PDA: ${guestPda.toBase58()}`);

  const tx1 = await program.methods
    .initializeGuest(Array.from(emailHashBuffer), "Demo Private Guest")
    .accounts({
      guestProfile: guestPda,
      user: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc();

  console.log(`Initialize tx: ${tx1}`);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Stage a production-like voice command in the API gateway.
  await fetch(`http://${env.API_HOST}:${env.API_PORT}/api/v1/voice-command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestPda: guestPda.toBase58(),
      userInput: "Set room to sleep mode with warm lighting and 18.5 degrees.",
      guestContext: {
        name: "Demo Guest",
        loyaltyPoints: 500,
        history: ["night mode preference", "likes comfort temperature"],
      },
    }),
  });

  // Hash produced from canonical payload contract the agent will generate.
  const expectedPayload = {
    temp: 18.5,
    lighting: "ambient",
    services: [] as string[],
    raw_response: "I have adjusted your room to a premium comfort profile.",
  };
  const payloadHash = createHash("sha256").update(JSON.stringify(expectedPayload)).digest();

  const tx2 = await program.methods
    .updatePreferences(Array.from(payloadHash))
    .accounts({
      guestProfile: guestPda,
      owner: wallet.publicKey,
    } as any)
    .rpc();

  console.log(`Update tx: ${tx2}`);
  console.log("Simulation finished.");
}

runSimulation().catch(console.error);
