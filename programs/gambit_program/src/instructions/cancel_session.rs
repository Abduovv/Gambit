use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CancelSession {}

pub fn handler(ctx: Context<CancelSession>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
