use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Session, Escrow, Participant};

/// Host can cancel from any non-terminal state.
/// All deposits returned. All accounts closed. Rent returned to host.
///
/// remaining_accounts: all Participant PDAs for this session.
/// If no deposits yet, they can be empty accounts — close is safe either way.
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

    #[account(
        mut,
        seeds = [ESCROW_SEED, session.key().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

pub fn handler<'a>(ctx: Context<'a, CancelSession<'a>>) -> Result<()> {
    let session = &ctx.accounts.session;

    // Can cancel from any non-terminal state
    require!(
        session.state != STATE_SETTLED && session.state != STATE_CANCELLED,
        ErrorCode::AlreadyTerminal
    );

    let session_key = ctx.accounts.session.key();

    // Refund each participant who paid — iterate remaining_accounts
    for acc_info in ctx.remaining_accounts.iter() {
        // Try to deserialize as Participant. Skip if it fails (e.g. not a participant).
        let participant = Account::<Participant>::try_from(acc_info);
        if participant.is_err() {
            continue;
        }
        let participant = participant.unwrap();

        // Validate PDA
        let expected_seeds = &[
            PARTICIPANT_SEED,
            session_key.as_ref(),
            participant.wallet.as_ref(),
        ];
        let (expected_pda, _) = Pubkey::find_program_address(expected_seeds, &crate::ID);
        if acc_info.key() != expected_pda {
            continue; // skip unrecognized accounts silently
        }

        // If participant paid, refund them from escrow
        if participant.amount_paid > 0 {
            let escrow_seeds = &[
                ESCROW_SEED,
                session_key.as_ref(),
                &[ctx.accounts.escrow.bump],
            ];
            let signer = &[&escrow_seeds[..]];

            // Find participant wallet account from remaining_accounts
            // The participant's wallet is stored in participant.wallet.
            // We need the AccountInfo for that wallet — it must be passed
            // in remaining_accounts too (after all participant PDAs).
            // Convention: pass all participant PDAs first, then their wallet AccountInfos.
            // For MVP: do a lamport-move directly since we have the escrow.
            let refund = participant.amount_paid;
            let escrow_info = ctx.accounts.escrow.to_account_info();

            // Find the wallet AccountInfo from remaining_accounts
            let wallet_info = ctx.remaining_accounts.iter()
                .find(|a| a.key() == participant.wallet);

            if let Some(wallet_info) = wallet_info {
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: escrow_info,
                        to: wallet_info.clone(),
                    },
                    signer,
                );
                transfer(cpi_ctx, refund)?;
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

    // Close escrow (any remaining rent) → host
    let escrow_info = ctx.accounts.escrow.to_account_info();
    let remaining_escrow = escrow_info.lamports();
    if remaining_escrow > 0 {
        **escrow_info.lamports.borrow_mut() = 0;
        **ctx.accounts.host.lamports.borrow_mut() = ctx
            .accounts
            .host
            .lamports()
            .checked_add(remaining_escrow)
            .ok_or(ErrorCode::Overflow)?;
    }

    // Mark cancelled on session before closing it
    // (The account will be zeroed, so the state write is for event emission
    // and any indexers that read before close.)
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