import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import OmbrelloniClient from './OmbrelloniClient';

export default async function OmbrelloniPage() {
  const supabase = await createClient();

  // 1. Verifica autenticazione
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // 2. Mappa gestore
  const { data: gestoreList, error: gestoreError } = await supabase
    .from('lidi_gestori')
    .select('lido_id, ruolo')
    .eq('user_id', user.id)
    .limit(1);

  const gestore = gestoreList?.[0];

  if (gestoreError || !gestore || gestore.ruolo !== 'admin') {
    redirect('/dashboard/orders');
  }

  // 3. Recupera spiaggia attuale (lidi details & ombrelloni list)
  const { data: lido } = await supabase
    .from('lidi')
    .select('slug, nome_struttura')
    .eq('id', gestore.lido_id)
    .single();

  const { data: ombrelloni } = await supabase
    .from('ombrelloni')
    .select('*')
    .eq('lido_id', gestore.lido_id)
    .order('codice_identificativo', { ascending: true });

  return (
    <OmbrelloniClient
      lidoId={gestore.lido_id}
      lidoSlug={lido!.slug}
      initialOmbrelloni={ombrelloni || []}
    />
  );
}
