import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15' as any,
});

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const sig = request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return NextResponse.json({ error: 'Firma webhook mancante' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } catch (err: any) {
      console.error(`Errore firma webhook Stripe: ${err.message}`);
      return NextResponse.json({ error: `Errore webhook: ${err.message}` }, { status: 400 });
    }

    // Gestione dell'evento completato
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.ordine_id;

      if (orderId) {
        const supabaseAdmin = createAdminClient();

        // 1. Aggiorna lo stato del pagamento dell'ordine a 'pagato'
        const { data: ordine, error: updateError } = await supabaseAdmin
          .from('ordini')
          .update({
            stato_pagamento: 'pagato',
            // Aggiorna anche lo stripe_charge_id reale (payment_intent id)
            stripe_charge_id: session.payment_intent as string || session.id
          })
          .eq('id', orderId)
          .select()
          .single();

        if (updateError || !ordine) {
          console.error(`Errore aggiornamento pagamento ordine ${orderId}:`, updateError);
          return NextResponse.json({ error: 'Errore interno nel salvataggio del pagamento' }, { status: 500 });
        }

        console.log(`Ordine ${orderId} pagato con successo!`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
