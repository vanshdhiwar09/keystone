#![cfg(test)]

use super::*;
use payout::{PayoutContract, PayoutContractClient};
use soroban_sdk::{Env, testutils::Address as _, token};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &sac.address())
}

#[test]
fn test_router_reinitialization_rejection() {
    let env = Env::default();
    let router_id = env.register(FeeRouterContract, ());
    let client = FeeRouterContractClient::new(&env, &router_id);
    
    let platform_addr = Address::generate(&env);
    let escrow_addr = Address::generate(&env);
    let payout_addr = Address::generate(&env);

    client.init_fee_router(&platform_addr, &escrow_addr, &payout_addr);
    
    let result = client.try_init_fee_router(&platform_addr, &escrow_addr, &payout_addr);
    assert_eq!(result, Err(Ok(FeeRouterError::AlreadyInitialized)));
}

#[test]
fn test_router_split_math_correctness() {
    let env = Env::default();
    env.mock_all_auths(); // Mock Escrow auth natively for direct invocation

    let router_id = env.register(FeeRouterContract, ());
    let client = FeeRouterContractClient::new(&env, &router_id);
    
    let platform_addr = Address::generate(&env);
    let escrow_addr = Address::generate(&env);
    
    // Register structural dependency natively
    let payout_id = env.register(PayoutContract, ());
    let payout_client = PayoutContractClient::new(&env, &payout_id);
    payout_client.init_payout(&router_id);

    client.init_fee_router(&platform_addr, &escrow_addr, &payout_id);

    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    
    // Mint tokens structurally bridging into generic limits executing native routing dynamically!
    token_admin_client.mint(&router_id, &10000);

    let freelancer_addr = Address::generate(&env);
    
    client.route_funds(&token.address, &freelancer_addr, &10000);

    // Verify exactly mapping execution limits gracefully splitting constraints properly!
    assert_eq!(token.balance(&router_id), 0); // Router clears exactly
    assert_eq!(token.balance(&payout_id), 0); // Payout clears exactly too seamlessly
    assert_eq!(token.balance(&platform_addr), 200); // 2% 
    assert_eq!(token.balance(&freelancer_addr), 9800); // 98%
}
