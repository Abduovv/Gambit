use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Session, Participant};

#[derive(Accounts)]
pub struct JoinSession<'info> {
    #[account(mut)]
    pub participant_wallet: Signer<'info>,

    #[account(
        mut,
        seeds = [SESSION_SEED, &session.session_id, session.host.as_ref()],
        bump = session.bump,
    )]
    pub session: Account<'info, Session>,

    /// CHECK: PDA uniqueness enforces one-per-(session, wallet).
    /// init will fail if this PDA already exists — double-join prevented.
    #[account(
        init,
        payer = participant_wallet,
        space = 8 + Participant::INIT_SPACE,
        seeds = [
            PARTICIPANT_SEED,
            session.key().as_ref(),
            participant_wallet.key().as_ref(),
        ],
        bump,
    )]
    pub participant: Account<'info, Participant>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinSession>, display_name: String) -> Result<()> {
    let session = &mut ctx.accounts.session;

    require!(session.state == STATE_OPEN, ErrorCode::NotOpen);
    require!(
        session.participant_count < session.max_participants,
        ErrorCode::SessionFull
    );

    // Check session hasn't expired (15 min)
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp - session.created_ts < SESSION_EXPIRY_SECS,
        ErrorCode::SessionExpired
    );

    // Clamp display name to 20 chars
    let name = if display_name.len() > 20 {
        display_name[..20].to_string()
    } else {
        display_name
    };

    let join_index = session.participant_count;
    session.participant_count = session
        .participant_count
        .checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    let participant = &mut ctx.accounts.participant;
    participant.session = ctx.accounts.session.key();
    participant.wallet = ctx.accounts.participant_wallet.key();
    participant.display_name = name;
    participant.amount_due = 0;
    participant.amount_paid = 0;
    participant.confirmed_bill = false;
    participant.join_index = join_index;
    participant.bump = ctx.bumps.participant;

    Ok(())
}