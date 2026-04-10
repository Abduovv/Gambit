use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Session, Escrow, Receipt};

/// Anyone can call settle once all participants have paid (state = SETTLING).
/// This keeps the UX clean — no one has to wait for the host specifically.
#[derive(Accounts)]
pub struct Settle<'info> {
    /// Could be host, participant, or backend — doesn't matter
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [SESSION_SEED, &session.session_id, session.host.as_ref()],
        bump = session.bump,
    )]
    pub session: Account<'info, Session>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, session.key().as_ref()],
        bump = escrow.bump,
        has_one = session @ ErrorCode::InvalidParticipantPda,
    )]
    pub escrow: Account<'info, Escrow>,

    /// Host receives all collected lamports
    /// CHECK: We validate this matches session.host below
    #[account(
        mut,
        constraint = host.key() == session.host @ ErrorCode::NotHost,
    )]
    pub host: SystemAccount<'info>,

    #[account(
        init,
        payer = caller,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, session.key().as_ref()],
        bump,
    )]
    pub receipt: Account<'info, Receipt>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Settle>) -> Result<()> {
    let session = &ctx.accounts.session;
    require!(session.state == STATE_SETTLING, ErrorCode::NotSettling);
    require!(
        session.paid_count == session.participant_count,
        ErrorCode::NotAllPaid
    );

    let collected = ctx.accounts.escrow.total_collected;

    // Drain escrow → host via PDA-signed transfer
    let session_key = ctx.accounts.session.key();
    let escrow_seeds = &[
        ESCROW_SEED,
        session_key.as_ref(),
        &[ctx.accounts.escrow.bump],
    ];
    let signer = &[&escrow_seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow.to_account_info(),
            to: ctx.accounts.host.to_account_info(),
        },
        signer,
    );
    transfer(cpi_ctx, collected)?;

    // Write the permanent Receipt
    let clock = Clock::get()?;
    let session = &ctx.accounts.session;
    ctx.accounts.receipt.set_inner(Receipt {
        session_id: session.session_id,
        host: session.host,
        total_lamports: session.total_lamports,
        participant_count: session.participant_count,
        settled_at: clock.unix_timestamp,
        fairness_alpha: session.fairness_alpha,
        vrf_seed: session.vrf_seed,
        bump: ctx.bumps.receipt,
    });

    // Mark settled — session and escrow are closed by Anchor via
    // the `close` constraint on the respective accounts.
    // NOTE: Session + Escrow close constraints are handled at the
    // account level. Since we need to read session data above,
    // we close them by zeroing lamports here instead.
    let session_info = ctx.accounts.session.to_account_info();
    let escrow_info = ctx.accounts.escrow.to_account_info();
    let host_info = ctx.accounts.host.to_account_info();

    // Return Session rent to host
    let session_lamports = session_info.lamports();
    **session_info.lamports.borrow_mut() = 0;
    **host_info.lamports.borrow_mut() = host_info
        .lamports()
        .checked_add(session_lamports)
        .ok_or(ErrorCode::Overflow)?;

    // Return Escrow rent to host (balance should be 0 after transfer, just rent)
    let escrow_lamports = escrow_info.lamports();
    **escrow_info.lamports.borrow_mut() = 0;
    **host_info.lamports.borrow_mut() = host_info
        .lamports()
        .checked_add(escrow_lamports)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}