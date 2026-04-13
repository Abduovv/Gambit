use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Participant, Session};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer as spl_transfer, Token, TokenAccount, Transfer as SplTransfer};

#[derive(Accounts)]
pub struct DepositShare<'info> {
    #[account(mut)]
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

    /// The token account owned by the Session PDA that receives USDT.
    /// Validated by pubkey stored in Session — prevents rogue vault attack.
    #[account(
        mut,
        constraint = usdt_vault.key() == session.usdt_vault @ ErrorCode::InvalidVault,
    )]
    pub usdt_vault: Account<'info, TokenAccount>,

    /// Participant's USDT token account (source of funds)
    #[account(
        mut,
        constraint = participant_token_account.owner == participant_wallet.key() @ ErrorCode::InvalidTokenAccount,
        constraint = participant_token_account.mint == usdt_vault.mint @ ErrorCode::MintMismatch,
    )]
    pub participant_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<DepositShare>) -> Result<()> {
    let session = &ctx.accounts.session;
    let participant = &ctx.accounts.participant;

    require!(session.state == STATE_PAYING, ErrorCode::NotPaying);
    require!(participant.amount_paid == 0, ErrorCode::AlreadyPaid);

    // Check deadline hasn't passed
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp <= session.deadline_ts,
        ErrorCode::DeadlinePassed
    );

    let amount_due = participant.amount_due;
    require!(amount_due > 0, ErrorCode::WrongAmount);

    // Transfer exact amount from participant's USDT to vault token account
    let cpi_ctx = CpiContext::new(
        anchor_spl::token::ID,
        SplTransfer {
            from: ctx.accounts.participant_token_account.to_account_info(),
            to: ctx.accounts.usdt_vault.to_account_info(),
            authority: ctx.accounts.participant_wallet.to_account_info(),
        },
    );
    spl_transfer(cpi_ctx, amount_due)?;

    // Update accounting — do this after transfer to avoid partial-state bugs
    let participant = &mut ctx.accounts.participant;
    participant.amount_paid = amount_due;

    let session = &mut ctx.accounts.session;
    session.total_collected = session
        .total_collected
        .checked_add(amount_due)
        .ok_or(ErrorCode::Overflow)?;

    session.paid_count = session
        .paid_count
        .checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    // Auto-advance when everyone has paid
    if session.paid_count == session.participant_count {
        session.state = STATE_SETTLING;
    }

    Ok(())
}
