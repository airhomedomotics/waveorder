import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import SuccessClient from './SuccessClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order_id?: string; cliente_id?: string }>;
}

export default async function SuccessPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { order_id, cliente_id } = await searchParams;

  if (!order_id) {
    notFound();
  }

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

  // 2. Recupera l'ordine con i suoi dettagli
  const { data: order, error: orderError } = await supabase
    .from('ordini')
    .select(`
      *,
      ombrelloni (codice_identificativo),
      dettagli_ordine (
        id, quantita, prezzo_unitario, note,
        prodotti (nome)
      )
    `)
    .eq('id', order_id)
    .eq('lido_id', lido.id)
    .single();

  if (orderError || !order) {
    notFound();
  }

  return (
    <SuccessClient
      lido={lido}
      initialOrder={order}
      clienteId={cliente_id || null}
    />
  );
}
