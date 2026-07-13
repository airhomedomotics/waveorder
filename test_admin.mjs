import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: admin } = await supabase.from('super_admins').select('*').eq('user_id', '5c483077-dfcf-4ed9-bbb9-8ea15c761708');
  console.log('Admin:', admin);
  
  const { data: allAdmins } = await supabase.from('super_admins').select('*');
  console.log('All admins:', allAdmins);
}
test();
