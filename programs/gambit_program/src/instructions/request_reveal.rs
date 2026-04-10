use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RequestReveal {}

pub fn handler(ctx: Context<RequestReveal>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
