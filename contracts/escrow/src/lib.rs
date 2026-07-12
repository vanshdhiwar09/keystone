#![no_std]
use fee_router::FeeRouterContractClient;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
};

const JOB_CTR: Symbol = symbol_short!("JOB_CTR");
const ADMIN: Symbol = symbol_short!("ADMIN");
const ROUTER_ADDR: Symbol = symbol_short!("ROUTER");
const DAY_IN_LEDGERS: u32 = 17280; // Assuming ~5s per ledger
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND: u32 = 14 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    JobNotFound = 3,
    MilestoneNotFound = 4,
    InvalidAmount = 5,
    SelfDealing = 6,
    NotAuthorizedClient = 7,
    NotAuthorizedFreelancer = 8,
    NotAuthorizedParticipant = 9,
    NotAuthorizedArbiter = 10,
    InvalidStatus = 11,
}

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
    pub fn initialize(env: Env, arbiter: Address, fee_router: Address) -> Result<(), EscrowError> {
        if env.storage().instance().has(&ADMIN) {
            return Err(EscrowError::AlreadyInitialized);
        }
        env.storage().instance().set(&ADMIN, &arbiter);
        env.storage().instance().set(&ROUTER_ADDR, &fee_router);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
        Ok(())
    }

    pub fn create_job(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
    ) -> Result<u32, EscrowError> {
        client.require_auth();

        if client == freelancer {
            return Err(EscrowError::SelfDealing);
        }

        let mut job_id: u32 = env.storage().instance().get(&JOB_CTR).unwrap_or(0);
        job_id += 1;
        env.storage().instance().set(&JOB_CTR, &job_id);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        let job = Job {
            client: client.clone(),
            freelancer: freelancer.clone(),
            token: token.clone(),
            milestone_count: 0,
        };

        let key = DataKey::Job(job_id);
        env.storage().persistent().set(&key, &job);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        env.events()
            .publish((symbol_short!("JOB"), symbol_short!("CREATED")), job_id);

        Ok(job_id)
    }

    pub fn add_milestone(
        env: Env,
        client: Address,
        job_id: u32,
        amount: i128,
    ) -> Result<u32, EscrowError> {
        client.require_auth();

        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        let key = DataKey::Job(job_id);
        let mut job: Job = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::JobNotFound)?;

        if client != job.client {
            return Err(EscrowError::NotAuthorizedClient);
        }

        job.milestone_count += 1;
        let milestone_id = job.milestone_count;

        env.storage().persistent().set(&key, &job);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let milestone = Milestone {
            amount,
            status: Status::Created,
        };
        env.storage().persistent().set(&m_key, &milestone);
        env.storage()
            .persistent()
            .extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("MILESTONE"), symbol_short!("ADDED")),
            (job_id, milestone_id, amount),
        );

        Ok(milestone_id)
    }

    pub fn fund_milestone(
        env: Env,
        client: Address,
        job_id: u32,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        client.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env
            .storage()
            .persistent()
            .get(&job_key)
            .ok_or(EscrowError::JobNotFound)?;

        if client != job.client {
            return Err(EscrowError::NotAuthorizedClient);
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&m_key)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != Status::Created {
            return Err(EscrowError::InvalidStatus);
        }

        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&client, &env.current_contract_address(), &milestone.amount);

        milestone.status = Status::Funded;

        env.storage().persistent().set(&m_key, &milestone);
        env.storage()
            .persistent()
            .extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage()
            .persistent()
            .extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("MILESTONE"), symbol_short!("FUNDED")),
            (job_id, milestone_id),
        );
        Ok(())
    }

    pub fn submit_milestone(
        env: Env,
        freelancer: Address,
        job_id: u32,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        freelancer.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env
            .storage()
            .persistent()
            .get(&job_key)
            .ok_or(EscrowError::JobNotFound)?;

        if freelancer != job.freelancer {
            return Err(EscrowError::NotAuthorizedFreelancer);
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&m_key)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != Status::Funded {
            return Err(EscrowError::InvalidStatus);
        }

        milestone.status = Status::Submitted;
        env.storage().persistent().set(&m_key, &milestone);
        env.storage()
            .persistent()
            .extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage()
            .persistent()
            .extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("MILESTONE"), symbol_short!("SUBMITTED")),
            (job_id, milestone_id),
        );
        Ok(())
    }

    pub fn approve_milestone(
        env: Env,
        client: Address,
        job_id: u32,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        client.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env
            .storage()
            .persistent()
            .get(&job_key)
            .ok_or(EscrowError::JobNotFound)?;

        if client != job.client {
            return Err(EscrowError::NotAuthorizedClient);
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&m_key)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != Status::Submitted {
            return Err(EscrowError::InvalidStatus);
        }

        milestone.status = Status::Approved;
        env.storage().persistent().set(&m_key, &milestone);
        env.storage()
            .persistent()
            .extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage()
            .persistent()
            .extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("MILESTONE"), symbol_short!("APPROVED")),
            (job_id, milestone_id),
        );
        Ok(())
    }

    pub fn raise_dispute(
        env: Env,
        caller: Address,
        job_id: u32,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        caller.require_auth();

        let job_key = DataKey::Job(job_id);
        let job: Job = env
            .storage()
            .persistent()
            .get(&job_key)
            .ok_or(EscrowError::JobNotFound)?;

        if caller != job.client && caller != job.freelancer {
            return Err(EscrowError::NotAuthorizedParticipant);
        }

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&m_key)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != Status::Funded
            && milestone.status != Status::Submitted
            && milestone.status != Status::Approved
        {
            return Err(EscrowError::InvalidStatus);
        }

        milestone.status = Status::Disputed;
        env.storage().persistent().set(&m_key, &milestone);
        env.storage()
            .persistent()
            .extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage()
            .persistent()
            .extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("MILESTONE"), symbol_short!("DISPUTED")),
            (job_id, milestone_id),
        );
        Ok(())
    }

    pub fn resolve_dispute(
        env: Env,
        caller: Address,
        job_id: u32,
        milestone_id: u32,
        release_funds: bool,
    ) -> Result<(), EscrowError> {
        caller.require_auth();

        let arbiter: Address = env
            .storage()
            .instance()
            .get(&ADMIN)
            .ok_or(EscrowError::NotInitialized)?;
        if caller != arbiter {
            return Err(EscrowError::NotAuthorizedArbiter);
        }

        let job_key = DataKey::Job(job_id);
        let job: Job = env
            .storage()
            .persistent()
            .get(&job_key)
            .ok_or(EscrowError::JobNotFound)?;

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&m_key)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != Status::Disputed {
            return Err(EscrowError::InvalidStatus);
        }

        if release_funds {
            milestone.status = Status::Approved;
        } else {
            let token_client = token::Client::new(&env, &job.token);
            token_client.transfer(
                &env.current_contract_address(),
                &job.client,
                &milestone.amount,
            );
            milestone.status = Status::Refunded;
        }

        env.storage().persistent().set(&m_key, &milestone);
        env.storage()
            .persistent()
            .extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage()
            .persistent()
            .extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("MILESTONE"), symbol_short!("RESOLVED")),
            (job_id, milestone_id, release_funds),
        );
        Ok(())
    }

    pub fn distribute_milestone(
        env: Env,
        job_id: u32,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        let router: Address = env
            .storage()
            .instance()
            .get(&ROUTER_ADDR)
            .ok_or(EscrowError::NotInitialized)?;

        let job_key = DataKey::Job(job_id);
        let job: Job = env
            .storage()
            .persistent()
            .get(&job_key)
            .ok_or(EscrowError::JobNotFound)?;

        let m_key = DataKey::Milestone(job_id, milestone_id);
        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&m_key)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != Status::Approved {
            return Err(EscrowError::InvalidStatus);
        }

        let token_client = token::Client::new(&env, &job.token);
        token_client.transfer(&env.current_contract_address(), &router, &milestone.amount);

        let router_client = FeeRouterContractClient::new(&env, &router);
        router_client.route_funds(&job.token, &job.freelancer, &milestone.amount);

        milestone.status = Status::Released;

        env.storage().persistent().set(&m_key, &milestone);
        env.storage()
            .persistent()
            .extend_ttl(&job_key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage()
            .persistent()
            .extend_ttl(&m_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("MILESTONE"), symbol_short!("RELEASED")),
            (job_id, milestone_id),
        );
        Ok(())
    }

    pub fn get_job(env: Env, job_id: u32) -> Result<Job, EscrowError> {
        let key = DataKey::Job(job_id);
        let job: Job = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::JobNotFound)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        Ok(job)
    }

    pub fn get_milestone(
        env: Env,
        job_id: u32,
        milestone_id: u32,
    ) -> Result<Milestone, EscrowError> {
        let key = DataKey::Milestone(job_id, milestone_id);
        let milestone: Milestone = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::MilestoneNotFound)?;
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        Ok(milestone)
    }
}

mod test;
