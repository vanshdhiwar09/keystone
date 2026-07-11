#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::Address as _, token};
use fee_router::{FeeRouterContract, FeeRouterContractClient};

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
    
    // Deploy REAL Fee Router securely into the Native Environment
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    
    let platform_addr = Address::generate(&env);
    router_client.initialize(&platform_addr, &contract_id);

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
    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Approved);

    // Call securely distributing milestone logically over Fee Router natively!
    client.distribute_milestone(&job_id, &m1_id);
    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Released);
    
    // Tokens cleanly split successfully proving identical 98% and 2% natively
    assert_eq!(token.balance(&contract_id), 0); // Escrow Empty
    assert_eq!(token.balance(&router_id), 0);   // Router Empty
    assert_eq!(token.balance(&freelancer_addr), 980); // 98% of 1000 (Freelancer)
    assert_eq!(token.balance(&platform_addr), 20);    // 2% of 1000 (Platform Ecosystem)
}

#[test]
#[should_panic(expected = "Fee router is not initialized")]
fn test_distribute_without_router() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    
    // We intentionally SKIP `client.initialize` generating Native Panic natively protecting users!

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

    // Should natively panic gracefully
    client.distribute_milestone(&job_id, &m1_id);
}

#[test]
#[should_panic(expected = "Milestone is not Approved")]
fn test_double_distribute_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.initialize(&platform_addr, &contract_id);
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

    // Valid distribution processing tracking routes synchronously
    client.distribute_milestone(&job_id, &m1_id);

    // Attempt second distribution generating natively expected lockout mechanism
    client.distribute_milestone(&job_id, &m1_id);
}

#[test]
#[should_panic]
fn test_fee_router_unauthorized_route_funds() {
    let env = Env::default();
    // Deliberately do NOT call env.mock_all_auths() — this test proves
    // route_funds rejects calls lacking Escrow's authorization.

    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let escrow_addr = Address::generate(&env);
    let platform_addr = Address::generate(&env);

    // initialize() calls no require_auth, so this succeeds without mocking.
    router_client.initialize(&platform_addr, &escrow_addr);

    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    // This must panic: escrow.require_auth() inside route_funds has no
    // mocked authorization to satisfy, since we never called mock_all_auths().
    router_client.route_funds(&token.address, &freelancer_addr, &1000);
}

#[test]
#[should_panic(expected = "Only the client can add milestones to this job")]
fn test_unauthorized_add_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.initialize(&platform_addr, &contract_id);
    client.initialize(&arbiter, &router_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);

    // Freelancer hacking endpoint
    client.add_milestone(&freelancer_addr, &job_id, &1000);
}

#[test]
#[should_panic(expected = "Only the freelancer can submit work")]
fn test_unauthorized_submit_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.initialize(&platform_addr, &contract_id);
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

    client.submit_milestone(&client_addr, &job_id, &m1_id);
}

#[test]
fn test_dispute_and_refund() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.initialize(&platform_addr, &contract_id);
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
    client.raise_dispute(&freelancer_addr, &job_id, &m1_id);
    client.resolve_dispute(&arbiter, &job_id, &m1_id, &false);

    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Refunded);
    assert_eq!(token.balance(&client_addr), 1000);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_dispute_and_release_to_approved() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let platform_addr = Address::generate(&env);
    router_client.initialize(&platform_addr, &contract_id);
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
    client.submit_milestone(&freelancer_addr, &job_id, &m1_id);
    client.raise_dispute(&client_addr, &job_id, &m1_id);
    
    // Push aggressively to Approved dynamically forwarding directly to route_funds 
    client.resolve_dispute(&arbiter, &job_id, &m1_id, &true);
    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Approved);
}
