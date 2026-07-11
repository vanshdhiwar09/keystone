#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Env, Symbol};

const PLATFORM_ADDR: Symbol = symbol_short!("PLATFORM");
const ESCROW_ADDR: Symbol = symbol_short!("ESCROW");
const DAY_IN_LEDGERS: u32 = 17280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS; 
const TTL_EXTEND: u32 = 14 * DAY_IN_LEDGERS;

#[contract]
pub struct FeeRouterContract;

#[contractimpl]
impl FeeRouterContract {
    pub fn initialize(env: Env, platform: Address, escrow: Address) {
        if env.storage().instance().has(&PLATFORM_ADDR) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&PLATFORM_ADDR, &platform);
        env.storage().instance().set(&ESCROW_ADDR, &escrow);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    pub fn route_funds(
        env: Env,
        token: Address,
        freelancer: Address,
        amount: i128,
    ) {
        let escrow: Address = env.storage().instance().get(&ESCROW_ADDR).expect("Contract uninitialized");
        // Cross-contract enforcement explicitly mapped requiring native soroban auth bounds gracefully executed by caller contract explicitly.
        escrow.require_auth();

        let platform: Address = env.storage().instance().get(&PLATFORM_ADDR).expect("Contract uninitialized");

        // Mathematical integrity perfectly preserving logic without drift
        let platform_fee = (amount * 2) / 100;
        let freelancer_amount = amount - platform_fee;

        let token_client = token::Client::new(&env, &token);
        let contract_address = env.current_contract_address();

        if platform_fee > 0 {
            token_client.transfer(&contract_address, &platform, &platform_fee);
        }

        if freelancer_amount > 0 {
            token_client.transfer(&contract_address, &freelancer, &freelancer_amount);
        }
    }
}
