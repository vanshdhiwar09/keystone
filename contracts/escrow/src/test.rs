#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::Address as _, token};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let token_address = env.register_stellar_asset_contract(admin.clone());
    token::Client::new(env, &token_address)
}

#[test]
fn test_create_job_and_milestones() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    
    // Setup token
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &10000);

    // 1) Create job
    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);
    assert_eq!(job_id, 1);

    let job_info = client.get_job(&job_id);
    assert_eq!(job_info.client, client_addr);
    assert_eq!(job_info.freelancer, freelancer_addr);
    assert_eq!(job_info.token, token.address);
    assert_eq!(job_info.milestone_count, 0);

    // 2) Add milestone 1
    let amount_1 = 1000;
    let m1_id = client.add_milestone(&client_addr, &job_id, &amount_1);
    assert_eq!(m1_id, 1);

    // Fund milestone 1
    client.fund_milestone(&client_addr, &job_id, &m1_id);
    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Funded);
    assert_eq!(token.balance(&contract_id), amount_1);
    
    // Submit milestone 1
    client.submit_milestone(&freelancer_addr, &job_id, &m1_id);
    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Submitted);
    
    // Approve milestone 1
    client.approve_milestone(&client_addr, &job_id, &m1_id);
    assert_eq!(client.get_milestone(&job_id, &m1_id).status, Status::Approved);

    // 3) Add milestone 2
    let amount_2 = 2500;
    let m2_id = client.add_milestone(&client_addr, &job_id, &amount_2);
    assert_eq!(m2_id, 2);

    // 4) Verify Job state reflects two milestones
    let updated_job = client.get_job(&job_id);
    assert_eq!(updated_job.milestone_count, 2);
}

#[test]
#[should_panic(expected = "Only the client can add milestones to this job")]
fn test_unauthorized_add_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);

    // Try to add milestone as the freelancer instead of the client
    client.add_milestone(&freelancer_addr, &job_id, &1000);
}

#[test]
#[should_panic(expected = "Only the freelancer can submit work")]
fn test_unauthorized_submit_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&client_addr, &1000);

    let job_id = client.create_job(&client_addr, &freelancer_addr, &token.address);

    let m1_id = client.add_milestone(&client_addr, &job_id, &1000);
    client.fund_milestone(&client_addr, &job_id, &m1_id);

    // Try to submit milestone as the client (should be freelancer)
    client.submit_milestone(&client_addr, &job_id, &m1_id);
}
