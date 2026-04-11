use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::Session;
use crate::vrf::{
    self, create_request_randomness_ix, RequestRandomnessParams,
    SerializableAccountMeta, VrfProgram, SLOT_HASHES_SYSVAR,
};

#[derive(Accounts)]
pub struct RequestReveal<'info> {
    #[account(mut)]
    pub host: Signer<'info>,

    #[account(
        mut,
        seeds = [SESSION_SEED, &session.session_id, host.key().as_ref()],
        bump = session.bump,
        has_one = host @ ErrorCode::NotHost,
    )]
    pub session: Account<'info, Session>,

    /// CHECK: VRF oracle queue — validated by address constraint
    #[account(mut, address = vrf::DEFAULT_QUEUE)]
    pub oracle_queue: UncheckedAccount<'info>,

    /// CHECK: Program identity PDA for VRF signing
    #[account(seeds = [b"identity"], bump)]
    pub program_identity: UncheckedAccount<'info>,

    pub vrf_program: Program<'info, VrfProgram>,

    /// CHECK: Slot hashes sysvar — validated by address constraint
    #[account(address = SLOT_HASHES_SYSVAR)]
    pub slot_hashes: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestReveal>) -> Result<()> {
    let session = &ctx.accounts.session;
    require!(session.state == STATE_CONFIRMING, ErrorCode::NotConfirming);

    // Capture values before mutable borrow
    let session_key = ctx.accounts.session.key();

    // client_seed: XOR fold of session_id + timestamp for entropy
    let clock = Clock::get()?;
    let ts_bytes = clock.unix_timestamp.to_le_bytes();
    let mut seed_input = [0u8; 14]; // 6 + 8
    seed_input[..6].copy_from_slice(&session.session_id);
    seed_input[6..].copy_from_slice(&ts_bytes);
    let client_seed: u8 = seed_input.iter().fold(0u8, |acc, &b| acc ^ b);

    // Build the VRF request instruction
    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.host.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::ConsumeRandomness::DISCRIMINATOR.to_vec(),
        caller_seed: [client_seed; 32],
        accounts_metas: Some(vec![
            SerializableAccountMeta {
                pubkey: session_key,
                is_signer: false,
                is_writable: true,
            },
        ]),
    });

    // Invoke the VRF program with PDA signer
    vrf::invoke_signed_vrf(
        &ctx.accounts.host.to_account_info(),
        &ctx.accounts.program_identity,
        &ctx.accounts.oracle_queue,
        &ctx.accounts.slot_hashes,
        &ix,
        &crate::ID,
    )?;

    // Advance state
    let session = &mut ctx.accounts.session;
    session.state = STATE_REVEALING;

    Ok(())
}
