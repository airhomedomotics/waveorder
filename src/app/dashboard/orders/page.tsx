import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardOrdersPage(props: { searchParams: Promise<{ reparto?: string }> }) {
  const searchParams = await props.searchParams;
  const targetReparto = searchParams.reparto || 'all';

  const supabase = await createClient();

  // Verifica che l'utente sia loggato
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // Verifica che l'utente sia associato a un lido
  const { data: gestoreList, error: gestoreError } = await supabase
    .from('lidi_gestori')
    .select('lido_id, ruolo')
    .eq('user_id', user.id)
    .limit(1);

  const gestore = gestoreList?.[0];

  if (gestoreError || !gestore) {
    // Se non ha un lido, reindirizzalo all'onboarding
    redirect('/dashboard/onboarding');
  }

  // Recupera i dati del lido per mostrare il branding
  const { data: lido } = await supabase
    .from('lidi')
    .select('*')
    .eq('id', gestore.lido_id)
    .single();

  // Carica gli ordini del lido delle ultime 24 ore (o attivi)
  const { data: initialOrders } = await supabase
    .from('ordini')
    .select(`
      *,
      ombrelloni (codice_identificativo),
      dettagli_ordine (
        id, quantita, prezzo_unitario, note,
        prodotti (nome, reparto)
      )
    `)
    .eq('lido_id', gestore.lido_id)
    .order('creato_il', { ascending: false });

  return (
    <DashboardClient
      lido={lido!}
      initialOrders={initialOrders || []}
      userRole={gestore.ruolo || 'staff'}
      repartoFilter={targetReparto}
    />
  );
}
