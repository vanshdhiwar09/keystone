# Keystone Offshore Jobs API
A pristine, completely standalone Express / TypeScript backend decoupled entirely from the Next.js UI tier specifically crafted to rigorously execute signature verification off-chain without bloat.

## Setup Requirements

You must define the exact `.env` parameters in `backend/.env` naturally before spinning this engine online:
```text
PORT=4000
SUPABASE_URL=YOUR_SUPABASE_DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY=STRONGLY_GUARDED_SUPABASE_SERVICE_ROLE_KEY
```

> [!WARNING]  
> The Service Role Key absolutely never crosses into the UI scope (do **not** write `NEXT_PUBLIC_` inside this specific instance) since we inject it manually here securely bypassing internal Supabase RLS row constraints directly to register Job schemas sequentially offline!

## Bootstrapping Environment
To bring the environment online automatically over `.ts` formats (bypassing compiled directories smoothly in local execution):

```bash
npm install
npm run dev
```

The node cluster will dynamically listen directly on `http://localhost:4000`. By architectural command, CORS strictly filters unauthorized IP pings out explicitly securing `http://localhost:3000` execution flows initially.
