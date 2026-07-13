import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15' as any,
});

// POST: Crea un account Stripe Connect e genera il link di onboarding
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedLidoId = body.lido_id;

    // 2. Controlla se è Super Admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let targetLidoId = null;

    if (superAdmin && requestedLidoId) {
      targetLidoId = requestedLidoId;
    } else {
      // 2b. Recupera il lido del gestore normale
      const { data: gestore } = await supabase
        .from('lidi_gestori')
        .select('lido_id, ruolo')
        .eq('user_id', user.id)
        .single();

      if (!gestore || gestore.ruolo !== 'admin') {
        return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
      }
      targetLidoId = gestore.lido_id;
    }

    const { data: lido } = await supabase
      .from('lidi')
      .select('id, nome_struttura, stripe_account_id, email_amministratore')
      .eq('id', targetLidoId)
      .single();

    if (!lido) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    let stripeAccountId = lido.stripe_account_id;

    // 3. Se non esiste ancora un account Connect, crealo
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: lido.email_amministratore || user.email,
        business_profile: {
          name: lido.nome_struttura,
          mcc: '5813', // Codice MCC per bar/ristoranti
        },
        metadata: {
          lido_id: lido.id,
        },
      });

      stripeAccountId = account.id;

      // Salva l'account ID nel database
      await supabase
        .from('lidi')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', lido.id);
    }

    // 4. Genera il link di onboarding (o link di accesso se già completato)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/dashboard/admin/stripe-return?status=refresh`,
      return_url: `${appUrl}/dashboard/admin/stripe-return?status=complete`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
