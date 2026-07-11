#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const JOB_CTR: Symbol = symbol_short!("JOB_CTR");
const DAY_IN_LEDGERS: u32 = 17280; // Assuming ~5s per ledger
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS; 
const TTL_EXTEND: u32 = 14 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Created,
    Funded,
    Submitted,
    Approved,
    Disputed,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Job {
    pub client: Address,
    pub freelancer: Address,
    pub milestone_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub amount: i128,
    pub status: Status,
}

#[contracttype]
pub enum DataKey {
    Job(u32),
    Milestone(u32, u32), // job_id, milestone_id
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn create_job(
        env: Env,
        client: Address,
        freelancer: Address,
    ) -> u32 {
        client.require_auth();

        let mut job_id: u32 = env.storage().instance().get(&JOB_CTR).unwrap_or(0);
        job_id += 1;
        env.storage().instance().set(&JOB_CTR, &job_id);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        let job = Job {
            client,
            freelancer,
            milestone_count: 0,
        };

        let key = DataKey::Job(job_id);
        env.storage().persistent().set(&key, &job);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        job_id
    }
    
    pub fn add_milestone(
        env: Env,
        client: Address,
        job_id: u32,
        amount: i128,
    ) -> u32 {
        client.require_auth();

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        let key = DataKey::Job(job_id);
        let mut job: Job = env.storage().persistent().get(&key).expect("Job not found");
        
        if client != job.client {
            panic!("Only the client can add milestones to this job");
        }

        job.milestone_count += 1;
        let milestone_id = job.milestone_count;

        env.storage().persistent().set(&key, &job);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let milestone = Milestone {
            amount,
            status: Status::Created,
        };
        env.storage().persistent().set(&m_key, &milestone);
        env.storage().persistent().extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        milestone_id
    }

    pub fn get_job(env: Env, job_id: u32) -> Job {
        let key = DataKey::Job(job_id);
        let job: Job = env.storage().persistent().get(&key).expect("Job not found");
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        job
    }

    pub fn get_milestone(env: Env, job_id: u32, milestone_id: u32) -> Milestone {
        let key = DataKey::Milestone(job_id, milestone_id);
        let milestone: Milestone = env.storage().persistent().get(&key).expect("Milestone not found");
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        milestone
    }
}

mod test;
