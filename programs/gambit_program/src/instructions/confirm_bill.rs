use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ConfirmBill {}

pub fn handler(ctx: Context<ConfirmBill>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}
