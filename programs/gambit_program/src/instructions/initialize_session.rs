use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Session, Escrow};

#[derive(Accounts)]
#[instruction(session_id: [u8; 6])]
pub struct InitializeSession<'info> {
    #[account(mut)]
    pub host: Signer<'info>,

    #[account(
        init,
        payer = host,
        space = 8 + Session::INIT_SPACE,
        seeds = [SESSION_SEED, &session_id, host.key().as_ref()],
        bump,
    )]
    pub session: Account<'info, Session>,

    #[account(
        init,
        payer = host,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, session.key().as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeSession>,
    session_id: [u8; 6],
    total_lamports: u64,
    fairness_alpha: u8,      // 1–10
    max_participants: u8,    // 2–20
) -> Result<()> {
    require!(fairness_alpha >= 1 && fairness_alpha <= 10, ErrorCode::Overflow);
    require!(
        max_participants >= 2 && max_participants <= MAX_PARTICIPANTS,
        ErrorCode::NotEnoughParticipants
    );
    require!(total_lamports > 0, ErrorCode::WrongAmount);

    let clock = Clock::get()?;

    ctx.accounts.session.set_inner(Session {
        session_id,
        host: ctx.accounts.host.key(),
        total_lamports,
        max_participants,
        participant_count: 0,
        confirmed_count: 0,
        paid_count: 0,
        state: STATE_OPEN,
        fairness_alpha,
        deadline_ts: 0,
        created_ts: clock.unix_timestamp,
        vrf_seed: [0u8; 32],
        bump: ctx.bumps.session,
    });

    ctx.accounts.escrow.set_inner(Escrow {
        session: ctx.accounts.session.key(),
        total_collected: 0,
        bump: ctx.bumps.escrow,
    });

    Ok(())
}
