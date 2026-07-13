import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifica autenticazione utente
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // 2. Verifica privilegi super_admin
    const { data: isAdmin, error: adminError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (adminError || !isAdmin) {
      return NextResponse.json({ error: 'Accesso negato. Solo i Super Admin possono modificare i tariffari.' }, { status: 403 });
    }

    const { id, commission_percent, fixed_monthly_fee, fixed_seasonal_fee } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID piano non fornito' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pricing_plans')
      .update({
        commission_percent: Number(commission_percent),
        fixed_monthly_fee: Number(fixed_monthly_fee),
        fixed_seasonal_fee: Number(fixed_seasonal_fee)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Errore salvataggio piano:", error);
      return NextResponse.json({ error: 'Errore durante il salvataggio nel database' }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: data });

  } catch (error) {
    console.error("Errore innescato da PUT /api/super-admin/pricing:", error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
