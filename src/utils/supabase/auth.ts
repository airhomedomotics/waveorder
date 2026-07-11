import { cookies } from 'next/headers';

export async function getGestore(supabase: any, user: any) {
  if (!user) return null;
  
  // 1. Controlla se l'utente è super admin
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (superAdmin) {
    const cookieStore = await cookies();
    const impersonateLidoId = cookieStore.get('waveorder_impersonate_lido_id')?.value;
    if (impersonateLidoId) {
      return { lido_id: impersonateLidoId, ruolo: 'admin' };
    }
  }

  // 2. Fallback al gestore reale
  const { data: gestoreList } = await supabase
    .from('lidi_gestori')
    .select('lido_id, ruolo')
    .eq('user_id', user.id)
    .limit(1);

  if (!gestoreList || gestoreList.length === 0) return null;
  return gestoreList[0];
}
