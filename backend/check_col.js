require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trimEnd().replace(/\\$/, '').trim();
const supabase = createClient(process.env.SUPABASE_URL, key);
async function run() {
  const { error } = await supabase.from('milestones').insert({ job_id: 1, milestone_index: 99, title: 't', description: 'd', amount: 999 }).select();
  if (error) console.log(error);
  else { console.log("Success"); await supabase.from('milestones').delete().eq('milestone_index', 99); }
}
run();
