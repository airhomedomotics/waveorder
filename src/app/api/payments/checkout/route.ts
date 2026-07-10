import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15' as any, // Adatta a versioni stabili
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lido_id, ombrellone_id, numero_ombrellone_manuale, items, fidelity_discount } = body;

    if (!lido_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Dati carrello non validi' }, { status: 400 });
    }

    // 1. Recupera le informazioni del lido (contratto, stripe_account_id)
    const { data: lido, error: lidoError } = await supabase
      .from('lidi')
      .select('*')
      .eq('id', lido_id)
      .single();

    if (lidoError || !lido) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    if (!lido.pagamenti_digitali_attivi || !lido.stripe_account_id) {
      return NextResponse.json({ error: 'I pagamenti digitali non sono attivi per questa struttura' }, { status: 400 });
    }

    // 2. Recupera i prodotti dal database per validare i prezzi (evitare manomissioni lato client)
    const productIds = items.map((item: any) => item.prodotto_id);
    const { data: dbProducts, error: productsError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo')
      .in('id', productIds)
      .eq('lido_id', lido_id)
      .eq('disponibile', true);

    if (productsError || !dbProducts || dbProducts.length !== productIds.length) {
      return NextResponse.json({ error: 'Alcuni prodotti nel carrello non sono disponibili' }, { status: 400 });
    }

    // Costruisci mappa prezzi e convalida totali
    let totale = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const dettagliOrdineDaInserire: any[] = [];

    for (const item of items) {
      const dbProduct = dbProducts.find((p) => p.id === item.prodotto_id);
      if (!dbProduct) {
        return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 400 });
      }

      const itemTotal = Number(dbProduct.prezzo) * item.quantita;
      totale += itemTotal;

      // Elemento linea Stripe
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: dbProduct.nome,
          },
          unit_amount: Math.round(Number(dbProduct.prezzo) * 100), // Stripe accetta centesimi
        },
        quantity: item.quantita,
      });

      dettagliOrdineDaInserire.push({
        prodotto_id: dbProduct.id,
        quantita: item.quantita,
        prezzo_unitario: dbProduct.prezzo,
        note: item.note || '',
      });
    }

    // Applica Sconto Punti Fidelity
    const hasFidelityDiscount = fidelity_discount === true;
    const discountAmount = hasFidelityDiscount ? 5.00 : 0.00;
    const finalTotale = Math.max(0, totale - discountAmount);

    let umbrellaName = numero_ombrellone_manuale || null;
    if (hasFidelityDiscount && umbrellaName) {
      umbrellaName = `${umbrellaName} [SCONTO PUNTI -5€]`;
    }

    // 3. Crea l'ordine pendente nel database
    const { data: ordine, error: orderError } = await supabase
      .from('ordini')
      .insert({
        lido_id,
        ombrellone_id: ombrellone_id || null,
        numero_ombrellone_manuale: umbrellaName,
        totale: finalTotale,
        stato: 'inviato',
        metodo_pagamento: 'carta_stripe',
        stato_pagamento: 'in_attesa',
      })
      .select()
      .single();

    if (orderError || !ordine) {
      return NextResponse.json({ error: `Errore creazione ordine: ${orderError?.message}` }, { status: 500 });
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
      // Pulisce l'ordine se fallisce l'inserimento dei dettagli
      await supabase.from('ordini').delete().eq('id', ordine.id);
      return NextResponse.json({ error: 'Errore nel salvataggio dei dettagli ordine' }, { status: 500 });
    }

    // 4. Calcola l'application fee (commissione per la piattaforma) in base al contratto sul totale scontato
    let feeAmountInCents = 0;
    const commissionePercentuale = Number(lido.quota_commissione_percentuale);

    if (lido.tipo_contratto === 'commissione_piena' || lido.tipo_contratto === 'ibrido') {
      if (commissionePercentuale > 0) {
        feeAmountInCents = Math.round(finalTotale * (commissionePercentuale / 100) * 100);
      }
    }

    // Assicurati che la fee non superi il totale scontato
    const maxFee = Math.round(finalTotale * 100);
    if (feeAmountInCents > maxFee) {
      feeAmountInCents = maxFee;
    }

    // Genera coupon Stripe temporaneo per applicare lo sconto nel checkout ospitato
    let discountCouponId = undefined;
    if (hasFidelityDiscount && finalTotale > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: 500, // 5€ sconto
        currency: 'eur',
        duration: 'once',
      });
      discountCouponId = coupon.id;
    }

    // 5. Crea la sessione di checkout Stripe Connect
    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/menu/${lido.slug}/success?order_id=${ordine.id}`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/menu/${lido.slug}/checkout?cancel=true`;

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      discounts: discountCouponId ? [{ coupon: discountCouponId }] : undefined,
      metadata: {
        ordine_id: ordine.id,
        lido_id: lido.id,
      },
      payment_intent_data: {
        application_fee_amount: feeAmountInCents > 0 ? feeAmountInCents : undefined,
        transfer_data: {
          destination: lido.stripe_account_id,
        },
      },
    };

    const session = await stripe.checkout.sessions.create(checkoutParams);

    // Salva lo stripe_charge_id (in questo caso la session id) nell'ordine per rintracciabilità
    await supabase
      .from('ordini')
      .update({ stripe_charge_id: session.id })
      .eq('id', ordine.id);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
