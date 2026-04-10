use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeSession {}

pub fn handler(ctx: Context<InitializeSession>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
