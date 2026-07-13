import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const giordani = users.users.find(u => u.email === 'giordani@outlook.it');
  if(!giordani) { console.log('User not found'); return; }
  console.log('User ID:', giordani.id);
  const { data: gestore } = await supabase.from('lidi_gestori').select('*').eq('user_id', giordani.id);
  console.log('Gestore:', gestore);
}
test();
