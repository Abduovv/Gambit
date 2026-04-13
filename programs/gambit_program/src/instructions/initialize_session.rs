use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::Session;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint},
};

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

    /// The token account that holds USDT — authority is the Session PDA
    #[account(
        init,
        payer = host,
        token::mint = usdt_mint,
        token::authority = session,
    )]
    pub usdt_vault: Account<'info, TokenAccount>,

    /// USDT mint account
    pub usdt_mint: Account<'info, Mint>,

    /// Recipient's USDT token account (must be pre-initialized)
    /// CHECK: Validated to be owned by Token program
    pub recipient_token_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<InitializeSession>,
    session_id: [u8; 6],
    total_usdt: u64,
    fairness_alpha: u8,   // 1–10
    max_participants: u8, // 2–20
    recipient_token_account: Pubkey,
) -> Result<()> {
    require!(
        fairness_alpha >= 1 && fairness_alpha <= 10,
        ErrorCode::Overflow
    );
    require!(
        max_participants >= 2 && max_participants <= MAX_PARTICIPANTS,
        ErrorCode::NotEnoughParticipants
    );
    require!(total_usdt > 0, ErrorCode::WrongAmount);

    // Validate recipient token account is owned by Token program
    require!(
        ctx.accounts.recipient_token_account.owner == &anchor_spl::token::ID,
        ErrorCode::InvalidTokenAccount
    );

    let clock = Clock::get()?;

    ctx.accounts.session.set_inner(Session {
        session_id,
        host: ctx.accounts.host.key(),
        total_usdt,
        max_participants,
        participant_count: 0,
        confirmed_count: 0,
        paid_count: 0,
        total_collected: 0,
        state: STATE_OPEN,
        fairness_alpha,
        deadline_ts: 0,
        created_ts: clock.unix_timestamp,
        vrf_seed: [0u8; 32],
        recipient_token_account,
        usdt_vault: ctx.accounts.usdt_vault.key(),
        bump: ctx.bumps.session,
    });

    Ok(())
}
