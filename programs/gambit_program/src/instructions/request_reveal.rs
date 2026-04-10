use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::Session;

#[vrf]
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

    /// CHECK: VRF oracle queue — validated by VRF SDK
    #[account(
        mut,
        address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE,
    )]
    pub oracle_queue: AccountInfo<'info>,
}

pub fn handler(ctx: Context<RequestReveal>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(session.state == STATE_CONFIRMING, ErrorCode::NotConfirming);

    // client_seed: first byte of sha256(session_id || unix_ts)
    // Adds entropy so even same session_id at different times gets different output
    let clock = Clock::get()?;
    let ts_bytes = clock.unix_timestamp.to_le_bytes();
    let mut seed_input = [0u8; 14]; // 6 + 8
    seed_input[..6].copy_from_slice(&session.session_id);
    seed_input[6..].copy_from_slice(&ts_bytes);

    // Simple hash: XOR fold into one byte as the client_seed
    let client_seed: u8 = seed_input.iter().fold(0u8, |acc, &b| acc ^ b);

    // Build the VRF request. The oracle will call consume_randomness (0x05)
    // on our program once randomness is ready.
    // We pass the session account so consume_randomness can load it.
    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.host.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::ConsumeRandomness::DISCRIMINATOR.to_vec(),
        caller_seed: [client_seed; 32],
        accounts_metas: Some(vec![
            SerializableAccountMeta {
                pubkey: ctx.accounts.session.key(),
                is_signer: false,
                is_writable: true,
            },
        ]),
        ..Default::default()
    });

    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.host.to_account_info(), &ix)?;

    session.state = STATE_REVEALING;

    Ok(())
}