use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Receipt, Session};
use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account as spl_close_account, transfer as spl_transfer, CloseAccount as SplCloseAccount,
    Token, TokenAccount, Transfer as SplTransfer,
};

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

    /// The token account owned by the Session PDA holding collected USDT.
    /// Validated by pubkey stored in Session — prevents rogue vault attack.
    #[account(
        mut,
        constraint = usdt_vault.key() == session.usdt_vault @ ErrorCode::InvalidVault,
    )]
    pub usdt_vault: Account<'info, TokenAccount>,

    /// Recipient receives all collected USDT
    #[account(
        mut,
        constraint = recipient_token_account.key() == session.recipient_token_account @ ErrorCode::InvalidTokenAccount,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = caller,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, session.key().as_ref()],
        bump,
    )]
    pub receipt: Account<'info, Receipt>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Settle>) -> Result<()> {
    let session = &ctx.accounts.session;
    require!(session.state == STATE_SETTLING, ErrorCode::NotSettling);
    require!(
        session.paid_count == session.participant_count,
        ErrorCode::NotAllPaid
    );

    let collected = session.total_collected;
    require!(collected > 0, ErrorCode::WrongAmount);

    // Transfer USDT from vault → recipient via PDA-signed CPI
    let session_seeds = &[
        SESSION_SEED,
        &session.session_id,
        session.host.as_ref(),
        &[session.bump],
    ];
    let signer = &[&session_seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        anchor_spl::token::ID,
        SplTransfer {
            from: ctx.accounts.usdt_vault.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.session.to_account_info(),
        },
        signer,
    );
    spl_transfer(cpi_ctx, collected)?;

    // Write the permanent Receipt
    let clock = Clock::get()?;
    ctx.accounts.receipt.set_inner(Receipt {
        session_id: session.session_id,
        host: session.host,
        total_usdt: session.total_usdt,
        participant_count: session.participant_count,
        settled_at: clock.unix_timestamp,
        fairness_alpha: session.fairness_alpha,
        vrf_seed: session.vrf_seed,
        bump: ctx.bumps.receipt,
    });

    // Close vault token account → rent returns to caller
    let close_vault_ctx = CpiContext::new_with_signer(
        anchor_spl::token::ID,
        SplCloseAccount {
            account: ctx.accounts.usdt_vault.to_account_info(),
            destination: ctx.accounts.caller.to_account_info(),
            authority: ctx.accounts.session.to_account_info(),
        },
        signer,
    );
    spl_close_account(close_vault_ctx)?;

    // Close Session account → rent returns to caller
    let session_info = ctx.accounts.session.to_account_info();
    let session_lamports = session_info.lamports();
    **session_info.lamports.borrow_mut() = 0;
    **ctx.accounts.caller.to_account_info().lamports.borrow_mut() = ctx
        .accounts
        .caller
        .lamports()
        .checked_add(session_lamports)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}
