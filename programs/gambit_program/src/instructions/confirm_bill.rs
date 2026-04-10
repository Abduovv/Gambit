use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Session, Participant};

#[derive(Accounts)]
pub struct ConfirmBill<'info> {
    pub participant_wallet: Signer<'info>,

    #[account(
        mut,
        seeds = [SESSION_SEED, &session.session_id, session.host.as_ref()],
        bump = session.bump,
    )]
    pub session: Account<'info, Session>,

    #[account(
        mut,
        seeds = [
            PARTICIPANT_SEED,
            session.key().as_ref(),
            participant_wallet.key().as_ref(),
        ],
        bump = participant.bump,
        has_one = session @ ErrorCode::InvalidParticipantPda,
    )]
    pub participant: Account<'info, Participant>,
}

pub fn handler(ctx: Context<ConfirmBill>) -> Result<()> {
    let participant = &mut ctx.accounts.participant;
    require!(!participant.confirmed_bill, ErrorCode::AlreadyConfirmed);

    // Must be LOCKED state
    require!(ctx.accounts.session.state == STATE_LOCKED, ErrorCode::NotLocked);

    participant.confirmed_bill = true;

    let session = &mut ctx.accounts.session;
    session.confirmed_count = session
        .confirmed_count
        .checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    // Auto-advance: when all participants confirmed, move to CONFIRMING
    // Host will then call request_reveal to trigger VRF
    if session.confirmed_count == session.participant_count {
        session.state = STATE_CONFIRMING;
    }

    Ok(())
}