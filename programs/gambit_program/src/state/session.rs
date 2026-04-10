use anchor_lang::prelude::*;

#[account]
pub struct Session {
    pub host: Pubkey,
    pub escrow_pda: Pubkey,
    pub total_bill: u64,
    pub recipient: Pubkey,
    pub participants_count: u8,
    pub confirmed_count: u8,
    pub status: SessionStatus,
}


pub enum SessionStatus {
    Open,
    Locked,
    Confirming,
    Revealing,
    CalculationComplete,
    Settled
}