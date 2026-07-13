'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  QrCode, 
  Smartphone, 
  CreditCard, 
  DollarSign, 
  ShieldAlert, 
  TrendingUp, 
  Zap, 
  Check, 
  ChevronRight, 
  ArrowRight,
  ShieldCheck,
  Star,
  Users,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

// Helper per ottenere un piano dal nome o usare un default
const getPlanByPrefix = (plans: any[], prefix: string, defaultPlan: any) => {
  const found = plans.find(p => p.name.startsWith(prefix));
  return found || defaultPlan;
};

export default function LandingPage() {
  const [transitoMensile, setTransitoMensile] = useState<number>(30000);
  const [nomeContatto, setNomeContatto] = useState('');
  const [lidoContatto, setLidoContatto] = useState('');
  const [emailContatto, setEmailContatto] = useState('');
  const [telefonoContatto, setTelefonoContatto] = useState('');
  const [formInviato, setFormInviato] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Piani dinamici dal DB
  const [dbPlans, setDbPlans] = useState<any[]>([]);

  React.useEffect(() => {
    async function loadPlans() {
      const supabase = createClient();
      const { data } = await supabase.from('pricing_plans').select('*').eq('is_active', true);
      if (data) {
        setDbPlans(data);
      }
    }
    loadPlans();
  }, []);

  // Calcolo dei piani dinamico
  const calcoloPiani = () => {
    // Valori di default
    const planA = getPlanByPrefix(dbPlans, 'Opzione A', { commission_percent: 5, fixed_monthly_fee: 0, fixed_seasonal_fee: 0 });
    const planB = getPlanByPrefix(dbPlans, 'Opzione B', { commission_percent: 2, fixed_monthly_fee: 149, fixed_seasonal_fee: 0 });
    const planC = getPlanByPrefix(dbPlans, 'Opzione C', { commission_percent: 0, fixed_monthly_fee: 0, fixed_seasonal_fee: 900 });

    // 1. Commissione
    const costoPiena = (transitoMensile * (planA.commission_percent / 100)) + Number(planA.fixed_monthly_fee);
    
    // 2. Ibrido
    const costoIbrido = Number(planB.fixed_monthly_fee) + (transitoMensile * (planB.commission_percent / 100));

    // 3. Stagionale Flat (calcolata su 5 mesi stagionali, se la fee mensile è zero)
    const costoFlat = planC.fixed_monthly_fee > 0 ? Number(planC.fixed_monthly_fee) : (Number(planC.fixed_seasonal_fee) / 5);

    const minCosto = Math.min(costoPiena, costoIbrido, costoFlat);
    let planScelto = 'A';
    if (minCosto === costoPiena) planScelto = 'A';
    else if (minCosto === costoFlat) planScelto = 'C';
    else planScelto = 'B';

    return { 
      costoPiena, costoIbrido, costoFlat, planScelto,
      planA, planB, planC
    };
  };

  const { costoPiena, costoIbrido, costoFlat, planScelto, planA, planB, planC } = calcoloPiani();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeContatto.trim() || !lidoContatto.trim()) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/candidature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_contatto: nomeContatto,
          email_contatto: emailContatto,
          telefono_contatto: telefonoContatto,
          nome_lido: lidoContatto,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setFormError(data.error);
      } else {
        setFormInviato(true);
      }
    } catch {
      setFormError('Errore di rete. Riprova.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-900/60 px-6 py-4 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
            Wave<span className="text-indigo-400">Order</span>
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Caratteristiche</a>
          <a href="#simulator" className="hover:text-white transition-colors">Simulatore Tariffe</a>
          <a href="#pricing" className="hover:text-white transition-colors">Piani</a>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="/login" 
            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors px-3 py-2"
          >
            Accedi
          </Link>
          <a 
            href="#contact" 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Provalo Gratis
          </a>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden px-6 pt-16 pb-24 md:pt-28 md:pb-36 max-w-7xl mx-auto text-center md:text-left flex flex-col md:flex-row items-center gap-16">
        {/* Glow Backgrounds */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none"></div>
        <div className="absolute top-1/3 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-sky-500/10 blur-[100px] pointer-events-none"></div>

        <div className="flex-1 space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LA RIVOLUZIONE BALNEARE 2026</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.08] text-white">
            Aumenta gli ordini del <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-sky-400">25% sotto l'ombrellone.</span>
          </h2>

          <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-xl">
            Offri ai tuoi clienti un servizio Premium. Menu digitale tramite QR Code, ordini diretti dal lettino, pagamenti immediati sul tuo conto e fine delle lunghe code al bar. Aumenta lo scontrino medio e migliora l'efficienza del tuo lido.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <a 
              href="#contact" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>Attiva WaveOrder per il tuo Lido</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a 
              href="#simulator" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 font-semibold px-8 py-4 rounded-2xl transition-colors duration-200"
            >
              Simula Ricavi
            </a>

          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 pt-6 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
              <span>Zero Costi Nascosti</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4.5 h-4.5 text-sky-400" />
              <span>Setup in 24 Ore</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-indigo-400" />
              <span>+ Ricavi, - Attese</span>
            </div>
          </div>
        </div>

        {/* SCREENSHOT MOCKUP */}
        <div className="flex-1 w-full max-w-md relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-sky-500/20 rounded-[3rem] blur-2xl transform rotate-3"></div>
          <div className="relative bg-slate-900 border border-slate-800 rounded-[2.5rem] p-4.5 shadow-2xl overflow-hidden aspect-[9/16] flex flex-col">
            {/* Mock phone status bar */}
            <div className="flex justify-between items-center px-4.5 pb-3 pt-1 text-[11px] text-slate-500 font-bold border-b border-slate-900">
              <span>WaveOrder Mobile</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Lido Sole</span>
              </div>
            </div>

            {/* Menu preview */}
            <div className="flex-1 flex flex-col justify-between py-6 px-3">
              <div>
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center font-black text-xl mb-4 text-white">L</div>
                <h4 className="font-extrabold text-lg text-slate-200">Lido del Sole</h4>
                <p className="text-xs text-slate-500 mt-0.5">Ordinando all'Ombrellone: <strong>A14</strong></p>
                
                {/* Product preview cards */}
                <div className="space-y-3 mt-6">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-400">Spritz</div>
                    <div>
                      <h5 className="font-bold text-xs">Aperol Spritz</h5>
                      <span className="text-[10px] text-indigo-400 font-bold">€7.00</span>
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-xs text-sky-400">Pizza</div>
                    <div>
                      <h5 className="font-bold text-xs">Margherita</h5>
                      <span className="text-[10px] text-sky-400 font-bold">€9.50</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="bg-indigo-600 rounded-2xl p-4 flex justify-between items-center text-white text-xs font-black shadow-lg">
                <span className="uppercase tracking-wider opacity-90">Invia Ordine</span>
                <span>€16.50</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section id="features" className="bg-slate-900/30 border-y border-slate-900 px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <h3 className="text-xs font-black tracking-widest text-indigo-400 uppercase">I Vantaggi per il tuo Lido</h3>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Niente code, più ordini, zero stress.</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Abbiamo studiato WaveOrder per semplificare il lavoro del tuo staff e massimizzare gli incassi durante le ore di punta, offrendo un servizio impeccabile ai tuoi clienti.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feat 1 */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl space-y-4 transition-all duration-300 hover:border-slate-700/40">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-lg text-slate-100">Zero App da scaricare</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Il cliente inquadra semplicemente il QR Code dell'ombrellone. Il menu si apre istantaneamente sul browser dello smartphone senza passaggi noiosi.
              </p>
            </div>

            {/* Feat 2 */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl space-y-4 transition-all duration-300 hover:border-slate-700/40">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-lg text-slate-100">Pagamenti Diretti & Sicuri</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Gli incassi tramite carta di credito e Apple/Google Pay arrivano direttamente e in tempo reale sul conto corrente del tuo stabilimento, in totale sicurezza.
              </p>
            </div>

            {/* Feat 3 */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl space-y-4 transition-all duration-300 hover:border-slate-700/40">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-lg text-slate-100">Bar & Cucina Sincronizzati</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                KDS (Kitchen Display System) su tablet per gestire le comande senza carta e senza errori. Lo staff riceve gli ordini in modo ordinato per reparto.
              </p>
            </div>

            {/* Feat 4 */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl space-y-4 transition-all duration-300 hover:border-slate-700/40">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-lg text-slate-100">Gestione Contanti Sicura</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Puoi decidere tu se accettare anche pagamenti in contanti sotto l'ombrellone o solo carte, con un sistema di avvisi automatici che tutela il tuo lavoro.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SIMULATORE TARIFFE */}
      <section id="simulator" className="px-6 py-24 max-w-7xl mx-auto">
        <div className="bg-slate-900 border border-slate-850 rounded-[2.5rem] p-8 md:p-12 flex flex-col lg:flex-row gap-12 items-center">
          <div className="flex-1 space-y-6">
            <h3 className="text-xs font-black tracking-widest text-indigo-400 uppercase">Calcola il tuo ROI</h3>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Scopri l'impatto sul tuo lido</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Muovi il cursore per simulare l'incasso mensile extra stimato generato dagli ordini all'ombrellone, e scopri qual è il piano tariffario più conveniente per te.
            </p>
            
            {/* SLIDER */}
            <div className="space-y-4 pt-4">
              <div className="flex justify-between font-black">
                <span className="text-slate-400">Transato mensile stimato del lido:</span>
                <span className="text-2xl text-indigo-400">€{transitoMensile.toLocaleString('it-IT')}</span>
              </div>
              <input 
                type="range" 
                min="5000" 
                max="150000" 
                step="5000"
                value={transitoMensile} 
                onChange={(e) => setTransitoMensile(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
              />
              <div className="flex justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>5.000€</span>
                <span>75.000€</span>
                <span>150.000€</span>
              </div>
            </div>
          </div>

          {/* SIMULATOR CARDS */}
          <div className="flex-1 w-full space-y-4 mt-6 lg:mt-0">
            {/* Plan A card */}
            <div className={`relative bg-slate-950/80 p-5.5 rounded-2xl flex justify-between items-center transition-all duration-300 ${planScelto === 'A' ? 'border-2 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border border-slate-800 hover:border-indigo-500/40'}`}>
              {planScelto === 'A' && (
                <div className="absolute -top-3 left-6 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">Più Conveniente</div>
              )}
              <div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{planA.name} {planA.commission_percent > 0 && `(Commissione ${planA.commission_percent}%)`}</span>
                <h4 className="font-extrabold text-lg text-slate-200 mt-1">{planA.description || 'Nessun costo fisso o canone'}</h4>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Costo servizio mensile:</span>
                <span className="font-black text-xl text-white">€{costoPiena.toLocaleString('it-IT', { maximumFractionDigits: 0 })}/mese</span>
              </div>
            </div>

            {/* Plan B card */}
            <div className={`relative bg-slate-950/80 p-5.5 rounded-2xl flex justify-between items-center transition-all duration-300 ${planScelto === 'B' ? 'border-2 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]' : 'border border-slate-800 hover:border-sky-500/40'}`}>
              {planScelto === 'B' && (
                <div className="absolute -top-3 left-6 bg-sky-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">Più Conveniente</div>
              )}
              <div>
                <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">{planB.name} {planB.fixed_monthly_fee > 0 && `(${planB.fixed_monthly_fee}€`} {planB.commission_percent > 0 && `+ ${planB.commission_percent}%)`}</span>
                <h4 className="font-extrabold text-lg text-slate-200 mt-1">{planB.description || 'Canone mensile + commissione ridotta'}</h4>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Costo fisso + comm:</span>
                <span className="font-black text-xl text-white">€{costoIbrido.toLocaleString('it-IT', { maximumFractionDigits: 0 })}/mese</span>
              </div>
            </div>

            {/* Plan C card */}
            <div className={`relative bg-slate-950/80 p-5.5 rounded-2xl flex justify-between items-center transition-all duration-300 ${planScelto === 'C' ? 'border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border border-slate-800 hover:border-emerald-500/40'}`}>
              {planScelto === 'C' && (
                <div className="absolute -top-3 left-6 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">Più Conveniente</div>
              )}
              <div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{planC.name}</span>
                <h4 className="font-extrabold text-lg text-slate-200 mt-1">{planC.description || 'Costo fisso flat'}</h4>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Costo fisso medio flat:</span>
                <span className="font-black text-xl text-white">€{costoFlat.toLocaleString('it-IT', { maximumFractionDigits: 0 })}/mese</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION FOR THE BEACH OWNERS */}
      <section id="pricing" className="bg-slate-900/30 border-y border-slate-900 px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <h3 className="text-xs font-black tracking-widest text-indigo-400 uppercase">Tariffe Trasparenti</h3>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Scegli il piano su misura per te.</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Sappiamo che ogni stabilimento ha esigenze diverse. Per questo offriamo tre opzioni chiare, senza costi nascosti e con la massima flessibilità.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Price 1 */}
            <div className="bg-slate-900 border border-slate-850 p-8 rounded-[2rem] flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <h4 className="font-black text-lg text-indigo-400">{planA.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{planA.description || 'Perfetto per iniziare senza canoni'}</p>
                </div>
                <div className="flex items-baseline text-white">
                  <span className="text-5xl font-black tracking-tight">{planA.commission_percent}%</span>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-2">sul transato</span>
                </div>
                <ul className="space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Ordini illimitati dall'ombrellone</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Stripe Connect integrato</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Commissioni incluse</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Pannello barista realtime</li>
                </ul>
              </div>
              <a href="#contact" className="w-full py-4 text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all duration-200 text-xs uppercase tracking-wider">Inizia Ora</a>
            </div>

            {/* Price 2 */}
            <div className="bg-gradient-to-b from-sky-900/20 to-slate-900 border-2 border-sky-500/50 p-8 rounded-[2rem] flex flex-col justify-between space-y-8 relative transform md:-translate-y-4 shadow-2xl shadow-sky-900/20">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                Il Più Scelto
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-black text-lg text-sky-400">{planB.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{planB.description || 'Il bilanciamento perfetto per lidi di medie dimensioni'}</p>
                </div>
                <div className="flex flex-col text-white">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-black tracking-tight">€{planB.fixed_monthly_fee}</span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-2">/mese</span>
                  </div>
                  <div className="flex items-center mt-2 text-sky-400 font-bold">
                    <Plus className="w-4 h-4 mr-1" /> {planB.commission_percent}% commissione transato
                  </div>
                </div>
                <ul className="space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Tutti i vantaggi di {planA.name}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Dashboard Analytics base</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Risparmio su alti volumi</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Supporto Prioritario</li>
                </ul>
              </div>
              <a href="#contact" className="block text-center w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-500/25 transition-colors">Contattaci</a>
            </div>

            {/* Price 3 */}
            <div className="bg-slate-900 border border-slate-850 p-8 rounded-[2rem] flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <h4 className="font-black text-lg text-emerald-400">{planC.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{planC.description || 'Massimo guadagno, zero commissioni sulle vendite'}</p>
                </div>
                <div className="flex flex-col text-white">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-black tracking-tight">€{planC.fixed_seasonal_fee}</span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-2">/stagione</span>
                  </div>
                  <div className="flex items-center mt-2 text-emerald-400 font-bold">
                    0% commissione transato
                  </div>
                </div>
                <ul className="space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 0% di commissioni trattenute</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Pagamento unico per tutta la stagione</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Assistenza telefonica inclusa</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Configurazione menu a cura dello staff</li>
                </ul>
              </div>
              <a href="#contact" className="w-full py-4 text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all duration-200 text-xs uppercase tracking-wider">Scegli Flat</a>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT FORM */}
      <section id="contact" className="px-6 py-24 max-w-md mx-auto">
        <div className="bg-slate-900 border border-slate-850 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h3 className="font-extrabold text-xl text-slate-100">Richiedi una Demo</h3>
            <p className="text-xs text-slate-400">Lascia i tuoi dati: un nostro esperto ti mostrerà come aumentare i ricavi.</p>
          </div>

          {formInviato ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex flex-col items-center gap-2.5 text-center py-8">
              <Check className="w-8 h-8 animate-bounce" />
              <div>
                <h4 className="font-bold text-sm">Richiesta Ricevuta!</h4>
                <p className="text-xs text-slate-400 mt-1">Un esperto WaveOrder ti contatterà al più presto per la tua demo gratuita.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Il Tuo Nome *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Es. Mario Rossi"
                  value={nomeContatto}
                  onChange={(e) => setNomeContatto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nome del Lido *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Es. Lido Sirena"
                  value={lidoContatto}
                  onChange={(e) => setLidoContatto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Email</label>
                <input 
                  type="email" 
                  placeholder="mario@email.com"
                  value={emailContatto}
                  onChange={(e) => setEmailContatto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Telefono</label>
                <input 
                  type="tel" 
                  placeholder="Es. 333 1234567"
                  value={telefonoContatto}
                  onChange={(e) => setTelefonoContatto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
                  {formError}
                </div>
              )}

              <button 
                type="submit"
                disabled={formLoading}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  'Invia Candidatura'
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-12 px-6 flex flex-col items-center gap-4 text-center text-xs text-slate-500">
        <a href="/waveorder-app.apk" download className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4">Scarica App Staff (APK Android)</a>
        <p>© 2026 WaveOrder. Tutti i diritti riservati. P.IVA 01234567890</p>
      </footer>
    </div>
  );
}
