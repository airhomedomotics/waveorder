import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import LidoAdminClient from './LidoAdminClient';

export default async function LidoAdminDashboardPage() {
  const supabase = await createClient();

  // 1. Verifica autenticazione
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // 2. Mappa l'utente gestore al lido
  const { data: gestoreList, error: gestoreError } = await supabase
    .from('lidi_gestori')
    .select('lido_id, ruolo')
    .eq('user_id', user.id)
    .limit(1);

  const gestore = gestoreList?.[0];

  if (gestoreError || !gestore || gestore.ruolo !== 'admin') {
    // Solo gli amministratori del lido possono accedere al pannello di gestione impostazioni
    redirect('/dashboard/orders');
  }

  // 3. Recupera dettagli lido
  const { data: lido } = await supabase
    .from('lidi')
    .select('*')
    .eq('id', gestore.lido_id)
    .single();

  // 4. Calcola statistiche specifiche del lido
  // - Tutti gli ordini del lido
  const { data: orders } = await supabase
    .from('ordini')
    .select('totale, metodo_pagamento, stato_pagamento, stato')
    .eq('lido_id', gestore.lido_id);

  // - Commissioni contanti accumulate
  const { data: cashCommissions } = await supabase
    .from('commissioni_contanti')
    .select('importo_commissione')
    .eq('lido_id', gestore.lido_id);

  return (
    <LidoAdminClient
      lido={lido!}
      orders={orders || []}
      cashCommissions={cashCommissions || []}
    />
  );
}
