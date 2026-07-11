import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

const NOTIFICATION_EMAIL = 'giordani@outlook.it';

export async function POST(request: Request) {
  try {
    const { nome_contatto, email_contatto, telefono_contatto, nome_lido, piano_preferito, messaggio } = await request.json();

    if (!nome_contatto?.trim() || !nome_lido?.trim()) {
      return NextResponse.json({ error: 'Nome e nome del lido sono obbligatori' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Salva la candidatura nel database
    const { data: candidatura, error } = await supabase
      .from('candidature')
      .insert({
        nome_contatto: nome_contatto.trim(),
        email_contatto: email_contatto?.trim() || null,
        telefono_contatto: telefono_contatto?.trim() || null,
        nome_lido: nome_lido.trim(),
        piano_preferito: piano_preferito || 'commissione_5',
        messaggio: messaggio?.trim() || null,
        stato: 'nuova',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Errore nel salvataggio della candidatura' }, { status: 500 });
    }

    // 2. Invia notifica email tramite Supabase Edge Function o API esterna
    //    Per ora usiamo Resend (se configurato) o un semplice log
    try {
      // Tenta invio email con Resend (se la chiave è configurata)
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'WaveOrder <noreply@waveorder.garganoadvisor.com>',
            to: [NOTIFICATION_EMAIL],
            subject: `🏖️ Nuova Candidatura: ${nome_lido.trim()}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1e293b; margin-bottom: 8px;">Nuova Candidatura WaveOrder</h2>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Un nuovo lido vuole unirsi alla piattaforma!</p>
                
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
                  <table style="width: 100%; font-size: 14px; color: #334155;">
                    <tr><td style="padding: 8px 0; color: #94a3b8; width: 140px;">Nome Contatto:</td><td style="font-weight: 600;">${nome_contatto.trim()}</td></tr>
                    <tr><td style="padding: 8px 0; color: #94a3b8;">Nome Lido:</td><td style="font-weight: 600;">${nome_lido.trim()}</td></tr>
                    ${email_contatto ? `<tr><td style="padding: 8px 0; color: #94a3b8;">Email:</td><td>${email_contatto.trim()}</td></tr>` : ''}
                    ${telefono_contatto ? `<tr><td style="padding: 8px 0; color: #94a3b8;">Telefono:</td><td><a href="tel:${telefono_contatto.trim()}" style="color: #6366f1; font-weight: 600;">${telefono_contatto.trim()}</a></td></tr>` : ''}
                    <tr><td style="padding: 8px 0; color: #94a3b8;">Piano Preferito:</td><td>${piano_preferito || 'Commissione 5%'}</td></tr>
                    ${messaggio ? `<tr><td style="padding: 8px 0; color: #94a3b8;">Messaggio:</td><td>${messaggio.trim()}</td></tr>` : ''}
                  </table>
                </div>
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">WaveOrder — Piattaforma Ordinazioni Stabilimenti Balneari</p>
              </div>
            `,
          }),
        });
      } else {
        // Fallback: log in console (visibile nei log Vercel)
        console.log(`📧 NUOVA CANDIDATURA: ${nome_contatto.trim()} - ${nome_lido.trim()} - Tel: ${telefono_contatto || 'N/D'} - Email: ${email_contatto || 'N/D'}`);
      }
    } catch (emailErr) {
      // L'email è best-effort, non bloccare la risposta
      console.error('Errore invio email notifica:', emailErr);
    }

    return NextResponse.json({ success: true, candidatura });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
