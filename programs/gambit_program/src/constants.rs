use anchor_lang::prelude::*;

pub const USDT_MINT: Pubkey = Pubkey::from_str("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB").unwrap();


#[constant]
pub const SESSION_SEED: &[u8] = b"session";

#[constant]
pub const PARTICIPANT_SEED: &[u8] = b"participant";

#[constant]
pub const ESCROW_SEED: &[u8] = b"escrow";

#[constant]
pub const RECEIPT_SEED: &[u8] = b"receipt";

pub const MAX_PARTICIPANTS: u8 = 20;
pub const SESSION_EXPIRY_SECS: i64 = 900;   // 15 min: host must start or it expires
pub const PAYMENT_DEADLINE_SECS: i64 = 1800; // 30 min from reveal to pay

// Session states stored as u8
pub const STATE_OPEN: u8 = 0;
pub const STATE_LOCKED: u8 = 1;
pub const STATE_CONFIRMING: u8 = 2;
pub const STATE_REVEALING: u8 = 3;
pub const STATE_PAYING: u8 = 4;
pub const STATE_SETTLING: u8 = 5;
pub const STATE_SETTLED: u8 = 6;
pub const STATE_CANCELLED: u8 = 7;