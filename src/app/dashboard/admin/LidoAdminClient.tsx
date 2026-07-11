'use client';

import React, { useState, useMemo } from 'react';
import { CreditCard, DollarSign, ArrowLeft, ShieldAlert, CheckCircle, Save, Globe, QrCode, Upload, Users, Search, Trophy, TrendingUp, BarChart3, Settings, ShoppingBag, Activity, Star } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Lido {
  id: string;
  nome_struttura: string;
  slug: string;
  logo_url: string | null;
  colore_primario: string;
  tipo_contratto: string;
  accetta_contanti: boolean;
  pagamenti_digitali_attivi: boolean;
  stripe_account_id: string | null;
  fidelity_attivo: boolean;
  fidelity_soglia_punti: number;
  fidelity_valore_sconto: number | string;
}

interface Order {
  id: string;
  totale: number | string;
  metodo_pagamento: string;
  stato_pagamento: string;
  stato: string;
  creato_il: string;
  dettagli_ordine?: {
    quantita: number;
    prodotti: {
      nome: string;
    } | null;
  }[];
}

interface CashCommission {
  importo_commissione: number | string;
}

interface ClienteFidelity {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  punti_totali: number;
  creato_il: string;
}

interface LidoAdminClientProps {
  lido: Lido;
  orders: Order[];
  cashCommissions: CashCommission[];
  clientiFidelity: ClienteFidelity[];
}

export default function LidoAdminClient({ lido, orders, cashCommissions, clientiFidelity }: LidoAdminClientProps) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'settings' | 'fidelity'>('analytics');
  const [nomeStruttura, setNomeStruttura] = useState(lido.nome_struttura);
  const [logoUrl, setLogoUrl] = useState(lido.logo_url || '');
  const [colorePrimario, setColorePrimario] = useState(lido.colore_primario);
  const [accettaContanti, setAccettaContanti] = useState(lido.accetta_contanti);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [fidelityAttivo, setFidelityAttivo] = useState(lido.fidelity_attivo !== undefined ? lido.fidelity_attivo : true);
  const [fidelitySogliaPunti, setFidelitySogliaPunti] = useState(lido.fidelity_soglia_punti || 100);
  const [fidelityValoreSconto, setFidelityValoreSconto] = useState(Number(lido.fidelity_valore_sconto) || 5.00);
  const [clientiSearch, setClientiSearch] = useState('');
  const supabase = createClient();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingLogo(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${lido.id}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `loghi/${fileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('waveorder')
        .upload(filePath, file);

      if (error) {
        setSaveMessage(`Errore caricamento: ${error.message}`);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('waveorder')
          .getPublicUrl(filePath);
        setLogoUrl(publicUrl);
        setSaveMessage('Logo caricato con successo! Ricorda di salvare le impostazioni.');
      }
    } catch (err) {
      setSaveMessage('Errore di rete durante il caricamento del logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Calcolo statistiche finanziarie del lido
  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.stato_pagamento === 'pagato');
    
    const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.totale), 0);
    const cardSales = paidOrders.filter((o) => o.metodo_pagamento === 'carta_stripe').reduce((sum, o) => sum + Number(o.totale), 0);
    const cashSales = paidOrders.filter((o) => o.metodo_pagamento === 'contanti').reduce((sum, o) => sum + Number(o.totale), 0);
    const averageTicket = paidOrders.length > 0 ? totalSales / paidOrders.length : 0;

    // Calcolo tasso cancellazione contanti settimanale
    const cashOrders = orders.filter((o) => o.metodo_pagamento === 'contanti');
    const cancelledCashOrders = cashOrders.filter((o) => o.stato === 'annullato');
    const cashCancelRate = cashOrders.length > 0 ? (cancelledCashOrders.length / cashOrders.length) * 100 : 0;

    const totalCashDue = cashCommissions.reduce((sum, c) => sum + Number(c.importo_commissione), 0);

    // Calcolo prodotti più venduti
    const productCounts: Record<string, number> = {};
    orders.forEach(order => {
      if (order.stato_pagamento === 'pagato' && order.dettagli_ordine) {
        order.dettagli_ordine.forEach(detail => {
          const name = detail.prodotti?.nome || 'Articolo';
          productCounts[name] = (productCounts[name] || 0) + detail.quantita;
        });
      }
    });

    const topSoldProducts = Object.entries(productCounts)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const totalFidelityPoints = clientiFidelity.reduce((sum, c) => sum + (c.punti_totali || 0), 0);

    return {
      totalSales,
      cardSales,
      cashSales,
      averageTicket,
      cashCancelRate,
      totalCashDue,
      cashOrdersCount: cashOrders.length,
      topSoldProducts,
      totalFidelityPoints,
      paidOrdersCount: paidOrders.length
    };
  }, [orders, cashCommissions, clientiFidelity]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/lidi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_struttura: nomeStruttura,
          logo_url: logoUrl || null,
          colore_primario: colorePrimario,
          accetta_contanti: accettaContanti,
          fidelity_attivo: fidelityAttivo,
          fidelity_soglia_punti: Number(fidelitySogliaPunti),
          fidelity_valore_sconto: Number(fidelityValoreSconto),
        }),
      });

      const data = await res.json();
      if (data.error) {
        setSaveMessage(`Errore: ${data.error}`);
      } else {
        setSaveMessage('Impostazioni salvate con successo!');
      }
    } catch (err) {
      setSaveMessage('Errore di rete durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 pb-12">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-900 mb-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/orders"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{lido.nome_struttura} - Impostazioni Admin</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
              Gestione Menu, Spiaggia e Configurazione Commerciale
            </p>
          </div>
        </div>

        {/* Link rapidi alle altre sezioni admin */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/admin/menu"
            className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold px-4 py-2.5 rounded-xl text-slate-200 hover:text-white transition-colors"
          >
            Gestione Menu
          </Link>
          <Link
            href="/dashboard/admin/ombrelloni"
            className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold px-4 py-2.5 rounded-xl text-slate-200 hover:text-white transition-colors"
          >
            Generatore Spiaggia & QR
          </Link>
        </div>
      </header>

      {/* TAB NAVIGATION */}
      <div className="flex gap-2.5 pb-2 mb-8 border-b border-slate-900/60 max-w-7xl mx-auto overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Resoconto & Analisi
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <Settings className="w-4 h-4" />
          Impostazioni Lido
        </button>
        <button
          onClick={() => setActiveTab('fidelity')}
          className={`px-4.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'fidelity' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <Star className="w-4 h-4 text-indigo-400" />
          Fidelity & Clienti
        </button>
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'analytics' && (
        /* Tab 1: Statistiche & Analisi */
        <div className="space-y-8 max-w-7xl mx-auto">
          {/* METRICHE FINANZIARIE DEL LIDO */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Card 1: Fatturato Totale */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                €
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fatturato Totale</span>
                <span className="block text-xl font-black text-white mt-0.5">€{stats.totalSales.toFixed(2)}</span>
              </div>
            </div>

            {/* Card 2: Carte */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fatturato Carte</span>
                <span className="block text-xl font-black text-white mt-0.5">€{stats.cardSales.toFixed(2)}</span>
              </div>
            </div>

            {/* Card 3: Contanti */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fatturato Contanti</span>
                <span className="block text-xl font-black text-white mt-0.5">€{stats.cashSales.toFixed(2)}</span>
              </div>
            </div>

            {/* Card 4: Saldo platform */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comm. Contanti Dovute</span>
                <span className="block text-xl font-black text-red-400 mt-0.5">€{stats.totalCashDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonna Sinistra: Dettagli Transato e Prevenzione Evasione */}
            <div className="lg:col-span-2 space-y-8">
              {/* Ripartizione transato */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5 space-y-6">
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  Ripartizione Transato
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400 font-semibold uppercase">
                    <span>Stripe ({stats.totalSales > 0 ? ((stats.cardSales / stats.totalSales) * 100).toFixed(0) : '0'}%)</span>
                    <span>Contanti ({stats.totalSales > 0 ? ((stats.cashSales / stats.totalSales) * 100).toFixed(0) : '0'}%)</span>
                  </div>
                  <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                    <div className="bg-indigo-500" style={{ width: `${stats.totalSales > 0 ? (stats.cardSales / stats.totalSales) * 100 : 0}%` }}></div>
                    <div className="bg-emerald-500" style={{ width: `${stats.totalSales > 0 ? (stats.cashSales / stats.totalSales) * 100 : 0}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{stats.paidOrdersCount} Ordini pagati totali</span>
                    <span>Ticket Medio: €{stats.averageTicket.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Prodotti più venduti */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5">
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2 mb-4">
                  <ShoppingBag className="w-5 h-5 text-indigo-400" />
                  Prodotti più Venduti (Top Seller)
                </h3>
                <div className="space-y-3">
                  {stats.topSoldProducts.map((p, idx) => (
                    <div key={p.name} className="flex items-center justify-between bg-slate-950/40 border border-slate-900 px-4 py-3 rounded-xl hover:border-slate-800 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-slate-200 font-semibold">{p.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-extrabold">{p.quantity} unità vendute</span>
                    </div>
                  ))}
                  {stats.topSoldProducts.length === 0 && (
                    <div className="text-center py-6 text-slate-500 font-medium text-xs">
                      Nessun prodotto venduto ancora
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Colonna Destra: Prevenzione Evasione e WaveCard info */}
            <div className="space-y-8">
              {/* Anti-Frode Contanti */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5 space-y-4">
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  Prevenzione Evasione Contanti
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Tasso di cancellazione contanti:</span>
                    <span className={`font-bold text-sm ${stats.cashCancelRate > 10 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                      {stats.cashCancelRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div className={stats.cashCancelRate > 10 ? 'bg-red-500' : 'bg-emerald-500'} style={{ width: `${Math.min(100, stats.cashCancelRate)}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Se il tasso di cancellazione degli ordini in contanti supera il 10% (con almeno 10 ordini totali), l'opzione di pagamento in contanti per gli ombrelloni viene disattivata automaticamente dal sistema anti-evasione.
                  </p>
                </div>
              </div>

              {/* Punti Fidelity Totali */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5 space-y-4">
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-indigo-400" />
                  WaveCard Accumulo
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Punti distribuiti totali:</span>
                    <span className="text-2xl font-black text-indigo-400">{stats.totalFidelityPoints}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Clienti fidelizzati:</span>
                    <span className="text-lg font-black text-slate-300">{clientiFidelity.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        /* Tab 2: Configurazione Stabilimento e Stripe */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Form Impostazioni */}
          <div className="lg:col-span-2 bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5">
            <h2 className="font-extrabold text-lg text-slate-100 pb-4 border-b border-slate-900 mb-6">Impostazioni Stabilimento</h2>
            
            {saveMessage && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold mb-6 border ${
                saveMessage.includes('Errore')
                  ? 'bg-red-500/20 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}>
                {saveMessage}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nome Stabilimento *</label>
                <input
                  type="text"
                  required
                  value={nomeStruttura}
                  onChange={(e) => setNomeStruttura(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Logo Stabilimento (Upload)</label>
                <div className="flex gap-4 items-center bg-slate-950 border border-slate-800 rounded-xl p-4.5">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo Preview" className="w-16 h-16 rounded-xl object-cover bg-slate-900 border border-slate-800" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 border-dashed flex items-center justify-center text-slate-500 font-bold text-xs">NO LOGO</div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                      id="logo-upload-input"
                    />
                    <label
                      htmlFor="logo-upload-input"
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold px-4 py-3 rounded-xl text-slate-200 cursor-pointer transition-colors"
                    >
                      {isUploadingLogo ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <Upload className="w-4.5 h-4.5 text-indigo-400" />
                      )}
                      Sfoglia Immagine
                    </label>
                    <p className="text-[10px] text-slate-500 mt-1.5">JPG, PNG o WEBP. Dimensione max 2MB.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Colore Primario di Brand</label>
                <div className="flex gap-4 items-center">
                  <input
                    type="color"
                    value={colorePrimario}
                    onChange={(e) => setColorePrimario(e.target.value)}
                    className="w-12 h-12 bg-transparent border-0 rounded-xl cursor-pointer"
                  />
                  <span className="text-sm font-mono uppercase tracking-wider">{colorePrimario}</span>
                </div>
              </div>

              {/* SELEZIONE CONTANTI */}
              <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm">Accetta pagamenti in contanti</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Permette ai clienti di pagare l'ordinazione al cameriere</p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!lido.accetta_contanti && stats.cashCancelRate > 10 && stats.cashOrdersCount >= 10}
                    checked={accettaContanti}
                    onChange={(e) => setAccettaContanti(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer disabled:opacity-50"
                  />
                </div>

                {!lido.accetta_contanti && stats.cashCancelRate > 10 && stats.cashOrdersCount >= 10 && (
                  <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs p-3.5 rounded-xl flex gap-2.5 leading-relaxed">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <p>
                      <strong>Opzione Contanti Sospesa:</strong> Sospesa dal sistema anti-evasione (cancellazioni contanti &gt; 10%). Contatta l'assistenza.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-650/80 text-white font-bold px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors duration-200"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Salvataggio..." : "Salva Impostazioni"}
              </button>
            </form>
          </div>

          {/* Stripe Connect card */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5 h-fit space-y-6">
            <h2 className="font-extrabold text-lg text-slate-100 pb-4 border-b border-slate-900">Stripe Connect</h2>
            
            {lido.stripe_account_id ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex gap-2.5 items-start">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold">Account Connesso</h4>
                    <p className="text-slate-300 mt-1 leading-relaxed">Connesso con ID: <strong>{lido.stripe_account_id}</strong></p>
                  </div>
                </div>
                
                <div className="text-xs text-slate-400 leading-relaxed">
                  I pagamenti digitali dei clienti dall'ombrellone fluiscono direttamente sul tuo conto Stripe. L'application fee contrattuale viene trattenuta ed accreditata alla piattaforma automaticamente.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-2xl flex gap-2.5 items-start">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold">Stripe Non Configurato</h4>
                    <p className="text-slate-300 mt-1 leading-relaxed">Completa l'onboarding di Stripe per abilitare i pagamenti digitali.</p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/stripe/onboarding', { method: 'POST' });
                      const data = await res.json();
                      if (data.url) {
                        window.location.href = data.url;
                      } else {
                        alert(data.error || 'Errore creazione onboarding');
                      }
                    } catch {
                      alert('Errore di rete. Riprova.');
                    }
                  }}
                  className="w-full py-4 text-center bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Connetti Stripe Connect
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Fidelity & Clienti */}
      {activeTab === 'fidelity' && (
        <div className="max-w-7xl mx-auto space-y-8">
          {/* CONFIGURAZIONE RACCOLTA PUNTI (FIDELITY CARD) */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5">
            <h2 className="font-extrabold text-lg text-slate-100 pb-4 border-b border-slate-900 mb-6">Configurazione Raccolta Punti Fedeltà</h2>
            
            {saveMessage && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold mb-6 border ${
                saveMessage.includes('Errore')
                  ? 'bg-red-500/20 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}>
                {saveMessage}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-900/60">
                <div>
                  <h4 className="font-bold text-sm">Abilita Raccolta Punti Fedeltà</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Attiva la WaveCard digitale per i tuoi clienti</p>
                </div>
                <input
                  type="checkbox"
                  checked={fidelityAttivo}
                  onChange={(e) => setFidelityAttivo(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer"
                />
              </div>

              {fidelityAttivo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Soglia Punti per Premio</label>
                    <input
                      type="number"
                      required
                      min="10"
                      value={fidelitySogliaPunti}
                      onChange={(e) => setFidelitySogliaPunti(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Es. 100"
                    />
                    <p className="text-[10px] text-slate-500">I punti necessari per sbloccare lo sconto (es. 100 punti).</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Valore Sconto (€)</label>
                    <input
                      type="number"
                      required
                      min="0.50"
                      step="0.50"
                      value={fidelityValoreSconto}
                      onChange={(e) => setFidelityValoreSconto(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Es. 5.00"
                    />
                    <p className="text-[10px] text-slate-500">Il valore monetario dello sconto applicato alla soglia (es. 5€).</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-650/80 text-white font-bold px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors duration-200"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Salvataggio..." : "Salva Configurazione Fidelity"}
              </button>
            </form>
          </div>

          {/* LISTA UTENTI FIDELIZZATI */}
          {fidelityAttivo && (
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-lg text-slate-100">Clienti WaveCard Registrati</h2>
                    <p className="text-xs text-slate-500">{clientiFidelity.length} clienti registrati</p>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cerca per nome o telefono..."
                    value={clientiSearch}
                    onChange={(e) => setClientiSearch(e.target.value)}
                    className="w-full md:w-72 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              {clientiFidelity.length === 0 ? (
                <div className="py-12 text-center">
                  <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">Nessun cliente registrato alla WaveCard</p>
                  <p className="text-xs text-slate-600 mt-1">I clienti si registreranno tramite la PWA del menu</p>
                </div>
              ) : (
                <div className="mt-5 space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {clientiFidelity
                    .filter((c) => {
                      if (!clientiSearch.trim()) return true;
                      const search = clientiSearch.toLowerCase();
                      return (
                        c.nome.toLowerCase().includes(search) ||
                        c.cognome.toLowerCase().includes(search) ||
                        c.telefono.includes(search)
                      );
                    })
                    .map((cliente) => (
                      <div key={cliente.id} className="flex items-center justify-between bg-slate-950/50 border border-slate-900 rounded-2xl px-5 py-4 hover:border-slate-800 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                            {cliente.nome.charAt(0)}{cliente.cognome.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-200">{cliente.nome} {cliente.cognome}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{cliente.telefono}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-xl font-black text-indigo-400">{cliente.punti_totali}</span>
                            <span className="text-[10px] text-slate-500 font-bold">PTS</span>
                          </div>
                          {cliente.punti_totali >= fidelitySogliaPunti && (
                            <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full mt-1">
                              Premio pronto!
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


