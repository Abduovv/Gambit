use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Session, Participant};

/// Called exclusively by the MagicBlock VRF oracle — never by a user.
/// Receives 32 bytes of verifiable randomness, runs the distribution
/// algorithm, and writes amount_due into every Participant PDA.
///
/// remaining_accounts must contain all Participant PDAs in join_index order.
#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    /// SECURITY: First and most critical check.
    /// Must equal VRF_PROGRAM_IDENTITY — ensures this callback
    /// can only be invoked by the real VRF oracle, never spoofed.
    #[account(
        address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY,
    )]
    pub vrf_program_identity: Signer<'info>,

    #[account(
        mut,
        seeds = [SESSION_SEED, &session.session_id, session.host.as_ref()],
        bump = session.bump,
    )]
    pub session: Account<'info, Session>,
}

pub fn handler(ctx: Context<ConsumeRandomness>, randomness: [u8; 32]) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(session.state == STATE_REVEALING, ErrorCode::NotRevealing);

    let n = session.participant_count as usize;
    require!(
        ctx.remaining_accounts.len() == n,
        ErrorCode::WrongParticipantCount
    );

    // Store the VRF seed permanently for auditability
    session.vrf_seed = randomness;

    // Run distribution algorithm (integer only, no floats)
    let shares = compute_shares(&randomness, n, session.total_lamports, session.fairness_alpha)?;

    // Write amount_due into each Participant PDA.
    // Validate every PDA before writing — the VRF oracle constructs
    // this tx, not the app, so we cannot trust remaining_accounts ordering.
    let session_key = session.key();

    for (i, acc_info) in ctx.remaining_accounts.iter().enumerate() {
        // Deserialize as Participant and validate ownership
        let mut participant: Account<Participant> = Account::try_from(acc_info)?;

        // Verify PDA derivation — prevents a crafted account from hijacking a slot
        let expected_seeds = &[
            PARTICIPANT_SEED,
            session_key.as_ref(),
            participant.wallet.as_ref(),
        ];
        let (expected_pda, _) = Pubkey::find_program_address(expected_seeds, &crate::ID);
        require!(
            acc_info.key() == expected_pda,
            ErrorCode::InvalidParticipantPda
        );

        // Verify this participant belongs to this session
        require!(
            participant.session == session_key,
            ErrorCode::InvalidParticipantPda
        );

        participant.amount_due = shares[i];

        // Persist the changes back to account data
        participant.exit(&crate::ID)?;
    }

    // Advance state and set the 30-minute payment deadline
    let clock = Clock::get()?;
    session.state = STATE_PAYING;
    session.deadline_ts = clock
        .unix_timestamp
        .checked_add(PAYMENT_DEADLINE_SECS)
        .ok_or(ErrorCode::Overflow)?;

    Ok(())
}

/// Distribution algorithm: integer-only, no floats.
/// Produces N lamport shares that sum to exactly `total`.
/// Fairness bounds: each share stays within [avg*(1-α), avg*(1+α)]
/// where α = fairness_alpha * 10%.
fn compute_shares(
    randomness: &[u8; 32],
    n: usize,
    total: u64,
    fairness_alpha: u8,
) -> Result<Vec<u64>> {
    let avg = total / n as u64;
    let spread_pct = fairness_alpha as u64 * 10; // 1→10%, 10→100%

    // Clamp spread so bounds don't go below 0
    let spread_pct = spread_pct.min(95);

    let min_share = avg.saturating_mul(100 - spread_pct) / 100;
    let max_share = avg
        .checked_mul(100 + spread_pct)
        .ok_or(ErrorCode::Overflow)?
        / 100;

    // Extract raw weights from the 32-byte VRF output.
    // Use 3 bytes per participant → supports up to 10 (3*10=30 < 32).
    // For n > 10, fall back to 2-byte chunks (supports up to 16).
    // MVP caps at 20 participants so we use 1-byte chunks as fallback.
    let bytes_per = if n <= 10 { 3 } else if n <= 16 { 2 } else { 1 };

    let raw: Vec<u64> = (0..n)
        .map(|i| {
            let start = (i * bytes_per).min(31);
            let end = (start + bytes_per).min(32);
            randomness[start..end]
                .iter()
                .fold(0u64, |acc, &b| acc * 256 + b as u64)
                .max(1) // never 0 — avoids degenerate weights
        })
        .collect();

    let raw_sum: u64 = raw
        .iter()
        .try_fold(0u64, |a, &b| a.checked_add(b))
        .ok_or(ErrorCode::Overflow)?;

    // Normalize weights to lamport shares, clamp to fairness bounds
    let mut shares: Vec<u64> = raw
        .iter()
        .map(|&w| {
            let s = (w as u128)
                .checked_mul(total as u128)
                .unwrap_or(u128::MAX)
                / raw_sum as u128;
            (s as u64).clamp(min_share, max_share)
        })
        .collect();

    // Largest-remainder adjustment: makes sum == total exactly.
    // Add or subtract the residual from the largest share.
    let current_sum: u64 = shares
        .iter()
        .try_fold(0u64, |a, &b| a.checked_add(b))
        .ok_or(ErrorCode::Overflow)?;

    let residual = total as i64 - current_sum as i64;
    let max_idx = shares
        .iter()
        .enumerate()
        .max_by_key(|(_, &v)| v)
        .map(|(i, _)| i)
        .unwrap_or(0);

    shares[max_idx] = (shares[max_idx] as i64)
        .checked_add(residual)
        .ok_or(ErrorCode::Overflow)? as u64;

    // Invariant: must equal total exactly before writing to chain
    let final_sum: u64 = shares.iter().sum();
    require!(final_sum == total, ErrorCode::DistributionMismatch);

    Ok(shares)
}