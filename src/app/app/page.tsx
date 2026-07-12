import { createClient } from '@/utils/supabase/server';
import AppClient from './AppClient';

export default async function AppDashboardPage() {
  const supabase = await createClient();

  // We fetch a list of active lidi to display in the "Esplora Lidi" section
  const { data: lidi } = await supabase
    .from('lidi')
    .select('id, nome_struttura, slug, colore_primario, logo_url')
    .eq('attivo', true);

  return (
    <AppClient lidi={lidi || []} />
  );
}
