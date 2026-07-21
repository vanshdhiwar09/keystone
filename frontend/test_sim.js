const { rpc, Networks, TransactionBuilder, Contract, xdr, Address, Keypair } = require('@stellar/stellar-sdk');
async function main() {
    const kp = Keypair.random();
    console.log('Funding:', kp.publicKey());
    await fetch('https://friendbot.stellar.org/?addr=' + kp.publicKey());
    const server = new rpc.Server('https://soroban-testnet.stellar.org');
    const contractId = 'CDGPQTIF6NDWO23H4G6UR6AHD7YR6C77WAHP4227KWNJAE4METXK2VJQ';
    try {
        const account = await server.getAccount(kp.publicKey());
        const contract = new Contract(contractId);
        const operation = contract.call('fund_milestone', new Address(kp.publicKey()).toScVal(), xdr.ScVal.scvU32(9999), xdr.ScVal.scvU32(1));
        const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(operation).setTimeout(30).build();
        const sim = await server.simulateTransaction(tx);
        console.log(JSON.stringify(sim, null, 2));
    } catch (e) {
        console.error('Simulation Threw:', e);
    }
}
main();
