use anchor_lang::prelude::*;

#[account]
pub struct Participant<'info> {
    pub session: Pubkey,
    pub owner: Pubkey,
    pub confirmed: bool,
    
}
