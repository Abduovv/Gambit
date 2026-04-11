use anchor_lang::prelude::*;

/// Core session account. One per bill split event.
/// PDA seeds: [SESSION_SEED, session_id, host.key()]
#[account]
#[derive(InitSpace)]
pub struct Session {
    pub session_id: [u8; 6],       // 6 - short code shown in UI
    pub host: Pubkey,              // 32
    pub total_lamports: u64,       // 8 - total bill in lamports
    pub max_participants: u8,      // 1 - cap set by host (2–20)
    pub participant_count: u8,     // 1
    pub confirmed_count: u8,       // 1 - how many confirmed the bill
    pub paid_count: u8,            // 1 - how many paid on-chain
    pub state: u8,                 // 1 - STATE_* constants
    pub fairness_alpha: u8,        // 1 - 1..=10, maps to ±10%..±90% spread
    pub deadline_ts: i64,          // 8 - payment deadline (set at PAYING state)
    pub created_ts: i64,           // 8 - for session expiry logic
    pub vrf_seed: [u8; 32],        // 32 - stored after reveal for auditability
    pub bump: u8,                  // 1
}

/// Escrow account — holds collected SOL until settlement or cancellation.
/// PDA seeds: [ESCROW_SEED, session.key()]
#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub session: Pubkey,           // 32 - back-reference for has_one checks
    pub total_collected: u64,      // 8 - sum of all deposits so far
    pub bump: u8,                  // 1
}

/// One per (session, wallet) pair. Prevents double-join at program level.
/// PDA seeds: [PARTICIPANT_SEED, session.key(), wallet.key()]
#[account]
#[derive(InitSpace)]
pub struct Participant {
    pub session: Pubkey,           // 32
    pub wallet: Pubkey,            // 32
    #[max_len(20)]
    pub display_name: String,      // 4 + 20 = 24
    pub amount_due: u64,           // 8 - written by VRF callback
    pub amount_paid: u64,          // 8 - written by deposit_share
    pub confirmed_bill: bool,      // 1
    pub join_index: u8,            // 1 - order joined, used for reveal animation
    pub bump: u8,                  // 1
}

/// Permanent proof-of-settlement. Never closed.
/// PDA seeds: [RECEIPT_SEED, session.key()]
#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub session_id: [u8; 6],       // 6
    pub host: Pubkey,              // 32
    pub total_lamports: u64,       // 8
    pub participant_count: u8,     // 1
    pub settled_at: i64,           // 8
    pub fairness_alpha: u8,        // 1
    pub vrf_seed: [u8; 32],        // 32 - same as Session.vrf_seed, preserved
    pub bump: u8,                  // 1
}