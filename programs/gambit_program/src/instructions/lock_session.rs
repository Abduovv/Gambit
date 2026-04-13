use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::Session;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct LockSession<'info> {
    pub host: Signer<'info>,

    #[account(
        mut,
        seeds = [SESSION_SEED, &session.session_id, host.key().as_ref()],
        bump = session.bump,
        has_one = host @ ErrorCode::NotHost,
    )]
    pub session: Account<'info, Session>,
}

pub fn handler(ctx: Context<LockSession>) -> Result<()> {
    let session = &mut ctx.accounts.session;

    require!(session.state == STATE_OPEN, ErrorCode::NotOpen);
    require!(
        session.participant_count >= 2,
        ErrorCode::NotEnoughParticipants
    );

    session.state = STATE_LOCKED;

    Ok(())
}
