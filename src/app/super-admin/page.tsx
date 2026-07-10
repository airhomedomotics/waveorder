import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import SuperAdminClient from './SuperAdminClient';

export default async function SuperAdminPage() {
  const supabase = await createClient();

  // 1. Verifica autenticazione utente
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // 2. Verifica se l'utente è registrato come super_admin
  const { data: isAdmin, error: adminError } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !isAdmin) {
    // Accesso negato, reindirizza alla home o dashboard ordinaria
    redirect('/');
  }

  // 3. Recupera tutti i lidi per la gestione
  const { data: lidi } = await supabase
    .from('lidi')
    .select('*')
    .order('creato_il', { ascending: false });

  // 4. Calcola statistiche globali della piattaforma
  // - Ordini digitali pagati
  const { data: paidOrders } = await supabase
    .from('ordini')
    .select('totale, lido_id, metodo_pagamento')
    .eq('stato_pagamento', 'pagato');

  // - Commissioni contanti registrate
  const { data: cashCommissions } = await supabase
    .from('commissioni_contanti')
    .select('importo_commissione');

  return (
    <SuperAdminClient
      initialLidi={lidi || []}
      paidOrders={paidOrders || []}
      cashCommissions={cashCommissions || []}
    />
  );
}
