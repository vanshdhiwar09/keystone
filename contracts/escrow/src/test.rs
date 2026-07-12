#![cfg(test)]

use super::*;
use fee_router::{FeeRouterContract, FeeRouterContractClient};
use soroban_sdk::{testutils::Address as _, token, Env};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &sac.address())
}

#[test]
fn test_create_job_and_milestones() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);

    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);

    let platform_addr = Address::generate(&env);
    router_client.init_fee_router(&platform_addr, &contract_id);

    client.initialize(&arbiter, &router_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &10000);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);
    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);

    client.fund_milestone(&client_addr, &job_id, &m1_id);
    client.submit_milestone(&freelancer_addr, &job_id, &m1_id);
    client.approve_milestone(&client_addr, &job_id, &m1_id);
    assert_eq!(
        client.get_milestone(&job_id, &m1_id).status,
        Status::Approved
    );

    client.distribute_milestone(&job_id, &m1_id);
    assert_eq!(
        client.get_milestone(&job_id, &m1_id).status,
        Status::Released
    );

    // Explicit distribution math check mapped correctly
    assert_eq!(token.balance(&contract_id), 0);
    assert_eq!(token.balance(&router_id), 0);
    assert_eq!(token.balance(&freelancer_addr), 980);
    assert_eq!(token.balance(&platform_addr), 20);
}

// ------------------------------------------------------------------------------------------------ //
// NEGATIVE TESTS (NOW VERIFYING STRICT `try_` ERROR RESPONSES INSTEAD OF STRINGS!)
// ------------------------------------------------------------------------------------------------ //

#[test]
fn test_self_dealing_rejection() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    client.initialize(&arbiter, &router_id);

    let client_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    // Call natively attempting to establish self-contract
    let result = client.try_create_job(&client_addr, &client_addr, &token.address);
    assert_eq!(result, Err(Ok(EscrowError::SelfDealing)));
}

#[test]
fn test_distribute_without_router() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    // Purposefully DO NOT setup `client.initialize`

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &10000);

    // To mock distributing, this actually fails earlier on create_job since there is no JOB_CTR initialized limit natively?
    // Wait, JOB_CTR doesn't depend on initialization! So it actually executes.
    // It's technically okay, let's test distribute directly gracefully:
    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);
    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);
    client.fund_milestone(&client_addr, &job_id, &m1_id);
    client.submit_milestone(&freelancer_addr, &job_id, &m1_id);
    client.approve_milestone(&client_addr, &job_id, &m1_id);

    // Now test distribute
    let result = client.try_distribute_milestone(&job_id, &m1_id);
    assert_eq!(result, Err(Ok(EscrowError::NotInitialized)));
}

#[test]
fn test_double_distribute_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.init_fee_router(&platform_addr, &contract_id);
    client.initialize(&arbiter, &router_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &2000);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);
    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);

    client.fund_milestone(&client_addr, &job_id, &m1_id);
    client.submit_milestone(&freelancer_addr, &job_id, &m1_id);
    client.approve_milestone(&client_addr, &job_id, &m1_id);

    client.distribute_milestone(&job_id, &m1_id);

    // Test second
    let result = client.try_distribute_milestone(&job_id, &m1_id);
    assert_eq!(result, Err(Ok(EscrowError::InvalidStatus)));
}

#[test]
fn test_unauthorized_add_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.init_fee_router(&platform_addr, &contract_id);
    client.initialize(&arbiter, &router_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);

    let result = client.try_add_milestone(&freelancer_addr, &job_id, &1000);
    assert_eq!(result, Err(Ok(EscrowError::NotAuthorizedClient)));
}

#[test]
fn test_unauthorized_submit_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.init_fee_router(&platform_addr, &contract_id);
    client.initialize(&arbiter, &router_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &1000);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);

    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);
    client.fund_milestone(&client_addr, &job_id, &m1_id);

    // Try submitting as client instead of freelancer natively
    let result = client.try_submit_milestone(&client_addr, &job_id, &m1_id);
    assert_eq!(result, Err(Ok(EscrowError::NotAuthorizedFreelancer)));
}

#[test]
#[should_panic]
fn test_fee_router_unauthorized_route_funds() {
    let env = Env::default();
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let escrow_addr = Address::generate(&env);
    let platform_addr = Address::generate(&env);

    router_client.init_fee_router(&platform_addr, &escrow_addr);

    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    // SDK requirement explicitly traps failing require_auth() securely generating host panics uniformly
    router_client.route_funds(&token.address, &freelancer_addr, &1000);
}

#[test]
fn test_unauthorized_resolve_dispute_by_client() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.init_fee_router(&platform_addr, &contract_id);
    client.initialize(&arbiter, &router_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &1000);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);
    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);

    client.fund_milestone(&client_addr, &job_id, &m1_id);
    client.raise_dispute(&client_addr, &job_id, &m1_id);

    // Test resolving securely failing explicitly!
    let result = client.try_resolve_dispute(&client_addr, &job_id, &m1_id, &true);
    assert_eq!(result, Err(Ok(EscrowError::NotAuthorizedArbiter)));
}
