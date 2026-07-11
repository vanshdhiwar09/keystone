#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol};

const JOB_CTR: Symbol = symbol_short!("JOB_CTR");
const ADMIN: Symbol = symbol_short!("ADMIN");
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
    pub token: Address,
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

    pub fn initialize(env: Env, arbiter: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&ADMIN, &arbiter);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    pub fn create_job(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
    ) -> u32 {
        client.require_auth();

        let mut job_id: u32 = env.storage().instance().get(&JOB_CTR).unwrap_or(0);
        job_id += 1;
        env.storage().instance().set(&JOB_CTR, &job_id);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        let job = Job {
            client: client.clone(),
            freelancer: freelancer.clone(),
            token: token.clone(),
            milestone_count: 0,
        };

        let key = DataKey::Job(job_id);
        env.storage().persistent().set(&key, &job);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("JOB"), symbol_short!("CREATED")), job_id);

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

        env.events().publish((symbol_short!("MILESTONE"), symbol_short!("ADDED")), (job_id, milestone_id, amount));

        milestone_id
    }

    pub fn fund_milestone(
        env: Env,
        client: Address,
        job_id: u32,
        milestone_id: u32,
    ) {
        client.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env.storage().persistent().get(&job_key).expect("Job not found");
        
        if client != job.client {
            panic!("Only the client can fund milestones to this job");
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env.storage().persistent().get(&m_key).expect("Milestone not found");

        if milestone.status != Status::Created {
            panic!("Milestone is not in Created status");
        }

        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&client, &env.current_contract_address(), &milestone.amount);

        milestone.status = Status::Funded;
        
        env.storage().persistent().set(&m_key, &milestone);
        env.storage().persistent().extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("MILESTONE"), symbol_short!("FUNDED")), (job_id, milestone_id));
    }

    pub fn submit_milestone(
        env: Env,
        freelancer: Address,
        job_id: u32,
        milestone_id: u32,
    ) {
        freelancer.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env.storage().persistent().get(&job_key).expect("Job not found");

        if freelancer != job.freelancer {
            panic!("Only the freelancer can submit work");
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env.storage().persistent().get(&m_key).expect("Milestone not found");

        if milestone.status != Status::Funded {
            panic!("Milestone is not Funded");
        }

        milestone.status = Status::Submitted;
        env.storage().persistent().set(&m_key, &milestone);
        env.storage().persistent().extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("MILESTONE"), symbol_short!("SUBMITTED")), (job_id, milestone_id));
    }

    pub fn approve_milestone(
        env: Env,
        client: Address,
        job_id: u32,
        milestone_id: u32,
    ) {
        client.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env.storage().persistent().get(&job_key).expect("Job not found");

        if client != job.client {
            panic!("Only the client can approve work");
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env.storage().persistent().get(&m_key).expect("Milestone not found");

        if milestone.status != Status::Submitted {
            panic!("Milestone is not Submitted");
        }

        milestone.status = Status::Approved;
        env.storage().persistent().set(&m_key, &milestone);
        env.storage().persistent().extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("MILESTONE"), symbol_short!("APPROVED")), (job_id, milestone_id));
    }

    pub fn raise_dispute(
        env: Env,
        caller: Address,
        job_id: u32,
        milestone_id: u32,
    ) {
        caller.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env.storage().persistent().get(&job_key).expect("Job not found");

        if caller != job.client && caller != job.freelancer {
            panic!("Only the client or freelancer can raise a dispute");
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env.storage().persistent().get(&m_key).expect("Milestone not found");

        if milestone.status != Status::Funded && milestone.status != Status::Submitted && milestone.status != Status::Approved {
            panic!("Milestone not in a disputable state");
        }

        milestone.status = Status::Disputed;
        env.storage().persistent().set(&m_key, &milestone);
        env.storage().persistent().extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("MILESTONE"), symbol_short!("DISPUTED")), (job_id, milestone_id));
    }

    pub fn resolve_dispute(
        env: Env,
        caller: Address,
        job_id: u32,
        milestone_id: u32,
        release_funds: bool,
    ) {
        caller.require_auth();

        let arbiter: Address = env.storage().instance().get(&ADMIN).expect("Contract uninitialized");
        if caller != arbiter {
            panic!("Only the arbiter can resolve disputes");
        }

        let job_key = DataKey::Job(job_id);
        let job: Job = env.storage().persistent().get(&job_key).expect("Job not found");

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env.storage().persistent().get(&m_key).expect("Milestone not found");

        if milestone.status != Status::Disputed {
            panic!("Milestone is not Disputed");
        }

        if release_funds {
            milestone.status = Status::Approved;
        } else {
            let token_client = token::Client::new(&env, &job.token);
            token_client.transfer(&env.current_contract_address(), &job.client, &milestone.amount);
            milestone.status = Status::Refunded;
        }

        env.storage().persistent().set(&m_key, &milestone);
        env.storage().persistent().extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("MILESTONE"), symbol_short!("RESOLVED")), (job_id, milestone_id, release_funds));
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
