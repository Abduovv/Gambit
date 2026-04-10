use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, TokenAccount, Token},
};
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
        address = USDT_MINT
    )]
    pub usdt_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = host,
        associated_token::mint = usdt_mint,
    )]
    pub vault: Account<'info, TokenAccount>,
    
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeSession>,
    session_id: [u8; 6],
    total_amount: u64,
    fairness_alpha: u8,      // 1–10
    max_participants: u8,    // 2–20
) -> Result<()> {
    require!(fairness_alpha >= 1 && fairness_alpha <= 10, ErrorCode::Overflow);
    require!(
        max_participants >= 2 && max_participants <= MAX_PARTICIPANTS,
        ErrorCode::NotEnoughParticipants
    );
    require!(total_amount > 0, ErrorCode::WrongAmount);

    let clock = Clock::get()?;

    ctx.accounts.session.set_inner(Session {
        session_id,
        recipient: ctx.accounts.recipient.key(),
        total_amount,
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

    Ok(())
}