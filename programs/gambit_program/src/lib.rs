pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2JCXdcdhrAz1X2CdwkvpDF6cjUgY8nSHofZsZuV5LpQ1");

#[program]
pub mod gambit_program {
    use super::*;

    // pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    //     initialize::handler(ctx)
    // }
}
