import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const body = await request.json();
    const { lido_id } = body;

    const cookieStore = await cookies();

    if (!lido_id) {
      cookieStore.delete('waveorder_impersonate_lido_id');
      return NextResponse.json({ success: true, message: 'Impersonificazione disattivata' });
    }

    cookieStore.set('waveorder_impersonate_lido_id', lido_id, {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24, // 24 ore
    });

    return NextResponse.json({ success: true, message: 'Impersonificazione attiva' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
