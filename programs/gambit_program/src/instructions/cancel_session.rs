use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Participant, Session};
use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account as spl_close_account, transfer as spl_transfer, CloseAccount as SplCloseAccount,
    Token, TokenAccount, Transfer as SplTransfer,
};

/// Host can cancel from any non-terminal state.
/// All deposits returned. All accounts closed. Rent returned to host.
///
/// remaining_accounts: all Participant PDAs for this session,
/// plus their USDT token accounts for those who paid (to refund to).
#[derive(Accounts)]
pub struct CancelSession<'info> {
    #[account(mut)]
    pub host: Signer<'info>,

    #[account(
        mut,
        seeds = [SESSION_SEED, &session.session_id, host.key().as_ref()],
        bump = session.bump,
        has_one = host @ ErrorCode::NotHost,
    )]
    pub session: Account<'info, Session>,

    /// The token account owned by the Session PDA holding collected USDT.
    /// Validated by pubkey stored in Session — prevents rogue vault attack.
    #[account(
        mut,
        constraint = usdt_vault.key() == session.usdt_vault @ ErrorCode::InvalidVault,
    )]
    pub usdt_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'a>(ctx: Context<'a, CancelSession<'a>>) -> Result<()> {
    let session = &ctx.accounts.session;

    // Can cancel from any non-terminal state
    require!(
        session.state != STATE_SETTLED && session.state != STATE_CANCELLED,
        ErrorCode::AlreadyTerminal
    );

    let host_key = ctx.accounts.host.key();
    let session_seeds = &[
        SESSION_SEED,
        &session.session_id,
        host_key.as_ref(),
        &[session.bump],
    ];
    let signer = &[&session_seeds[..]];

    // Refund each participant who paid — iterate remaining_accounts
    for acc_info in ctx.remaining_accounts.iter() {
        // Try to deserialize as Participant. Skip if it fails (e.g. not a participant).
        let participant = Account::<Participant>::try_from(acc_info);
        if participant.is_err() {
            continue;
        }
        let participant = participant.unwrap();

        // Validate PDA
        let session_key = ctx.accounts.session.key();
        let expected_seeds = &[
            PARTICIPANT_SEED,
            session_key.as_ref(),
            participant.wallet.as_ref(),
        ];
        let (expected_pda, _) = Pubkey::find_program_address(expected_seeds, &crate::ID);
        if acc_info.key() != expected_pda {
            continue; // skip unrecognized accounts silently
        }

        // If participant paid, refund them from vault
        if participant.amount_paid > 0 {
            let refund = participant.amount_paid;

            // Find participant's USDT token account from remaining_accounts
            // Validate mint matches vault mint
            let participant_token_info = ctx.remaining_accounts.iter().find(|a| {
                let token_acc = Account::<TokenAccount>::try_from(a);
                if let Ok(token) = token_acc {
                    token.owner == participant.wallet && token.mint == ctx.accounts.usdt_vault.mint
                } else {
                    false
                }
            });

            if let Some(participant_token_info) = participant_token_info {
                let cpi_ctx = CpiContext::new_with_signer(
                    anchor_spl::token::ID,
                    SplTransfer {
                        from: ctx.accounts.usdt_vault.to_account_info(),
                        to: participant_token_info.clone(),
                        authority: ctx.accounts.session.to_account_info(),
                    },
                    signer,
                );
                spl_transfer(cpi_ctx, refund)?;
            }
        }

        // Close participant account — return rent to host
        let participant_lamports = acc_info.lamports();
        **acc_info.lamports.borrow_mut() = 0;
        **ctx.accounts.host.lamports.borrow_mut() = ctx
            .accounts
            .host
            .lamports()
            .checked_add(participant_lamports)
            .ok_or(ErrorCode::Overflow)?;
    }

    // Close vault token account → rent returns to host
    let close_vault_ctx = CpiContext::new_with_signer(
        anchor_spl::token::ID,
        SplCloseAccount {
            account: ctx.accounts.usdt_vault.to_account_info(),
            destination: ctx.accounts.host.to_account_info(),
            authority: ctx.accounts.session.to_account_info(),
        },
        signer,
    );
    spl_close_account(close_vault_ctx)?;

    // Mark cancelled on session before closing it
    let session = &mut ctx.accounts.session;
    session.state = STATE_CANCELLED;

    // Close session account → host
    let session_info = ctx.accounts.session.to_account_info();
    let session_lamports = session_info.lamports();
    **session_info.lamports.borrow_mut() = 0;
    **ctx.accounts.host.lamports.borrow_mut() = ctx
        .accounts
        .host
        .lamports()
        .checked_add(session_lamports)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}
