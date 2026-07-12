#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::Address as _, token};
use fee_router::{FeeRouterContract, FeeRouterContractClient};
use payout::{PayoutContract, PayoutContractClient};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &sac.address())
}

#[test]
fn test_create_job_and_milestones() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Escrow
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    
    // 2. Fee Router
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    
    // 3. Payout
    let payout_id = env.register(PayoutContract, ());
    let payout_client = PayoutContractClient::new(&env, &payout_id);
    payout_client.init_payout(&router_id);
    
    let platform_addr = Address::generate(&env);
    router_client.init_fee_router(&platform_addr, &contract_id, &payout_id);

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

    // Call successfully routes explicitly spanning Escrow -> Router -> Payout natively!
    client.distribute_milestone(&job_id, &m1_id);
    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Released);
    
    // Exact Math Assertions: Validating physical tokens landing efficiently.
    assert_eq!(token.balance(&contract_id), 0); // Escrow Empty
    assert_eq!(token.balance(&router_id), 0);   // Router Empty
    assert_eq!(token.balance(&payout_id), 0);   // Payout Empty (Net Zero)
    
    assert_eq!(token.balance(&freelancer_addr), 980); // 98% of 1000 successfully bypassed!
    assert_eq!(token.balance(&platform_addr), 20);    // 2% of 1000 locked tightly dynamically!
}

// ------------------------------------------------------------------------------------------------ //
// NEGATIVE TESTS (VERIFYING STRICT `try_` ERROR RESPONSES)
// ------------------------------------------------------------------------------------------------ //

fn setup_three_hop_contracts(env: &Env) -> (Address, EscrowContractClient, Address, FeeRouterContractClient, Address, PayoutContractClient, Address, Address) {
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    let arbiter = Address::generate(&env);
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let payout_id = env.register(PayoutContract, ());
    let payout_client = PayoutContractClient::new(&env, &payout_id);
    let platform_addr = Address::generate(&env);
    
    payout_client.init_payout(&router_id);
    router_client.init_fee_router(&platform_addr, &contract_id, &payout_id);
    client.initialize(&arbiter, &router_id);
    
    (contract_id, client, router_id, router_client, payout_id, payout_client, arbiter, platform_addr)
}

#[test]
fn test_self_dealing_rejection() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client, _, _, _, _, _, _) = setup_three_hop_contracts(&env);

    let client_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

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

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);
    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);
    client.fund_milestone(&client_addr, &job_id, &m1_id);
    client.submit_milestone(&freelancer_addr, &job_id, &m1_id);
    client.approve_milestone(&client_addr, &job_id, &m1_id);

    // Confirms distribute_milestone fails with NotInitialized when the contract was never initialized.
    let result = client.try_distribute_milestone(&job_id, &m1_id);
    assert_eq!(result, Err(Ok(EscrowError::NotInitialized)));
}

#[test]
fn test_double_distribute_milestone() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client, _, _, _, _, _, _) = setup_three_hop_contracts(&env);

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
    let result = client.try_distribute_milestone(&job_id, &m1_id);
    assert_eq!(result, Err(Ok(EscrowError::InvalidStatus)));
}

#[test]
fn test_unauthorized_add_milestone() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client, _, _, _, _, _, _) = setup_three_hop_contracts(&env);

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
    let (_, client, _, _, _, _, _, _) = setup_three_hop_contracts(&env);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &1000);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);
    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);
    client.fund_milestone(&client_addr, &job_id, &m1_id);

    let result = client.try_submit_milestone(&client_addr, &job_id, &m1_id);
    assert_eq!(result, Err(Ok(EscrowError::NotAuthorizedFreelancer)));
}

#[test]
fn test_unauthorized_resolve_dispute_by_client() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client, _, _, _, _, _, _) = setup_three_hop_contracts(&env);

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
    
    let result = client.try_resolve_dispute(&client_addr, &job_id, &m1_id, &true);
    assert_eq!(result, Err(Ok(EscrowError::NotAuthorizedArbiter)));
}

// ------------------------------------------------------------------------------------------------ //
// SECURE OUT-OF-SCOPE SDK AUTHORIZATION METRIC TESTS (CHECKING FALLBACK PANICS DIRECTLY)
// ------------------------------------------------------------------------------------------------ //

#[test]
#[should_panic]
fn test_fee_router_unauthorized_route_funds() {
    let env = Env::default();
    let router_id = env.register(FeeRouterContract, ());
    let router_client = FeeRouterContractClient::new(&env, &router_id);
    let escrow_addr = Address::generate(&env);
    let platform_addr = Address::generate(&env);
    let payout_addr = Address::generate(&env);

    router_client.init_fee_router(&platform_addr, &escrow_addr, &payout_addr);

    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    // Should natively cause escrow.require_auth() inside router logic to strictly panic down dynamically!
    router_client.route_funds(&token.address, &freelancer_addr, &1000);
}

#[test]
#[should_panic]
fn test_payout_unauthorized_execute_payout() {
    let env = Env::default();
    let payout_id = env.register(PayoutContract, ());
    let payout_client = PayoutContractClient::new(&env, &payout_id);
    let router_addr = Address::generate(&env);

    payout_client.init_payout(&router_addr);

    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    // Should natively cause router.require_auth() inside payout logic to strictly panic dynamically!
    payout_client.execute_payout(&token.address, &freelancer_addr, &1000);
}
