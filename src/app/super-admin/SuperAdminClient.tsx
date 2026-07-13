'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Users, ShieldAlert, Check, X, Plus, Settings, Eye, Inbox, Phone, Mail, Clock, CreditCard, ChevronRight, MapPin } from 'lucide-react';
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
        body: JSON.stringify({ nome_struttura: nomeStruttura, slug, tipo_contratto: tipoContratto }),
      });

      const data = await res.json();
      if (data.error) setErrorMsg(data.error);
      else if (data.lido) {
        setLidi((prev) => [data.lido, ...prev]);
        setIsModalOpen(false);
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
        window.location.href = lidoId ? '/dashboard/admin' : '/super-admin';
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
      if (data.error) setUpdateError(data.error);
      else if (data.lido) {
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
    
    const lidoOrders = paidOrders.filter(o => o.lido_id === selectedLido.id);
    const paidLidoOrders = lidoOrders.filter(o => o.stato_pagamento === 'pagato');
    
    const transatoTotale = paidLidoOrders.reduce((sum, o) => sum + Number(o.totale), 0);
    const transatoStripe = paidLidoOrders.filter(o => o.metodo_pagamento === 'carta_stripe').reduce((sum, o) => sum + Number(o.totale), 0);
    const transatoContanti = paidLidoOrders.filter(o => o.metodo_pagamento === 'contanti').reduce((sum, o) => sum + Number(o.totale), 0);
    
    const commissioniStripe = transatoStripe * (Number(selectedLido.quota_commissione_percentuale) / 100);
    const commissioniContantiDovute = cashCommissions
      .filter(c => c.lido_id === selectedLido.id)
      .reduce((sum, c) => sum + Number(c.importo_commissione), 0);
      
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 overflow-x-hidden selection:bg-indigo-500/30">
      {impersonateLidoId && (
        <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border-b border-indigo-500/30 text-indigo-200 px-4 py-3 sm:px-6 sm:py-4 mb-6 sticky top-0 z-50 backdrop-blur-xl shadow-lg shadow-indigo-900/20">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-emerald-450 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-center sm:text-left">
                Impersonificazione attiva: <strong className="text-white font-black">{lidi.find(l => l.id === impersonateLidoId)?.nome_struttura || 'Stabilimento'}</strong>
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Link 
                href="/dashboard/admin"
                className="flex-1 sm:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
              >
                Gestisci
              </Link>
              <button 
                onClick={() => handleImpersonate(null)}
                className="flex-1 sm:flex-none text-center bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="px-4 sm:px-6 pt-6 sm:pt-8 pb-6 border-b border-slate-900/50 mb-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-400">
              WaveOrder<span className="text-indigo-500 text-2xl sm:text-3xl">.HQ</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 uppercase tracking-widest font-bold">
              Pannello di Controllo SaaS Globale
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all duration-300 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nuovo Stabilimento
            </button>
          </div>
        </div>
      </header>

      {/* CARDS METRICHE SCORREVOLI SU MOBILE */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-10">
        <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 snap-x snap-mandatory scrollbar-hide">
          {/* Card 1: Transato */}
          <div className="snap-center shrink-0 w-[85vw] sm:w-auto bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-[2rem] p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transato Totale</span>
              <span className="block text-3xl font-black text-white mt-1 tracking-tight">€{stats.totalTransacted.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Card 2: Comm digitali */}
          <div className="snap-center shrink-0 w-[85vw] sm:w-auto bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-[2rem] p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all"></div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-4 border border-sky-500/20">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comm. Stripe</span>
              <span className="block text-3xl font-black text-sky-400 mt-1 tracking-tight">€{stats.digitalCommissions.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Card 3: Comm contanti */}
          <div className="snap-center shrink-0 w-[85vw] sm:w-auto bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-[2rem] p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group">
             <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comm. Contanti</span>
              <span className="block text-3xl font-black text-emerald-400 mt-1 tracking-tight">€{stats.totalCashCommissions.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Card 4: Lidi */}
          <div className="snap-center shrink-0 w-[85vw] sm:w-auto bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-[2rem] p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group">
             <div className="absolute -right-6 -top-6 w-24 h-24 bg-slate-500/10 rounded-full blur-2xl group-hover:bg-slate-500/20 transition-all"></div>
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-300 flex items-center justify-center mb-4 border border-slate-700">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stabilimenti Attivi</span>
              <span className="block text-3xl font-black text-white mt-1 tracking-tight">{stats.activeLidiCount} <span className="text-lg text-slate-500">/ {lidi.length}</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 max-w-7xl mx-auto space-y-10">
        
        {/* SEZIONE LIDI (Responsive: Cards su Mobile, Tabella su Desktop) */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-black text-2xl text-slate-100 flex items-center gap-3">
              <MapPin className="w-6 h-6 text-indigo-500" />
              Portafoglio Clienti
            </h2>
          </div>

          {/* MOBILE VIEW (Cards) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {lidi.map((lido) => (
              <div key={lido.id} className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-[2rem] p-5 shadow-lg relative overflow-hidden">
                {!lido.attivo && <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-lg text-white mb-1">{lido.nome_struttura}</h3>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 uppercase tracking-wider border border-indigo-500/20">
                      {lido.tipo_contratto.replace('_', ' ')}
                    </span>
                  </div>
                  <button onClick={() => handleOpenLidoDetails(lido)} className="p-2 bg-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/50">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider">Guadagno AGY</span>
                    <span className="block font-black text-emerald-400 text-base mt-0.5">€{(lidiEarnings[lido.id] || 0).toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/50">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider">Stato</span>
                    {lido.stripe_account_id ? (
                      <span className="block font-bold text-sky-400 text-sm mt-0.5 flex items-center gap-1">Stripe OK</span>
                    ) : (
                      <span className="block font-bold text-slate-400 text-sm mt-0.5">Manca Stripe</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleImpersonate(lido.id)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black text-white uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border border-slate-700"
                  >
                    <Users className="w-4 h-4 text-indigo-400" /> Accedi
                  </button>
                  <a
                    href={`/menu/${lido.slug}`}
                    target="_blank"
                    className="w-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors border border-slate-700"
                  >
                    <Eye className="w-5 h-5" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP VIEW (Tabella Glassmorphism) */}
          <div className="hidden md:block bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800/60 text-slate-400 font-bold text-[10px] uppercase tracking-widest bg-slate-950/40">
                    <th className="px-6 py-5">Stabilimento</th>
                    <th className="px-6 py-5">Contratto</th>
                    <th className="px-6 py-5">Guadagno AGY</th>
                    <th className="px-6 py-5">Stripe</th>
                    <th className="px-6 py-5">Contanti</th>
                    <th className="px-6 py-5 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {lidi.map((lido) => (
                    <tr key={lido.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4.5 font-extrabold text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white font-black shrink-0 border border-slate-700">
                            {lido.nome_struttura.charAt(0)}
                          </div>
                          <div>
                            <span className="text-base">{lido.nome_struttura}</span>
                            <span className="block text-[10px] text-slate-500 font-semibold">{lido.email_amministratore}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="font-bold text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full uppercase tracking-wider">
                          {lido.tipo_contratto.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="font-black text-base text-emerald-400">
                          €{(lidiEarnings[lido.id] || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        {lido.stripe_account_id ? (
                          <span className="text-sky-400 flex items-center gap-1.5 text-xs font-bold">
                            <Check className="w-4 h-4" /> Attivo
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-1.5 text-xs font-bold">
                            <X className="w-4 h-4" /> Manca
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5">
                        {lido.accetta_contanti ? (
                          <span className="text-emerald-400 text-xs font-bold">OK</span>
                        ) : (
                          <span className="text-red-400 text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-red-500/10 rounded-lg animate-pulse border border-red-500/20">Sospeso</span>
                        )}
                      </td>
                      <td className="px-6 py-4.5 text-right space-x-2">
                        <button
                          onClick={() => handleImpersonate(lido.id)}
                          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-xl text-white transition-colors cursor-pointer"
                        >
                          Accedi
                        </button>
                        <button
                          onClick={() => handleOpenLidoDetails(lido)}
                          className="inline-flex items-center justify-center bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-bold w-10 h-10 rounded-xl transition-all"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SEZIONE CANDIDATURE */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-black text-2xl text-slate-100 flex items-center gap-3">
              <Inbox className="w-6 h-6 text-amber-500" />
              Lead & Candidature
            </h2>
          </div>
          
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] p-4 sm:p-8 shadow-xl">
            {candidature.length === 0 ? (
              <div className="py-16 text-center">
                <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-base text-slate-500 font-bold">Nessun lead in entrata al momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidature.map((c) => {
                  const statusConfig: Record<string, { label: string; color: string }> = {
                    nuova: { label: 'Nuova Lead', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                    contattato: { label: 'In Trattativa', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
                    approvata: { label: 'Chiusa (Vinta)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                    rifiutata: { label: 'Persa', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
                  };
                  const st = statusConfig[c.stato] || statusConfig.nuova;

                  return (
                    <div key={c.id} className="bg-slate-950/60 border border-slate-800/80 rounded-[1.5rem] p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-black text-lg text-white leading-tight">{c.nome_lido}</h4>
                          <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest shrink-0 ${st.color}`}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 font-bold mb-4">{c.nome_contatto}</p>
                        
                        <div className="space-y-2 mb-6">
                          {c.telefono_contatto && (
                            <a href={`tel:${c.telefono_contatto}`} className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold bg-indigo-500/5 w-fit px-3 py-1.5 rounded-lg">
                              <Phone className="w-3.5 h-3.5" /> {c.telefono_contatto}
                            </a>
                          )}
                          {c.email_contatto && (
                            <a href={`mailto:${c.email_contatto}`} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 font-semibold bg-slate-800/50 w-fit px-3 py-1.5 rounded-lg truncate max-w-full">
                              <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{c.email_contatto}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-4 border-t border-slate-800/80">
                        {c.stato === 'nuova' && (
                          <button
                            onClick={async () => {
                              const { createClient } = await import('@/utils/supabase/client');
                              const supabase = createClient();
                              await supabase.from('candidature').update({ stato: 'contattato' }).eq('id', c.id);
                              setCandidature(prev => prev.map(x => x.id === c.id ? { ...x, stato: 'contattato' } : x));
                            }}
                            className="w-full py-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-sky-500/20 transition-colors"
                          >
                            Segna come Contattato
                          </button>
                        )}
                        {(c.stato === 'nuova' || c.stato === 'contattato') && (
                          <button
                            onClick={async () => {
                              handleNomeChange(c.nome_lido);
                              let contratto = 'commissione_piena';
                              if (c.piano_preferito && c.piano_preferito.toLowerCase().includes('ibrido')) contratto = 'ibrido';
                              if (c.piano_preferito && c.piano_preferito.toLowerCase().includes('flat')) contratto = 'stagionale_flat';
                              setTipoContratto(contratto as any);
                              setIsModalOpen(true);
                              const { createClient } = await import('@/utils/supabase/client');
                              const supabase = createClient();
                              await supabase.from('candidature').update({ stato: 'approvata' }).eq('id', c.id);
                              setCandidature(prev => prev.map(x => x.id === c.id ? { ...x, stato: 'approvata' } : x));
                            }}
                            className="w-full py-2.5 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-500 transition-colors"
                          >
                            Onboarda Stabilimento
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

      </div>

      {/* MODAL DI AGGIUNTA LIDO (Responsive) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md sm:p-6">
          <div className="bg-slate-900 sm:border border-slate-800 rounded-t-[2rem] sm:rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h3 className="font-black text-2xl text-white">Nuovo Lido</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">Configurazione commerciale</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-4 rounded-xl mb-6">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateLido} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nome Stabilimento</label>
                <input 
                  type="text" 
                  required
                  placeholder="Es. Lido del Sole"
                  value={nomeStruttura}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Slug URL</label>
                <input 
                  type="text" 
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Piano Commerciale</label>
                <select
                  value={tipoContratto}
                  onChange={(e) => setTipoContratto(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                >
                  <option value="commissione_piena">Opzione A (Commissione 5% Full)</option>
                  <option value="ibrido">Opzione B (Canone 149€/mese + 2%)</option>
                  <option value="stagionale_flat">Opzione C (Flat Stagionale 900€)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all duration-200 mt-8 mb-4 sm:mb-0"
              >
                {isSubmitting ? 'Creazione...' : "Salva e Onboarda"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETTAGLI LIDO (Responsive) */}
      {selectedLido && selectedLidoStats && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4 z-[60]">
          <div className="bg-slate-900 sm:border border-slate-800 rounded-t-[2rem] sm:rounded-3xl max-w-4xl w-full p-5 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in">
            
            {/* Header Modal */}
            <div className="flex items-start sm:items-center justify-between pb-5 sm:pb-6 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-2xl text-white shadow-inner">
                  {selectedLido.nome_struttura.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-xl sm:text-2xl text-white flex items-center gap-2 flex-wrap">
                    {selectedLido.nome_struttura}
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      selectedLido.attivo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {selectedLido.attivo ? 'Attivo' : 'Sospeso'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-1">/menu/{selectedLido.slug}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLido(null)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white mt-1 sm:mt-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              
              {/* Analisi Finanziaria */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rendiconto Finanziario</h4>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800">
                    <span className="block text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-wider">Transato Totale</span>
                    <span className="block text-xl sm:text-2xl font-black text-white mt-1">€{selectedLidoStats.transatoTotale.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800">
                    <span className="block text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-wider">Ordini Conclusi</span>
                    <span className="block text-xl sm:text-2xl font-black text-white mt-1">{selectedLidoStats.ordiniCompletati}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">Split Pagamenti (Incassato)</span>
                    <div className="flex justify-between items-center text-sm mb-1.5">
                      <span className="text-slate-300 font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-sky-400" /> Stripe</span>
                      <span className="font-black text-white">€{selectedLidoStats.transatoStripe.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-300 font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> Contanti</span>
                      <span className="font-black text-white">€{selectedLidoStats.transatoContanti.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <span className="block text-[10px] text-indigo-400 font-black uppercase tracking-wider mb-2">Revenue Piattaforma</span>
                    <div className="flex justify-between items-center text-sm mb-1.5">
                      <span className="text-slate-400 font-semibold">Da Stripe (Auto)</span>
                      <span className="font-black text-sky-400">€{selectedLidoStats.commissioniStripe.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-semibold">Da Contanti (Da Fatturare)</span>
                      <span className="font-black text-emerald-400">€{selectedLidoStats.commissioniContantiDovute.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {selectedLidoStats.tassoCancellazioneContanti > 10 && (
                  <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                    <span className="block text-[10px] text-red-400 font-black uppercase tracking-wider mb-1">Allarme Evasione</span>
                    <p className="text-xs text-red-300 font-semibold leading-relaxed">
                      Il {selectedLidoStats.tassoCancellazioneContanti.toFixed(1)}% degli ordini in contanti viene annullato. Potenziale frode sulle commissioni.
                    </p>
                  </div>
                )}
              </div>

              {/* Impostazioni Contratto */}
              <div className="space-y-4 pb-6 sm:pb-0">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gestione Contratto & Sicurezza</h4>
                
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-5">
                  {updateError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-bold">
                      {updateError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Piano Attuale</label>
                    <select
                      value={editTipoContratto}
                      onChange={(e) => setEditTipoContratto(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="commissione_piena">A - Commissione 5%</option>
                      <option value="ibrido">B - 149€/mese + 2%</option>
                      <option value="stagionale_flat">C - Flat Stagionale 900€</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Comm. %</label>
                      <input
                        type="number" step="0.1" value={editCommissione} onChange={(e) => setEditCommissione(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Mese €</label>
                      <input
                        type="number" value={editCanoneMensile} onChange={(e) => setEditCanoneMensile(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Stag. €</label>
                      <input
                        type="number" value={editCanoneStagionale} onChange={(e) => setEditCanoneStagionale(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 text-center"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-800/80">
                    <label className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer">
                      <div>
                        <span className="block text-xs font-black text-white mb-0.5">Lido Attivo</span>
                        <span className="block text-[10px] text-slate-400 font-semibold">Disattiva per sospendere l'accesso</span>
                      </div>
                      <input type="checkbox" checked={editAttivo} onChange={(e) => setEditAttivo(e.target.checked)} className="w-5 h-5 rounded border-slate-700 bg-slate-800" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer">
                      <div>
                        <span className="block text-xs font-black text-white mb-0.5">Permetti Contanti</span>
                        <span className="block text-[10px] text-slate-400 font-semibold">Disattiva se sospetti frode</span>
                      </div>
                      <input type="checkbox" checked={editAccettaContanti} onChange={(e) => setEditAccettaContanti(e.target.checked)} className="w-5 h-5 rounded border-slate-700 bg-slate-800" />
                    </label>
                  </div>

                  <button
                    onClick={handleSaveLidoDetails}
                    disabled={isUpdatingLido}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all mt-4"
                  >
                    {isUpdatingLido ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Sei sicuro di voler eliminare DEFINITIVAMENTE il lido "${selectedLido.nome_struttura}"?`)) return;
                      const res = await fetch(`/api/lidi?id=${selectedLido.id}`, { method: 'DELETE' });
                      if (res.ok) {
                        setLidi(prev => prev.filter(l => l.id !== selectedLido.id));
                        setSelectedLido(null);
                      }
                    }}
                    className="w-full py-3 mt-2 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    Elimina Struttura (Danger)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
