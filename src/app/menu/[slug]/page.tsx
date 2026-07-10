import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import MenuClient from './MenuClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function MenuPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { token } = await searchParams;

  const supabase = await createClient();

  // 1. Recupera il lido tramite slug
  const { data: lido, error: lidoError } = await supabase
    .from('lidi')
    .select('*')
    .eq('slug', slug)
    .eq('attivo', true)
    .single();

  if (lidoError || !lido) {
    notFound();
  }

  // 2. Se è presente un token per l'ombrellone, cercalo nel DB
  let ombrellone = null;
  if (token) {
    const { data: oData } = await supabase
      .from('ombrelloni')
      .select('*')
      .eq('qr_token', token)
      .eq('lido_id', lido.id)
      .single();
    if (oData) {
      ombrellone = oData;
    }
  }

  // 3. Recupera le categorie attive
  const { data: categories } = await supabase
    .from('categorie_menu')
    .select('*')
    .eq('lido_id', lido.id)
    .eq('attiva', true)
    .order('ordine_visualizzazione', { ascending: true });

  // 4. Recupera tutti i prodotti disponibili
  const { data: products } = await supabase
    .from('prodotti')
    .select('*')
    .eq('lido_id', lido.id)
    .eq('disponibile', true);

  return (
    <MenuClient
      lido={lido}
      initialOmbrellone={ombrellone}
      categories={categories || []}
      products={products || []}
    />
  );
}
