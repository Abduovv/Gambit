use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct JoinSession {}

pub fn handler(ctx: Context<JoinSession>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
