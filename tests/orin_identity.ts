import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OrinIdentity } from "../target/types/orin_identity";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { expect } from "chai";

describe("orin_identity", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  
  const program = anchor.workspace.orinIdentity as Program<OrinIdentity>;

  // Variables for our tests
  const testEmail = "test.guest@orin.network";
  let guestPda: PublicKey;
  let emailHashBuffer: Buffer;

  before(async () => {
    // 1. Calculate the 32-byte sha256 hash required by our Anchor PDA
    emailHashBuffer = createHash("sha256").update(testEmail.toLowerCase().trim()).digest();
    
    // 2. Derive the expected PDA
    [guestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guest"), emailHashBuffer],
      program.programId
    );
  });

  it("Initializes a new Guest Identity!", async () => {
    const guestName = "Satoshi Nakamoto";

    // Call the `initialize_guest` method
    const tx = await program.methods
      .initializeGuest(Array.from(emailHashBuffer), guestName)
      .accounts({
        guestProfile: guestPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    
    console.log("💳 Initialize TX Signature:", tx);

    // Fetch the stored account data
    const guestAccount = await program.account.guestIdentity.fetch(guestPda);

    // Verify
    expect(guestAccount.name).to.equal(guestName);
    expect(guestAccount.preferences).to.equal("{}");
    expect(guestAccount.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(guestAccount.stayCount).to.equal(0);
  });

  it("Updates the Guest's Ambient Preferences!", async () => {
    // Mock incoming preference from the UI
    const newPreferences = JSON.stringify({
      temp: 21.5,
      brightness: 100,
      light_color: "#1E90FF",
      color_mode: "FOCUS",
    });

    // Call the `update_preferences` method
    const tx = await program.methods
      .updatePreferences(newPreferences)
      .accounts({
        guestProfile: guestPda,
        owner: provider.wallet.publicKey,
      } as any)
      .rpc();

    console.log("🎛️ Update Preferences TX Signature:", tx);

    // Fetch the updated account data
    const updatedAccount = await program.account.guestIdentity.fetch(guestPda);

    // Verify
    expect(updatedAccount.preferences).to.equal(newPreferences);
    expect(updatedAccount.stayCount).to.equal(1); // Ensure stay count incremented

    console.log("\n✅ [Test Passed] On-chain state is perfectly updated.");
    console.log("   Stored Preferences:", updatedAccount.preferences);
  });

  it("Fails when an unauthorized user tries to update preferences", async () => {
    // Create an attacker wallet
    const attackerKeypair = anchor.web3.Keypair.generate();
    
    // Attempt to update with the attacker's wallet (should fail due to has_one = owner)
    let errorOccurred = false;
    try {
      await program.methods
        .updatePreferences("{\"malicious\": true}")
        .accounts({
          guestProfile: guestPda,
          owner: attackerKeypair.publicKey,
        } as any)
        .signers([attackerKeypair])
        .rpc();
    } catch (error: any) {
      errorOccurred = true;
      expect(error.message).to.include("UnauthorizedAccess");
    }

    expect(errorOccurred).to.be.true;
    console.log("🛡️ Access control correctly blocked the malicious update!");
  });
});
