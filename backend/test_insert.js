const fetch = require('node-fetch');
const { Keypair } = require('stellar-sdk');

async function test() {
    const kp = Keypair.random();
    const ts = Date.now();
    const msg = `Keystone job creation: job=999 client=${kp.publicKey()} ts=${ts}`;
    const sig = kp.sign(Buffer.from(msg)).toString('base64');

    console.log("Sending...");
    try {
        const res = await fetch('http://localhost:4000/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: 999,
                title: 'Test Database Insertion API',
                description: 'Validating Supabase connection',
                clientAddress: kp.publicKey(),
                freelancerAddress: Keypair.random().publicKey(),
                milestones: [{ title: 'M1', description: 'desc', amount: 100 }],
                timestamp: ts,
                signedMessage: sig
            })
        });

        console.log(res.status);
        console.log(await res.json());
    } catch (e) {
        console.error(e);
    }
}

test();
