import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import MenuEditorClient from './MenuEditorClient';

export default async function MenuEditorPage() {
  const supabase = await createClient();

  // 1. Verifica autenticazione
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // 2. Mappa gestore
  const { data: gestore, error: gestoreError } = await supabase
    .from('lidi_gestori')
    .select('lido_id, ruolo')
    .eq('user_id', user.id)
    .single();

  if (gestoreError || !gestore || gestore.ruolo !== 'admin') {
    redirect('/dashboard/orders');
  }

  // 3. Recupera categorie menu
  const { data: categories } = await supabase
    .from('categorie_menu')
    .select('*')
    .eq('lido_id', gestore.lido_id)
    .order('ordine_visualizzazione', { ascending: true });

  // 4. Recupera prodotti
  const { data: products } = await supabase
    .from('prodotti')
    .select('*')
    .eq('lido_id', gestore.lido_id);

  return (
    <MenuEditorClient
      lidoId={gestore.lido_id}
      initialCategories={categories || []}
      initialProducts={products || []}
    />
  );
}
