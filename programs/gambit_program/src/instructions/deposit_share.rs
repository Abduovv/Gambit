use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Escrow, Participant, Session};

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

    #[account(
        mut,
        seeds = [ESCROW_SEED, session.key().as_ref()],
        bump = escrow.bump,
        has_one = session @ ErrorCode::InvalidParticipantPda,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
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

    // Transfer exact amount from participant wallet to escrow PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.key(),
        Transfer {
            from: ctx.accounts.participant_wallet.to_account_info(),
            to: ctx.accounts.escrow.to_account_info(),
        },
    );
    transfer(cpi_ctx, amount_due)?;

    // Update accounting — do this after transfer to avoid partial-state bugs
    let participant = &mut ctx.accounts.participant;
    participant.amount_paid = amount_due;

    let escrow = &mut ctx.accounts.escrow;
    escrow.total_collected = escrow
        .total_collected
        .checked_add(amount_due)
        .ok_or(ErrorCode::Overflow)?;

    let session = &mut ctx.accounts.session;
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