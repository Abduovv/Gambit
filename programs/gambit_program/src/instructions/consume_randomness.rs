use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ConsumeRandomness {}

pub fn handler(ctx: Context<ConsumeRandomness>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
