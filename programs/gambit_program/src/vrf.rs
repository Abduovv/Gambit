use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use borsh::BorshSerialize;

// ── MagicBlock VRF program constants ──────────────────────────────────

/// VRF oracle program ID (MagicBlock)
pub const VRF_PROGRAM_ID: Pubkey = pubkey!("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");

/// Default oracle queue for randomness requests
pub const DEFAULT_QUEUE: Pubkey = pubkey!("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");

/// VRF oracle identity PDA (used to verify callback signer)
pub const VRF_PROGRAM_IDENTITY: Pubkey = pubkey!("9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw");

/// Slot hashes sysvar address
pub const SLOT_HASHES_SYSVAR: Pubkey = pubkey!("SysvarS1otHashes111111111111111111111111111");

/// Seed for the program identity PDA
pub const IDENTITY: &[u8] = b"identity";

// ── Types for building VRF instructions ───────────────────────────────

#[derive(BorshSerialize)]
pub struct RequestRandomness {
    pub caller_seed: [u8; 32],
    pub callback_program_id: Pubkey,
    pub callback_discriminator: Vec<u8>,
    pub callback_accounts_metas: Vec<SerializableAccountMeta>,
    pub callback_args: Vec<u8>,
}

impl RequestRandomness {
    pub fn to_bytes(&self) -> Vec<u8> {
        // 8-byte discriminator prefix expected by the VRF program
        let mut bytes = vec![3, 0, 0, 0, 0, 0, 0, 0];
        self.serialize(&mut bytes).unwrap();
        bytes
    }
}

#[derive(BorshSerialize, Clone)]
pub struct SerializableAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

// ── Request parameters ────────────────────────────────────────────────

#[derive(Default)]
pub struct RequestRandomnessParams {
    pub payer: Pubkey,
    pub oracle_queue: Pubkey,
    pub callback_program_id: Pubkey,
    pub callback_discriminator: Vec<u8>,
    pub accounts_metas: Option<Vec<SerializableAccountMeta>>,
    pub caller_seed: [u8; 32],
}

// ── Build the CPI instruction ─────────────────────────────────────────

pub fn create_request_randomness_ix(
    params: RequestRandomnessParams,
) -> solana_program::instruction::Instruction {
    solana_program::instruction::Instruction {
        program_id: VRF_PROGRAM_ID,
        accounts: vec![
            solana_program::instruction::AccountMeta::new(params.payer, true),
            solana_program::instruction::AccountMeta::new_readonly(
                Pubkey::find_program_address(&[IDENTITY], &params.callback_program_id).0,
                true,
            ),
            solana_program::instruction::AccountMeta::new(params.oracle_queue, false),
            solana_program::instruction::AccountMeta::new_readonly(
                solana_program::system_program::ID,
                false,
            ),
            solana_program::instruction::AccountMeta::new_readonly(SLOT_HASHES_SYSVAR, false),
        ],
        data: RequestRandomness {
            caller_seed: params.caller_seed,
            callback_program_id: params.callback_program_id,
            callback_discriminator: params.callback_discriminator,
            callback_accounts_metas: params.accounts_metas.unwrap_or_default(),
            callback_args: Vec::new(),
        }
        .to_bytes(),
    }
}

// ── VRF program type for Anchor Program<> usage ───────────────────────

pub struct VrfProgram;

impl Id for VrfProgram {
    fn id() -> Pubkey {
        VRF_PROGRAM_ID
    }
}

// ── invoke_signed helper (replaces the #[vrf] macro impl) ─────────────

pub fn invoke_signed_vrf<'a, 'info>(
    payer: &'a AccountInfo<'info>,
    program_identity: &'a impl ToAccountInfo<'info>,
    oracle_queue: &'a impl ToAccountInfo<'info>,
    slot_hashes: &'a impl ToAccountInfo<'info>,
    ix: &solana_program::instruction::Instruction,
    program_id: &Pubkey,
) -> Result<()> {
    let (_, bump) = Pubkey::find_program_address(&[IDENTITY], program_id);
    solana_program::program::invoke_signed(
        ix,
        &[
            payer.clone(),
            program_identity.to_account_info(),
            oracle_queue.to_account_info(),
            slot_hashes.to_account_info(),
        ],
        &[&[IDENTITY, &[bump]]],
    )?;
    Ok(())
}
