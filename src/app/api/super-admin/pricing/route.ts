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

    const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await adminSupabase
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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verifica privilegi super_admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    
    const { data: isAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .single();
      
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 });
    }

    const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: plans } = await adminSupabase
      .from('pricing_plans')
      .select('*')
      .order('created_at', { ascending: true });

    return NextResponse.json({ success: true, plans });
  } catch (error) {
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
