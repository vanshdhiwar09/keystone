#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::Address as _, token};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &sac.address())
}

#[test]
fn test_payout_reinitialization_rejection() {
    let env = Env::default();
    let payout_id = env.register(PayoutContract, ());
    let client = PayoutContractClient::new(&env, &payout_id);
    let router_addr = Address::generate(&env);

    client.init_payout(&router_addr);
    
    let result = client.try_init_payout(&router_addr);
    assert_eq!(result, Err(Ok(PayoutError::AlreadyInitialized)));
}

#[test]
fn test_payout_successful_transfer() {
    let env = Env::default();
    env.mock_all_auths(); // Mock Fee-Router auth for direct invocation

    let payout_id = env.register(PayoutContract, ());
    let client = PayoutContractClient::new(&env, &payout_id);
    let router_addr = Address::generate(&env);

    client.init_payout(&router_addr);

    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    
    // Mint tokens directly to Payout contract (simulating what FeeRouter does natively)
    token_admin_client.mint(&payout_id, &1000);

    let freelancer_addr = Address::generate(&env);
    
    client.execute_payout(&token.address, &freelancer_addr, &1000);

    // Verify Payout balance perfectly clears itself natively to exactly zero!
    assert_eq!(token.balance(&payout_id), 0);
    // Verify physical transit to freelancer destination seamlessly executes.
    assert_eq!(token.balance(&freelancer_addr), 1000);
}
