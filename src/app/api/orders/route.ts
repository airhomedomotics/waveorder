import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGestore } from '@/utils/supabase/auth';

// GET: Recupera gli ordini (singolo per i clienti via id, o lista completa per i gestori)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');

    // 1. Lettura pubblica di un singolo ordine (per il cliente con QR)
    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from('ordini')
        .select(`
          *,
          lidi (nome_struttura, colore_primario),
          dettagli_ordine (
            id, quantita, prezzo_unitario, note,
            prodotti (nome)
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
      }

      return NextResponse.json({ order });
    }

    // 2. Lettura amministrativa dei gestori
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const gestoreData = await getGestore(supabase, user);

    if (!gestoreData) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    // Filtra ordini per il lido
    const { data: orders, error: dbError } = await supabase
      .from('ordini')
      .select(`
        *,
        ombrelloni (codice_identificativo),
        dettagli_ordine (
          id, quantita, prezzo_unitario, note,
          prodotti (nome)
        )
      `)
      .eq('lido_id', gestoreData.lido_id)
      .order('creato_il', { ascending: false });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crea un ordine con pagamento in contanti (Cash Checkout)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lido_id, ombrellone_id, numero_ombrellone_manuale, items, fidelity_discount, cliente_fidelity_id } = body;

    if (!lido_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Dati carrello non validi' }, { status: 400 });
    }

    // 1. Verifica se il lido accetta contanti
    const { data: lido, error: lidoError } = await supabase
      .from('lidi')
      .select('accetta_contanti, tipo_contratto, quota_commissione_percentuale, fidelity_valore_sconto, bar_ora_apertura, bar_ora_chiusura, cucina_ora_apertura, cucina_ora_chiusura')
      .eq('id', lido_id)
      .single();

    if (lidoError || !lido) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    if (!lido.accetta_contanti) {
      return NextResponse.json({ error: 'I pagamenti in contanti non sono più accettati da questa struttura. Usa il pagamento digitale.' }, { status: 403 });
    }

    // 2. Recupera i prodotti dal database per validare i prezzi e i reparti
    const productIds = items.map((item: any) => item.prodotto_id);
    const { data: dbProducts, error: productsError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, reparto')
      .in('id', productIds)
      .eq('lido_id', lido_id)
      .eq('disponibile', true);

    if (productsError || !dbProducts || dbProducts.length !== productIds.length) {
      return NextResponse.json({ error: 'Alcuni prodotti nel carrello non sono disponibili' }, { status: 400 });
    }

    // Calcola totale
    let totale = 0;
    const dettagliOrdineDaInserire = [];

    // Calcola ora locale di Roma per validazione orari
    const nowStr = new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

    for (const item of items) {
      const dbProduct = dbProducts.find((p) => p.id === item.prodotto_id);
      if (!dbProduct) {
        return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 400 });
      }

      // Validazione orario reparto
      const rep = dbProduct.reparto || 'bar';
      const openTime = rep === 'cucina' ? (lido.cucina_ora_apertura || '12:30') : (lido.bar_ora_apertura || '07:00');
      const closeTime = rep === 'cucina' ? (lido.cucina_ora_chiusura || '17:00') : (lido.bar_ora_chiusura || '20:00');
      if (nowStr < openTime || nowStr > closeTime) {
        return NextResponse.json({ 
          error: `Il reparto ${rep === 'cucina' ? 'Cucina' : 'Bar'} è chiuso in questo orario. Servizio attivo dalle ${openTime} alle ${closeTime}.` 
        }, { status: 400 });
      }

      totale += Number(dbProduct.prezzo) * item.quantita;

      dettagliOrdineDaInserire.push({
        prodotto_id: dbProduct.id,
        quantita: item.quantita,
        prezzo_unitario: dbProduct.prezzo,
        note: item.note || '',
      });
    }

    // Applica lo Sconto Fedeltà (dinamico da impostazioni lido)
    const hasFidelityDiscount = fidelity_discount === true;
    const fidelityDiscountValue = Number(lido.fidelity_valore_sconto) || 5.00;
    const discountAmount = hasFidelityDiscount ? fidelityDiscountValue : 0.00;
    const finalTotale = Math.max(0, totale - discountAmount);

    let umbrellaName = numero_ombrellone_manuale || null;
    if (hasFidelityDiscount && umbrellaName) {
      umbrellaName = `${umbrellaName} [SCONTO PUNTI -${fidelityDiscountValue}€]`;
    }

    // 3. Crea l'ordine contanti nel database
    const { data: ordine, error: orderError } = await supabase
      .from('ordini')
      .insert({
        lido_id,
        ombrellone_id: ombrellone_id || null,
        numero_ombrellone_manuale: umbrellaName,
        totale: finalTotale,
        stato: 'inviato',
        metodo_pagamento: 'contanti',
        stato_pagamento: 'in_attesa',
        cliente_fidelity_id: cliente_fidelity_id || null,
      })
      .select()
      .single();

    if (orderError || !ordine) {
      return NextResponse.json({ error: `Errore inserimento ordine: ${orderError?.message}` }, { status: 500 });
    }

    // Inserisci i dettagli dell'ordine
    const dettagliConOrderId = dettagliOrdineDaInserire.map((d) => ({
      ...d,
      ordine_id: ordine.id,
    }));

    const { error: dettagliError } = await supabase
      .from('dettagli_ordine')
      .insert(dettagliConOrderId);

    if (dettagliError) {
      await supabase.from('ordini').delete().eq('id', ordine.id);
      return NextResponse.json({ error: 'Errore nel salvataggio dei dettagli ordine' }, { status: 500 });
    }

    return NextResponse.json({ ordine, message: 'Ordine inviato con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Modifica lo stato dell'ordine (Gestito dal barista del lido)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    // Autenticazione gestore
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const gestoreData = await getGestore(supabase, user);

    if (!gestoreData) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    const body = await request.json();
    const { id, stato, stato_pagamento } = body;

    if (!id || (!stato && !stato_pagamento)) {
      return NextResponse.json({ error: 'ID ordine e almeno uno stato da aggiornare sono richiesti' }, { status: 400 });
    }

    // Crea campi di aggiornamento
    const updateData: any = {};
    if (stato) updateData.stato = stato;
    if (stato_pagamento) updateData.stato_pagamento = stato_pagamento;

    // Se l'ordine è in contanti ed è stato completato (consegnato), possiamo anche segnarlo come pagato automaticamente
    if (stato === 'consegnato') {
      const { data: currentOrder } = await supabase
        .from('ordini')
        .select('metodo_pagamento')
        .eq('id', id)
        .single();
      
      if (currentOrder && currentOrder.metodo_pagamento === 'contanti') {
        updateData.stato_pagamento = 'pagato';
      }
    }

    const { data: order, error: updateError } = await supabase
      .from('ordini')
      .update(updateData)
      .eq('id', id)
      .eq('lido_id', gestoreData.lido_id) // Assicura che possa aggiornare solo gli ordini della sua struttura
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ order, message: 'Stato ordine aggiornato!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
