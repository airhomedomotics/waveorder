import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import SuperAdminClient from './SuperAdminClient';

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const impersonateLidoId = cookieStore.get('waveorder_impersonate_lido_id')?.value || null;

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
  // - Ordini del lido per statistiche
  const { data: paidOrders } = await supabase
    .from('ordini')
    .select('id, totale, lido_id, metodo_pagamento, stato_pagamento, stato, creato_il');

  // - Commissioni contanti registrate
  const { data: cashCommissions } = await supabase
    .from('commissioni_contanti')
    .select('importo_commissione, lido_id');

  // - Candidature ricevute
  const { data: candidature } = await supabase
    .from('candidature')
    .select('*')
    .order('creato_il', { ascending: false });

  // - Pricing Plans (Tariffari dinamici)
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: pricingPlans } = await adminSupabase
    .from('pricing_plans')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <SuperAdminClient
      initialLidi={lidi || []}
      paidOrders={paidOrders || []}
      cashCommissions={cashCommissions || []}
      candidature={candidature || []}
      initialPricingPlans={pricingPlans || []}
      impersonateLidoId={impersonateLidoId}
    />
  );
}
