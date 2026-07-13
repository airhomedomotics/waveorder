'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Shield, Mail, Lock, ArrowRight, Store, Sparkles } from 'lucide-react';

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeLido, setNomeLido] = useState('');
  const [tipoContratto, setTipoContratto] = useState('commissione_5');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg(null);

    try {
      if (isSignUp) {
        // Registrazione Lido + Gestore tramite API dedicata
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            nome_lido: nomeLido,
            tipo_contratto: tipoContratto,
          }),
        });

        const data = await res.json();
        if (data.error) {
          setMsg({ type: 'error', text: data.error });
        } else {
          setMsg({
            type: 'success',
            text: 'Stabilimento registrato con successo! Ora puoi accedere direttamente inserendo le tue credenziali.',
          });
          // Resetta i campi di registrazione e passa alla schermata di accesso
          setNomeLido('');
          setIsSignUp(false);
        }
      } else {
        // Accesso
        const loginEmail = email.includes('@') ? email : `${email}@waveorder.local`;
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) {
          setMsg({ type: 'error', text: error.message });
        } else if (data.user) {
          // Controlla se è Super Admin
          const { data: superAdmin } = await supabase
            .from('super_admins')
            .select('id')
            .eq('user_id', data.user.id)
            .single();

          if (superAdmin) {
            router.push('/super-admin');
            return;
          }

          // Controlla se è gestore lido
          const { data: gestore } = await supabase
            .from('lidi_gestori')
            .select('lido_id')
            .eq('user_id', data.user.id)
            .single();

          if (gestore) {
            router.push('/dashboard/orders');
            return;
          }

          // Ritorna alla home se non è né super-admin né gestore
          router.push('/');
        }
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Si è verificato un errore di rete.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-850 rounded-[2rem] max-w-md w-full p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow Decorativo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Wave<span className="text-indigo-400">Order</span>
          </h1>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
            {isSignUp ? 'Crea un nuovo account' : 'Accedi all\'area riservata'}
          </p>
        </div>

        {msg && (
          <div className={`p-4 rounded-2xl text-xs font-semibold leading-relaxed border ${
            msg.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome del Lido / Stabilimento</label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Es. Lido Sirena"
                    value={nomeLido}
                    onChange={(e) => setNomeLido(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Scegli Piano Commerciale</label>
                <div className="relative">
                  <Sparkles className="w-4 h-4 text-indigo-400 absolute left-4 top-3.5" />
                  <select
                    value={tipoContratto}
                    onChange={(e) => setTipoContratto(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                  >
                    <option value="commissione_5">Opzione A: Commissione 5% (Zero rischi)</option>
                    <option value="ibrido_149">Opzione B: Canone 149€/mese + 2%</option>
                    <option value="flat_stagionale">Opzione C: Flat Stagionale 900€</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Indirizzo Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
              <input
                type="email"
                required
                placeholder="nome@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-colors mt-6"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>{isSignUp ? 'Registrati' : 'Accedi'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMsg(null);
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
          >
            {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati ora'}
          </button>
        </div>
      </div>
    </div>
  );
}
