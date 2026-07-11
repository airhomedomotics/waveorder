'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Users, ShieldAlert, Check, X, Plus, Settings, Eye, HelpCircle, Inbox, Phone, Mail, Clock, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface Lido {
  id: string;
  nome_struttura: string;
  slug: string;
  email_amministratore: string;
  logo_url: string | null;
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

interface Order {
  id: string;
  totale: number | string;
  lido_id: string;
  metodo_pagamento: string;
  stato_pagamento: string;
  stato: string;
  creato_il: string;
}

interface CashCommission {
  importo_commissione: number | string;
  lido_id: string;
}

interface Candidatura {
  id: string;
  nome_contatto: string;
  email_contatto: string | null;
  telefono_contatto: string | null;
  nome_lido: string;
  piano_preferito: string;
  stato: 'nuova' | 'contattato' | 'approvata' | 'rifiutata';
  creato_il: string;
}

interface SuperAdminClientProps {
  initialLidi: Lido[];
  paidOrders: Order[];
  cashCommissions: CashCommission[];
  candidature: Candidatura[];
  impersonateLidoId: string | null;
}

export default function SuperAdminClient({ 
  initialLidi, 
  paidOrders, 
  cashCommissions, 
  candidature: initialCandidature,
  impersonateLidoId
}: SuperAdminClientProps) {
  const [lidi, setLidi] = useState<Lido[]>(initialLidi);
  const [candidature, setCandidature] = useState<Candidatura[]>(initialCandidature);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Stato per la visualizzazione dettagliata del lido (Scheda Cliente & Analisi)
  const [selectedLido, setSelectedLido] = useState<Lido | null>(null);
  const [editTipoContratto, setEditTipoContratto] = useState<'commissione_piena' | 'ibrido' | 'stagionale_flat'>('commissione_piena');
  const [editCommissione, setEditCommissione] = useState<number>(0);
  const [editCanoneMensile, setEditCanoneMensile] = useState<number>(0);
  const [editCanoneStagionale, setEditCanoneStagionale] = useState<number>(0);
  const [editAccettaContanti, setEditAccettaContanti] = useState<boolean>(true);
  const [editAttivo, setEditAttivo] = useState<boolean>(true);
  const [isUpdatingLido, setIsUpdatingLido] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  // Campi form nuovo lido
  const [nomeStruttura, setNomeStruttura] = useState('');
  const [slug, setSlug] = useState('');
  const [tipoContratto, setTipoContratto] = useState<'commissione_piena' | 'ibrido' | 'stagionale_flat'>('commissione_piena');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calcola il guadagno stimato della piattaforma per ciascun lido
  const lidiEarnings = useMemo(() => {
    const earnings: Record<string, number> = {};
    
    lidi.forEach(l => {
      // 1. Commissioni contanti accumulate
      const cashCommSum = cashCommissions
        .filter(c => c.lido_id === l.id)
        .reduce((sum, c) => sum + Number(c.importo_commissione), 0);

      // 2. Commissioni Stripe Connect
      const stripeOrders = paidOrders.filter(
        o => o.lido_id === l.id && o.metodo_pagamento === 'carta_stripe' && o.stato === 'consegnato'
      );
      const stripeCommSum = stripeOrders.reduce((sum, o) => {
        const percentage = Number(l.quota_commissione_percentuale) || 0;
        return sum + (Number(o.totale) * (percentage / 100));
      }, 0);

      earnings[l.id] = cashCommSum + stripeCommSum;
    });

    return earnings;
  }, [lidi, paidOrders, cashCommissions]);

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

  const handleImpersonate = async (lidoId: string | null) => {
    try {
      const res = await fetch('/api/super-admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lido_id: lidoId }),
      });
      const data = await res.json();
      if (data.success) {
        if (lidoId) {
          window.location.href = '/dashboard/admin';
        } else {
          window.location.reload();
        }
      } else {
        alert(data.error || 'Errore durante l\'impersonificazione');
      }
    } catch (err) {
      alert('Errore di rete');
    }
  };

  const handleOpenLidoDetails = (lido: Lido) => {
    setSelectedLido(lido);
    setEditTipoContratto(lido.tipo_contratto as any);
    setEditCommissione(Number(lido.quota_commissione_percentuale) || 0);
    setEditCanoneMensile(Number(lido.canone_mensile_fisso) || 0);
    setEditCanoneStagionale(Number(lido.canone_stagionale_fisso) || 0);
    setEditAccettaContanti(lido.accetta_contanti);
    setEditAttivo(lido.attivo);
    setUpdateError(null);
  };

  const handleSaveLidoDetails = async () => {
    if (!selectedLido) return;
    setIsUpdatingLido(true);
    setUpdateError(null);

    try {
      const res = await fetch('/api/lidi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lido_id: selectedLido.id,
          tipo_contratto: editTipoContratto,
          quota_commissione_percentuale: editCommissione,
          canone_mensile_fisso: editCanoneMensile,
          canone_stagionale_fisso: editCanoneStagionale,
          accetta_contanti: editAccettaContanti,
          attivo: editAttivo
        }),
      });

      const data = await res.json();
      if (data.error) {
        setUpdateError(data.error);
      } else if (data.lido) {
        // Aggiorna la lista dei lidi
        setLidi(prev => prev.map(l => l.id === selectedLido.id ? data.lido : l));
        setSelectedLido(data.lido);
        alert('Struttura lido aggiornata con successo!');
      }
    } catch {
      setUpdateError('Errore di rete durante il salvataggio.');
    } finally {
      setIsUpdatingLido(false);
    }
  };

  const selectedLidoStats = useMemo(() => {
    if (!selectedLido) return null;
    
    // Ordini di questo lido specifico
    const lidoOrders = paidOrders.filter(o => o.lido_id === selectedLido.id);
    const paidLidoOrders = lidoOrders.filter(o => o.stato_pagamento === 'pagato');
    
    const transatoTotale = paidLidoOrders.reduce((sum, o) => sum + Number(o.totale), 0);
    const transatoStripe = paidLidoOrders.filter(o => o.metodo_pagamento === 'carta_stripe').reduce((sum, o) => sum + Number(o.totale), 0);
    const transatoContanti = paidLidoOrders.filter(o => o.metodo_pagamento === 'contanti').reduce((sum, o) => sum + Number(o.totale), 0);
    
    const commissioniStripe = transatoStripe * (Number(selectedLido.quota_commissione_percentuale) / 100);
    const commissioniContantiDovute = cashCommissions
      .filter(c => c.lido_id === selectedLido.id)
      .reduce((sum, c) => sum + Number(c.importo_commissione), 0);
      
    // Calcolo tasso cancellazione contanti
    const cashOrders = lidoOrders.filter(o => o.metodo_pagamento === 'contanti');
    const cancelledCashOrders = cashOrders.filter(o => o.stato === 'annullato');
    const tassoCancellazioneContanti = cashOrders.length > 0 ? (cancelledCashOrders.length / cashOrders.length) * 100 : 0;
    
    return {
      transatoTotale,
      transatoStripe,
      transatoContanti,
      commissioniStripe,
      commissioniContantiDovute,
      tassoCancellazioneContanti,
      totaleOrdini: lidoOrders.length,
      ordiniCompletati: lidoOrders.filter(o => o.stato === 'consegnato').length,
      ordiniAnnullati: lidoOrders.filter(o => o.stato === 'annullato').length
    };
  }, [selectedLido, paidOrders, cashCommissions]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 pb-12">
      {impersonateLidoId && (
        <div className="bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 px-6 py-4 rounded-2xl mb-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-indigo-950/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-emerald-450 rounded-full animate-pulse"></span>
            <p className="text-xs font-bold uppercase tracking-wider">
              Impersonificazione attiva: <strong className="text-white font-black">{lidi.find(l => l.id === impersonateLidoId)?.nome_struttura || 'Stabilimento'}</strong>
            </p>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/dashboard/admin"
              className="bg-indigo-650 hover:bg-indigo-650/80 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/10"
            >
              Gestisci Lido
            </Link>
            <button 
              onClick={() => handleImpersonate(null)}
              className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Esci
            </button>
          </div>
        </div>
      )}

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
                <th className="px-6 py-4.5">Guadagno AGY</th>
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
                    <span className="font-extrabold text-sm text-emerald-400">
                      €{(lidiEarnings[lido.id] || 0).toFixed(2)}
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
                    <button
                      onClick={() => handleImpersonate(lido.id)}
                      className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl text-slate-200 border border-slate-750 transition-colors cursor-pointer"
                      title="Accedi al gestionale di questo lido"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      Accedi
                    </button>
                    <button
                      onClick={() => handleOpenLidoDetails(lido)}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold px-3.5 py-2 rounded-xl text-white shadow-md shadow-indigo-600/10 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Visualizza
                    </button>
                    <a
                      href={`/menu/${lido.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
                      title="Apri Menu Cliente"
                    >
                      <Eye className="w-3.5 h-3.5" />
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

      {/* SEZIONE CANDIDATURE */}
      <div className="max-w-7xl mx-auto mt-10">
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-900">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-slate-100">Candidature Lidi</h2>
              <p className="text-xs text-slate-500">{candidature.filter(c => c.stato === 'nuova').length} nuove su {candidature.length} totali</p>
            </div>
          </div>

          {candidature.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Nessuna candidatura ricevuta</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {candidature.map((c) => {
                const statusConfig: Record<string, { label: string; color: string }> = {
                  nuova: { label: 'Nuova', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  contattato: { label: 'Contattato', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
                  approvata: { label: 'Approvata', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  rifiutata: { label: 'Rifiutata', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
                };
                const st = statusConfig[c.stato] || statusConfig.nuova;

                return (
                  <div key={c.id} className="bg-slate-950/50 border border-slate-900 rounded-2xl p-5 hover:border-slate-800 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-sm text-slate-200">{c.nome_lido}</h4>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          <span className="font-medium text-slate-300">{c.nome_contatto}</span>
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          {c.telefono_contatto && (
                            <a href={`tel:${c.telefono_contatto}`} className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium">
                              <Phone className="w-3 h-3" />
                              {c.telefono_contatto}
                            </a>
                          )}
                          {c.email_contatto && (
                            <a href={`mailto:${c.email_contatto}`} className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium">
                              <Mail className="w-3 h-3" />
                              {c.email_contatto}
                            </a>
                          )}
                          <span className="flex items-center gap-1 text-[10px] text-slate-600">
                            <Clock className="w-3 h-3" />
                            {new Date(c.creato_il).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* AZIONI */}
                      <div className="flex gap-2 shrink-0">
                        {c.stato === 'nuova' && (
                          <button
                            onClick={async () => {
                              const { createClient } = await import('@/utils/supabase/client');
                              const supabase = createClient();
                              await supabase.from('candidature').update({ stato: 'contattato' }).eq('id', c.id);
                              setCandidature(prev => prev.map(x => x.id === c.id ? { ...x, stato: 'contattato' } : x));
                            }}
                            className="px-3 py-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-[10px] font-bold hover:bg-sky-500/20 transition-colors"
                          >
                            Contattato
                          </button>
                        )}
                        {(c.stato === 'nuova' || c.stato === 'contattato') && (
                          <button
                            onClick={async () => {
                              const { createClient } = await import('@/utils/supabase/client');
                              const supabase = createClient();
                              await supabase.from('candidature').update({ stato: 'approvata' }).eq('id', c.id);
                              setCandidature(prev => prev.map(x => x.id === c.id ? { ...x, stato: 'approvata' } : x));
                            }}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
                          >
                            Approva
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETTAGLI LIDO (SCHEDA CLIENTE E ANALISI DEL TRANSATO) */}
      {selectedLido && selectedLidoStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative">
            
            {/* HEADER */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-850">
              <div className="flex items-center gap-3">
                {selectedLido.logo_url ? (
                  <img src={selectedLido.logo_url} alt={selectedLido.nome_struttura} className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-lg">
                    {selectedLido.nome_struttura.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="font-extrabold text-xl text-slate-100 flex items-center gap-2">
                    <span>{selectedLido.nome_struttura}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      selectedLido.attivo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {selectedLido.attivo ? 'Attivo' : 'Sospeso'}
                    </span>
                  </h3>
                  <a href={`https://waveorder.garganoadvisor.com/menu/${selectedLido.slug}`} target="_blank" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-0.5 block">
                    Apri Menu: /menu/{selectedLido.slug}
                  </a>
                </div>
              </div>
              <button
                onClick={() => setSelectedLido(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GRIGLIA CONTENUTI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* COLONNA ANALISI TRANSATO (SINISTRA) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Analisi del Transato</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Transato Totale</span>
                    <span className="block text-lg font-black text-white mt-1">€{selectedLidoStats.transatoTotale.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Ordini Totali</span>
                    <span className="block text-lg font-black text-white mt-1">{selectedLidoStats.totaleOrdini}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-3">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">Dettaglio Metodi Pagamento (Saldi Pagati)</span>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-sky-400" /> Stripe:</span>
                    <span className="font-bold text-slate-200">€{selectedLidoStats.transatoStripe.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Contanti:</span>
                    <span className="font-bold text-slate-200">€{selectedLidoStats.transatoContanti.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-slate-900 pt-2 space-y-2">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Commissioni Piattaforma Stimate</span>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Commissioni Stripe:</span>
                      <span className="font-bold text-sky-400">€{selectedLidoStats.commissioniStripe.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Commissioni Contanti Dovute:</span>
                      <span className="font-bold text-emerald-400">€{selectedLidoStats.commissioniContantiDovute.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* ANTI-FRODE */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase mb-2">Prevenzione Evasione Contanti</span>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-xs text-slate-400">Tasso di cancellazione contanti:</span>
                      <span className={`block font-bold text-sm mt-0.5 ${selectedLidoStats.tassoCancellazioneContanti > 10 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
                        {selectedLidoStats.tassoCancellazioneContanti.toFixed(1)}%
                      </span>
                    </div>
                    {selectedLidoStats.tassoCancellazioneContanti > 10 && (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Rischio Evasione Alto
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* COLONNA IMPOSTAZIONI CONTRATTO & SUPER ADMIN (DESTRA) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Configurazione Commerciale & Stato</h4>
                
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-4">
                  
                  {updateError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
                      {updateError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo di Contratto</label>
                    <select
                      value={editTipoContratto}
                      onChange={(e) => setEditTipoContratto(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="commissione_piena">Opzione A (Commissione 5%)</option>
                      <option value="ibrido">Opzione B (Canone 149€/mese + 2%)</option>
                      <option value="stagionale_flat">Opzione C (Flat Stagionale 900€)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Quota Comm. %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editCommissione}
                        onChange={(e) => setEditCommissione(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Fisso Mensile (€)</label>
                      <input
                        type="number"
                        value={editCanoneMensile}
                        onChange={(e) => setEditCanoneMensile(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Fisso Stag. (€)</label>
                      <input
                        type="number"
                        value={editCanoneStagionale}
                        onChange={(e) => setEditCanoneStagionale(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="block text-xs font-bold text-slate-300">Stato Funzionamento</span>
                      <span className="block text-[10px] text-slate-500">Sospendi l'accesso a questo lido</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAttivo}
                      onChange={(e) => setEditAttivo(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                    <div>
                      <span className="block text-xs font-bold text-slate-300">Pagamenti Contanti</span>
                      <span className="block text-[10px] text-slate-500">Forza riattivazione contanti</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAccettaContanti}
                      onChange={(e) => setEditAccettaContanti(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleSaveLidoDetails}
                    disabled={isUpdatingLido}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isUpdatingLido ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      'Salva Impostazioni Commerciali'
                    )}
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm(`Sei sicuro di voler eliminare DEFINITIVAMENTE il lido "${selectedLido.nome_struttura}"?\nQuesta operazione cancellerà tutti i dipendenti, ombrelloni, prodotti, ordini e commissioni ad esso associati e non sarà reversibile.`)) return;
                      try {
                        const res = await fetch(`/api/lidi?id=${selectedLido.id}`, { method: 'DELETE' });
                        const data = await res.json();
                        if (res.ok) {
                          alert('Lido eliminato con successo!');
                          setLidi(prev => prev.filter(l => l.id !== selectedLido.id));
                          setSelectedLido(null);
                        } else {
                          alert(`Errore: ${data.error || 'Cancellazione non riuscita'}`);
                        }
                      } catch {
                        alert('Errore di rete durante la cancellazione.');
                      }
                    }}
                    className="w-full py-3 bg-red-950/20 hover:bg-red-900 border border-red-500/20 hover:border-red-500/30 text-red-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 mt-2"
                  >
                    Elimina Struttura
                  </button>
                </div>
              </div>
            </div>

            {/* SEZIONE ORDINI RECENTI DEL LIDO */}
            <div className="pt-4 border-t border-slate-850">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3.5">Ultimi Ordini</h4>
              <div className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-900 text-slate-500 font-bold bg-slate-950/40">
                      <th className="px-4 py-3">Orario</th>
                      <th className="px-4 py-3">Metodo</th>
                      <th className="px-4 py-3">Totale</th>
                      <th className="px-4 py-3">Stato Ordine</th>
                      <th className="px-4 py-3">Stato Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {paidOrders
                      .filter(o => o.lido_id === selectedLido.id)
                      .slice(0, 5)
                      .map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-2.5">{new Date(o.creato_il).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-2.5 capitalize">{o.metodo_pagamento.replace('_', ' ')}</td>
                          <td className="px-4 py-2.5 font-bold">€{Number(o.totale).toFixed(2)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                              o.stato === 'consegnato' ? 'bg-emerald-500/10 text-emerald-400' : o.stato === 'annullato' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {o.stato}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                              o.stato_pagamento === 'pagato' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {o.stato_pagamento}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {paidOrders.filter(o => o.lido_id === selectedLido.id).length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-500 font-medium">
                          Nessun ordine effettuato per questa struttura
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
