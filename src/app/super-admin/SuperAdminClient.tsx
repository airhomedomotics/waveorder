'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Users, ShieldAlert, Check, X, Plus, Settings, Eye, HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface Lido {
  id: string;
  nome_struttura: string;
  slug: string;
  email_amministratore: string;
  tipo_contratto: string;
  quota_commissione_percentuale: number | string;
  canone_mensile_fisso: number | string;
  canone_stagionale_fisso: number | string;
  stripe_account_id: string | null;
  pagamenti_digitali_attivi: boolean;
  accetta_contanti: boolean;
  attivo: boolean;
  creato_il: string;
}

interface PaidOrder {
  totale: number | string;
  lido_id: string;
  metodo_pagamento: string;
}

interface CashCommission {
  importo_commissione: number | string;
}

interface SuperAdminClientProps {
  initialLidi: Lido[];
  paidOrders: PaidOrder[];
  cashCommissions: CashCommission[];
}

export default function SuperAdminClient({ initialLidi, paidOrders, cashCommissions }: SuperAdminClientProps) {
  const [lidi, setLidi] = useState<Lido[]>(initialLidi);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Campi form nuovo lido
  const [nomeStruttura, setNomeStruttura] = useState('');
  const [slug, setSlug] = useState('');
  const [tipoContratto, setTipoContratto] = useState<'commissione_piena' | 'ibrido' | 'stagionale_flat'>('commissione_piena');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calcola metriche aggregate
  const stats = useMemo(() => {
    const totalTransacted = paidOrders.reduce((sum, o) => sum + Number(o.totale), 0);
    
    // Calcola commissioni digitali lorde stimate
    let digitalCommissions = 0;
    paidOrders.forEach((order) => {
      if (order.metodo_pagamento === 'carta_stripe') {
        const lido = lidi.find((l) => l.id === order.lido_id);
        if (lido && (lido.tipo_contratto === 'commissione_piena' || lido.tipo_contratto === 'ibrido')) {
          digitalCommissions += Number(order.totale) * (Number(lido.quota_commissione_percentuale) / 100);
        }
      }
    });

    const totalCashCommissions = cashCommissions.reduce((sum, c) => sum + Number(c.importo_commissione), 0);
    const activeLidiCount = lidi.filter((l) => l.attivo).length;

    return {
      totalTransacted,
      digitalCommissions,
      totalCashCommissions,
      activeLidiCount,
    };
  }, [lidi, paidOrders, cashCommissions]);

  // Genera lo slug automaticamente inserendo caratteri minuscoli separati da trattini
  const handleNomeChange = (val: string) => {
    setNomeStruttura(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  };

  const handleCreateLido = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/lidi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_struttura: nomeStruttura,
          slug,
          tipo_contratto: tipoContratto,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else if (data.lido) {
        setLidi((prev) => [data.lido, ...prev]);
        setIsModalOpen(false);
        // Reset form
        setNomeStruttura('');
        setSlug('');
        setTipoContratto('commissione_piena');
      }
    } catch (err: any) {
      setErrorMsg("Errore di rete durante la creazione del lido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLidoStatus = async (lidoId: string, currentStatus: boolean) => {
    try {
      // Per motivi di semplicità aggiorniamo direttamente tramite l'API PUT lidi
      // e impersoniamo la richiesta (avendo permessi admin lato DB tramite bypass RLS)
      const res = await fetch('/api/lidi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // In Next.js route API, decodifichiamo se l'utente è super admin per consentire modifiche estese.
          // Nel DB le policy RLS sono abilitate: is_super_admin(auth.uid()) consente di effettuare update sui lidi.
          // Quindi questa chiamata funzionerà se l'utente è autenticato ed è super_admin.
        }),
      });
      // In realtà passiamo lidoId e il nuovo stato attivo
      // Modifichiamo l'endpoint per consentire ai super admin di passare un body esteso.
      // Andiamo ad implementare questa logica nell'endpoint `/api/lidi` per supportare il toggle di stato.
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 pb-12">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-900 mb-8 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
            Wave<span className="text-indigo-400">Order</span> Super-Admin
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Pannello di controllo globale della piattaforma SaaS
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/dashboard/orders"
            className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 font-bold px-5 py-3 rounded-xl text-sm flex items-center gap-2 transition-all duration-200"
          >
            Vai al Lido Demo
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Aggiungi Stabilimento
          </button>
        </div>
      </header>

      {/* CARDS METRICHE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-10">
        {/* Card 1: Transato */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transato Totale</span>
            <span className="block text-2xl font-black text-white mt-0.5">€{stats.totalTransacted.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Card 2: Comm digitali */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comm. Stripe Connect</span>
            <span className="block text-2xl font-black text-sky-400 mt-0.5">€{stats.digitalCommissions.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Card 3: Comm contanti */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Commissioni Contanti</span>
            <span className="block text-2xl font-black text-emerald-400 mt-0.5">€{stats.totalCashCommissions.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Card 4: Lidi */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stabilimenti Attivi</span>
            <span className="block text-2xl font-black text-white mt-0.5">{stats.activeLidiCount} / {lidi.length}</span>
          </div>
        </div>
      </div>

      {/* TABELLA DEI LIDI */}
      <main className="max-w-7xl mx-auto bg-slate-900/40 border border-slate-900 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-slate-900 flex justify-between items-center">
          <h2 className="font-extrabold text-lg text-slate-100">Stabilimenti Registrati</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-900 text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-950/20">
                <th className="px-6 py-4.5">Stabilimento</th>
                <th className="px-6 py-4.5">E-mail Gestore</th>
                <th className="px-6 py-4.5">Contratto</th>
                <th className="px-6 py-4.5">Stripe Connected</th>
                <th className="px-6 py-4.5">Stato contanti</th>
                <th className="px-6 py-4.5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {lidi.map((lido) => (
                <tr key={lido.id} className="hover:bg-slate-900/20 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-slate-200">
                    <div>
                      <span>{lido.nome_struttura}</span>
                      <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">slug: {lido.slug}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-medium">{lido.email_amministratore}</td>
                  <td className="px-6 py-4">
                    <span className="capitalize font-bold text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full">
                      {lido.tipo_contratto.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {lido.stripe_account_id ? (
                      <span className="text-emerald-400 flex items-center gap-1 text-xs font-semibold">
                        <Check className="w-4 h-4" />
                        Attivo ({lido.stripe_account_id.slice(0, 10)}...)
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1 text-xs font-semibold">
                        <X className="w-4 h-4" />
                        Non configurato
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {lido.accetta_contanti ? (
                      <span className="text-emerald-400 text-xs font-bold">Attivo</span>
                    ) : (
                      <span className="text-red-400 text-xs font-bold animate-pulse">Sospeso per Frode</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <a
                      href={`/menu/${lido.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl text-slate-200"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Visualizza
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL DI AGGIUNTA LIDO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h3 className="font-extrabold text-xl">Registra Stabilimento</h3>
                <p className="text-xs text-slate-400 mt-0.5">Configurazione commerciale iniziale</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold leading-relaxed p-3 rounded-xl mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateLido} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nome Stabilimento Balneare *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Es. Lido del Sole"
                  value={nomeStruttura}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Slug di Navigazione URL *</label>
                <input 
                  type="text" 
                  required
                  placeholder="es. lido-del-sole"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Tipo Contratto *</label>
                <select
                  value={tipoContratto}
                  onChange={(e) => setTipoContratto(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="commissione_piena">Opzione A (Commissione 5% Full)</option>
                  <option value="ibrido">Opzione B (Canone 149€/mese + 2%)</option>
                  <option value="stagionale_flat">Opzione C (Flat Stagionale 900€)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-indigo-650 hover:bg-indigo-650/80 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all duration-200 mt-6"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  "Crea Lido ed Onboarda"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
