use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct LockSession {}

pub fn handler(ctx: Context<LockSession>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
