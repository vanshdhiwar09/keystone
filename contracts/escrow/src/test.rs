#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::Address as _};

#[test]
fn test_create_job_and_milestones() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);

    // 1) Create job
    let job_id = client.create_job(&client_addr, &freelancer_addr);
    assert_eq!(job_id, 1);

    let job_info = client.get_job(&job_id);
    assert_eq!(job_info.client, client_addr);
    assert_eq!(job_info.freelancer, freelancer_addr);
    assert_eq!(job_info.milestone_count, 0);

    // 2) Add milestone 1
    let amount_1 = 1000;
    let m1_id = client.add_milestone(&client_addr, &job_id, &amount_1);
    assert_eq!(m1_id, 1);

    // 3) Add milestone 2
    let amount_2 = 2500;
    let m2_id = client.add_milestone(&client_addr, &job_id, &amount_2);
    assert_eq!(m2_id, 2);

    // 4) Verify Job state reflects two milestones
    let updated_job = client.get_job(&job_id);
    assert_eq!(updated_job.milestone_count, 2);

    // 5) Verify independent retrieval of milestones
    let milestone_1 = client.get_milestone(&job_id, &m1_id);
    assert_eq!(milestone_1.amount, amount_1);
    assert_eq!(milestone_1.status, Status::Created);

    let milestone_2 = client.get_milestone(&job_id, &m2_id);
    assert_eq!(milestone_2.amount, amount_2);
    assert_eq!(milestone_2.status, Status::Created);
}

#[test]
#[should_panic]
fn test_unauthorized_add_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);

    let job_id = client.create_job(&client_addr, &freelancer_addr);

    // Try to add milestone as the freelancer instead of the client
    client.add_milestone(&freelancer_addr, &job_id, &1000);
}
