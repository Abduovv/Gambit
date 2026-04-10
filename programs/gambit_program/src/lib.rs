pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4hhDWN9o9dpS5Cj3K8RD6Vrvo1YNP5mQTfiHPX3jC6Ku");

#[ephemeral]
#[program]
pub mod gambit_program {
    use super::*;

    /// Host creates a new bill-split session.
    /// Produces: Session PDA + Escrow PDA.
    pub fn initialize_session(
        ctx: Context<InitializeSession>,
        session_id: [u8; 6],
        total_lamports: u64,
        fairness_alpha: u8,
        max_participants: u8,
    ) -> Result<()> {
        initialize_session::handler(ctx, session_id, total_lamports, fairness_alpha, max_participants)
    }

    /// Participant joins an open session.
    /// Produces: Participant PDA. Fails if already joined (PDA collision).
    pub fn join_session(ctx: Context<JoinSession>, display_name: String) -> Result<()> {
        join_session::handler(ctx, display_name)
    }

    /// Host locks the session — no new joins allowed.
    /// Requires: ≥2 participants.
    pub fn lock_session(ctx: Context<LockSession>) -> Result<()> {
        lock_session::handler(ctx)
    }

    /// Each participant individually confirms the total bill.
    /// Auto-advances to CONFIRMING when all have confirmed.
    pub fn confirm_bill(ctx: Context<ConfirmBill>) -> Result<()> {
        confirm_bill::handler(ctx)
    }

    /// Host triggers the VRF randomness request.
    /// State: CONFIRMING → REVEALING.
    /// VRF oracle will async call consume_randomness.
    pub fn request_reveal(ctx: Context<RequestReveal>) -> Result<()> {
        request_reveal::handler(ctx)
    }

    /// VRF oracle callback — called by MagicBlock oracle, never by users.
    /// Runs distribution algorithm. Writes amount_due to all Participant PDAs.
    /// State: REVEALING → PAYING.
    ///
    /// remaining_accounts: all Participant PDAs for the session (any order).
    pub fn consume_randomness(
        ctx: Context<ConsumeRandomness>,
        randomness: [u8; 32],
    ) -> Result<()> {
        consume_randomness::handler(ctx, randomness)
    }

    /// Participant pays their exact share — SOL → Escrow PDA.
    /// Validated on-chain: amount must equal participant.amount_due exactly.
    /// Auto-advances to SETTLING when all have paid.
    pub fn deposit_share(ctx: Context<DepositShare>) -> Result<()> {
        deposit_share::handler(ctx)
    }

    /// Settle the session — drains escrow to host, creates Receipt PDA,
    /// closes Session + Escrow. Anyone can call once state = SETTLING.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        settle::handler(ctx)
    }

    /// Host cancels the session from any non-terminal state.
    /// Refunds all deposits. Closes all accounts. Rent returned to host.
    ///
    /// remaining_accounts: interleaved [ParticipantPDA, WalletAccount] pairs
    /// for each participant who paid. Unpaid participants only need their PDA.
    pub fn cancel_session(ctx: Context<CancelSession>) -> Result<()> {
        cancel_session::handler(ctx)
    }
}