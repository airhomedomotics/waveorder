import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15' as any,
});

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function StripeReturnPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const supabase = await createClient();

  // 1. Verifica autenticazione
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. Recupera il lido
  const { data: gestore } = await supabase
    .from('lidi_gestori')
    .select('lido_id')
    .eq('user_id', user.id)
    .single();

  if (!gestore) {
    redirect('/dashboard/orders');
  }

  const { data: lido } = await supabase
    .from('lidi')
    .select('stripe_account_id')
    .eq('id', gestore.lido_id)
    .single();

  // 3. Verifica lo stato dell'account Stripe Connect
  let isOnboarded = false;
  let needsRefresh = status === 'refresh';

  if (lido?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(lido.stripe_account_id);
      isOnboarded = account.charges_enabled && account.payouts_enabled;

      if (isOnboarded) {
        // Attiva i pagamenti digitali nel database
        await supabase
          .from('lidi')
          .update({ pagamenti_digitali_attivi: true })
          .eq('id', gestore.lido_id);
      }
    } catch {
      needsRefresh = true;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-850 rounded-[2rem] max-w-md w-full p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {isOnboarded ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Stripe Connesso!</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Il tuo account Stripe è stato connesso con successo. I pagamenti con Carta e Apple Pay sono ora <strong className="text-emerald-400">attivi</strong> per i tuoi clienti.
            </p>
            <a
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors"
            >
              Torna alla Dashboard
            </a>
          </>
        ) : needsRefresh ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Sessione Scaduta</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Il link di onboarding è scaduto. Torna alla dashboard e riprova cliccando "Connetti Stripe Connect".
            </p>
            <a
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors"
            >
              Torna alla Dashboard
            </a>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Onboarding Incompleto</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              L'onboarding non è stato completato. Torna alla dashboard e riprova per abilitare i pagamenti digitali.
            </p>
            <a
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors"
            >
              Torna alla Dashboard
            </a>
          </>
        )}
      </div>
    </div>
  );
}
