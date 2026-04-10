use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct DepositShare {}

pub fn handler(ctx: Context<DepositShare>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
