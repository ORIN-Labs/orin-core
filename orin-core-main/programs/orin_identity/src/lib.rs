use anchor_lang::prelude::*;

// Replace this with your actual generated Program ID
declare_id!("FqtrHgdYTph1DSP9jDYD7xrKPrjSjCTtnw6fyKMmboYk");

#[program]
pub mod orin_identity {
    use super::*;

    /// Initializes a new guest identity (On-chain Identity Layer)
    /// @param email_hash: SHA256 hash of the guest's email, used to derive the PDA
    /// @param name: Guest's name or nickname
    pub fn initialize_guest(
        ctx: Context<InitializeGuest>,
        email_hash: [u8; 32],
        name: String,
    ) -> Result<()> {
        // 1. Parameter validation: Limit name length (Max 100 characters/bytes)
        require!(name.as_bytes().len() <= 100, OrinError::NameTooLong);

        let guest_profile = &mut ctx.accounts.guest_profile;

        // 2. Initialize fields
        guest_profile.owner = *ctx.accounts.user.key;    // Bind the current signer as the owner
        guest_profile.email_hash = email_hash;           // Store email hash for off-chain querying
        guest_profile.name = name;                       // Store guest name
        guest_profile.loyalty_points = 0;                // Initialize points to 0
        guest_profile.stay_count = 0;                    // Initialize stay count to 0
        guest_profile.preferences_hash = [0; 32];        // Wait for off-chain payload hash

        msg!("Guest Identity Initialized: {}", guest_profile.name);
        Ok(())
    }

    /// Updates the guest's ambient preferences (Privacy-First Hash Verification Logic)
    /// @param new_prefs_hash: The SHA256 Hash of the off-chain JSON preference string 
    pub fn update_preferences(ctx: Context<UpdatePreferences>, new_prefs_hash: [u8; 32]) -> Result<()> {
        let guest_profile = &mut ctx.accounts.guest_profile;

        // 1. Update preferences verification hash
        guest_profile.preferences_hash = new_prefs_hash;

        // 2. Automatically increment room adjustments count (simplified logic: each update represents an environmental activation)
        guest_profile.stay_count += 1;

        msg!("Preferences HASH updated for Guest: {:?}", guest_profile.preferences_hash);
        Ok(())
    }
}

/// ---------------------------
/// Contexts & Access Control
/// ---------------------------

#[derive(Accounts)]
#[instruction(email_hash: [u8; 32])]
pub struct InitializeGuest<'info> {
    // PDA (Program Derived Address) design:
    // Seeds combine "guest" + user's email hash, ensuring one email maps to exactly one identity account
    #[account(
        init,
        payer = user,
        // Space calculation: 8 (discriminator) + 32 (pubkey) + 32 (hash) + 4+100 (name) + 32 (prefs_hash) + 8 (u64) + 4 (u32)
        space = 8 + 32 + 32 + (4 + 100) + 32 + 8 + 4,
        seeds = [b"guest", email_hash.as_ref()],
        bump
    )]
    pub guest_profile: Account<'info, GuestIdentity>,

    #[account(mut)]
    pub user: Signer<'info>, // The wallet paying for account creation (could be the app's feepayer in AA)

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePreferences<'info> {
    // Access control core: has_one = owner
    // This enforces `guest_profile.owner == owner.key`
    // Only the "account creator" has permission to modify preferences, preventing unauthorized tampering
    #[account(
        mut,
        has_one = owner @ OrinError::UnauthorizedAccess
    )]
    pub guest_profile: Account<'info, GuestIdentity>,

    pub owner: Signer<'info>, // Must be the signature of the account owner
}

/// ---------------------------
/// Data Structures (State)
/// ---------------------------

#[account]
pub struct GuestIdentity {
    pub owner: Pubkey,               // 32 bytes: Account owner (AA context or private key wallet)
    pub email_hash: [u8; 32],        // 32 bytes: Associated email hash
    pub name: String,                // 4 + 100 bytes: User's name/nickname
    pub preferences_hash: [u8; 32],  // 32 bytes: Security HASH validating the off-chain environment preferences
    pub loyalty_points: u64,         // 8 bytes: Loyalty points (for future Phase extensions)
    pub stay_count: u32,             // 4 bytes: Number of stays/activations
}

/// ---------------------------
/// Error Handling
/// ---------------------------

#[error_code]
pub enum OrinError {
    #[msg("The provided name is too long. Please limit to 100 characters.")]
    NameTooLong,
    #[msg("Identity verification failed: Only the owner of this account can modify its data.")]
    UnauthorizedAccess,
}
