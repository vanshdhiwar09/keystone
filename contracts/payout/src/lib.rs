#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, symbol_short, token, Address, Env, Symbol,
};

const ROUTER_ADDR: Symbol = symbol_short!("ROUTER");
const DAY_IN_LEDGERS: u32 = 17280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND: u32 = 14 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PayoutError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
}

#[contract]
pub struct PayoutContract;

#[contractimpl]
impl PayoutContract {
    pub fn init_payout(env: Env, fee_router: Address) -> Result<(), PayoutError> {
        if env.storage().instance().has(&ROUTER_ADDR) {
            return Err(PayoutError::AlreadyInitialized);
        }
        env.storage().instance().set(&ROUTER_ADDR, &fee_router);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
        Ok(())
    }

    pub fn execute_payout(
        env: Env,
        token: Address,
        freelancer: Address,
        amount: i128,
    ) -> Result<(), PayoutError> {
        let router: Address = env
            .storage()
            .instance()
            .get(&ROUTER_ADDR)
            .ok_or(PayoutError::NotInitialized)?;
        
        // Ensure ONLY the Fee Router can legally trigger payouts dynamically.
        router.require_auth();

        let token_client = token::Client::new(&env, &token);
        
        if amount > 0 {
            token_client.transfer(&env.current_contract_address(), &freelancer, &amount);
        }

        Ok(())
    }
}
 
mod test; 
