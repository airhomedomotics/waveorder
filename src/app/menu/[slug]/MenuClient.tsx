'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Plus, Minus, X, CreditCard, DollarSign, Check, HelpCircle, GlassWater, Coffee, UtensilsCrossed } from 'lucide-react';

interface Lido {
  id: string;
  nome_struttura: string;
  slug: string;
  logo_url: string | null;
  colore_primario: string;
  accetta_contanti: boolean;
  pagamenti_digitali_attivi: boolean;
  fidelity_attivo: boolean;
  fidelity_soglia_punti: number;
  fidelity_valore_sconto: number | string;
}

interface Ombrellone {
  id: string;
  codice_identificativo: string;
  qr_token: string;
}

interface Categoria {
  id: string;
  nome: string;
}

interface Prodotto {
  id: string;
  categoria_id: string;
  nome: string;
  descrizione: string | null;
  prezzo: number | string;
  immagine_url: string | null;
}

interface CartItem {
  prodotto: Prodotto;
  quantita: number;
  note: string;
}

interface MenuClientProps {
  lido: Lido;
  initialOmbrellone: Ombrellone | null;
  categories: Categoria[];
  products: Prodotto[];
}

export default function MenuClient({ lido, initialOmbrellone, categories, products }: MenuClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || '');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [ombrelloneManuale, setOmbrelloneManuale] = useState(initialOmbrellone?.codice_identificativo || '');
  const [paymentMethod, setPaymentMethod] = useState<'carta_stripe' | 'contanti'>(
    lido.pagamenti_digitali_attivi ? 'carta_stripe' : 'contanti'
  );
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Programma Fedeltà (WaveCard)
  const [fidelityPoints, setFidelityPoints] = useState<number>(0);
  const [useFidelityDiscount, setUseFidelityDiscount] = useState(false);

  const getPlaceholderIcon = (categoryName?: string) => {
    const name = (categoryName || '').toLowerCase();
    if (name.includes('drink') || name.includes('bevande') || name.includes('cocktail') || name.includes('birre') || name.includes('vino') || name.includes('liquori')) {
      return <GlassWater className="w-8 h-8 text-indigo-400/60" />;
    }
    if (name.includes('caffè') || name.includes('colazione') || name.includes('coffee') || name.includes('bar')) {
      return <Coffee className="w-8 h-8 text-indigo-400/60" />;
    }
    return <UtensilsCrossed className="w-8 h-8 text-indigo-400/60" />;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPoints = localStorage.getItem(`waveorder_points_${lido.slug}`);
      if (savedPoints) {
        setFidelityPoints(parseInt(savedPoints, 10));
      }
    }
  }, [lido.slug]);

  // Filtra prodotti per categoria selezionata
  const filteredProducts = useMemo(() => {
    return products.filter((p) => p.categoria_id === selectedCategory);
  }, [products, selectedCategory]);

  // Calcola totali
  const { cartCount, cartTotal } = useMemo(() => {
    const count = cart.reduce((sum, item) => sum + item.quantita, 0);
    const total = cart.reduce((sum, item) => sum + Number(item.prodotto.prezzo) * item.quantita, 0);
    return { cartCount: count, cartTotal: total };
  }, [cart]);

  const discountAmount = useMemo(() => {
    const threshold = lido.fidelity_soglia_punti || 100;
    const value = Number(lido.fidelity_valore_sconto) || 5.00;
    if (useFidelityDiscount && fidelityPoints >= threshold) {
      return value;
    }
    return 0;
  }, [useFidelityDiscount, fidelityPoints, lido.fidelity_soglia_punti, lido.fidelity_valore_sconto]);

  const finalTotal = useMemo(() => {
    return Math.max(0, cartTotal - discountAmount);
  }, [cartTotal, discountAmount]);

  const addToCart = (product: Prodotto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.prodotto.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.prodotto.id === product.id ? { ...item, quantita: item.quantita + 1 } : item
        );
      }
      return [...prev, { prodotto: product, quantita: 1, note: '' }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.prodotto.id === productId) {
            const newQty = item.quantita + delta;
            return newQty > 0 ? { ...item, quantita: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const getProductCartQty = (productId: string) => {
    const item = cart.find((i) => i.prodotto.id === productId);
    return item ? item.quantita : 0;
  };

  const handleCheckout = async () => {
    if (!ombrelloneManuale.trim()) {
      setErrorMsg("Per favore inserisci il numero dell'ombrellone o tavolo.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const threshold = lido.fidelity_soglia_punti || 100;
    const payload = {
      lido_id: lido.id,
      ombrellone_id: initialOmbrellone?.id || null,
      numero_ombrellone_manuale: ombrelloneManuale,
      items: cart.map((item) => ({
        prodotto_id: item.prodotto.id,
        quantita: item.quantita,
        note: item.note,
      })),
      fidelity_discount: useFidelityDiscount && fidelityPoints >= threshold,
    };

    try {
      if (paymentMethod === 'carta_stripe') {
        // Checkout Digitale (Stripe Connect Split Payment)
        const res = await fetch('/api/payments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.error) {
          setErrorMsg(data.error);
        } else if (data.url) {
          // Reindirizza al checkout Stripe ospitato
          window.location.href = data.url;
        }
      } else {
        // Checkout Contanti (Cash flow)
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.error) {
          setErrorMsg(data.error);
        } else if (data.ordine) {
          // Detrai i punti immediatamente se l'ordine in contanti ha avuto successo
          if (useFidelityDiscount && fidelityPoints >= threshold) {
            const newPoints = Math.max(0, fidelityPoints - threshold);
            setFidelityPoints(newPoints);
            localStorage.setItem(`waveorder_points_${lido.slug}`, String(newPoints));
          }
          // Reindirizza alla pagina di successo contanti
          window.location.href = `/menu/${lido.slug}/success?order_id=${data.ordine.id}`;
        }
      }
    } catch (err: any) {
      setErrorMsg("Si è verificato un errore di rete. Riprova più tardi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500 pb-28" style={{
      ['--lido-primary' as any]: lido.colore_primario,
      ['--lido-primary-rgb' as any]: '0, 112, 243' // default fallback
    }}>
      {/* HEADER */}
      <header className="sticky top-0 z-30 backdrop-blur-lg bg-slate-900/80 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {lido.logo_url ? (
            <img src={lido.logo_url} alt={lido.nome_struttura} className="w-10 h-10 rounded-full object-cover border border-slate-700" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg text-white border border-slate-700" style={{ backgroundColor: 'var(--lido-primary)' }}>
              {lido.nome_struttura.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg leading-tight">{lido.nome_struttura}</h1>
            <p className="text-xs text-slate-400">Ordinazioni all'Ombrellone</p>
          </div>
        </div>
        <div className="bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold tracking-wide">
            {initialOmbrellone ? `Ombrellone: ${initialOmbrellone.codice_identificativo}` : 'Self-Ordering'}
          </span>
        </div>
      </header>

      {/* WIDGET RACCOLTA PUNTI FIDELITÀ (WAVECARD) */}
      {lido.fidelity_attivo && (
        <div className="mx-4 md:mx-6 mt-4 p-4.5 bg-gradient-to-br from-indigo-950/35 to-slate-900/60 border border-indigo-500/25 rounded-3xl flex items-center justify-between gap-4">
          <div>
            <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">La tua WaveCard</span>
            <span className="block text-sm font-black text-slate-100">Fidelity Card Digitale</span>
            <span className="block text-[10px] text-slate-400 mt-1">Acquista drink o cibo e accumula punti! (€1 = 1 Punto)</span>
          </div>
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-3xl font-black text-indigo-400">{fidelityPoints}</span>
              <span className="text-xs text-slate-500 font-bold">PTS</span>
            </div>
            {(() => {
              const threshold = lido.fidelity_soglia_punti || 100;
              const value = Number(lido.fidelity_valore_sconto || 5);
              if (fidelityPoints >= threshold) {
                return (
                  <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full mt-1.5 animate-pulse">
                    Sconto {value.toFixed(0)}€ Pronto!
                  </span>
                );
              }
              return (
                <p className="text-[9px] text-slate-500 mt-1">Mancano {threshold - fidelityPoints} pt allo sconto</p>
              );
            })()}
          </div>
        </div>
      )}

      {/* BANNER SE OMBRELLONE NON PRECOMPILATO */}
      {!initialOmbrellone && (
        <div className="mx-6 mt-4 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <p className="text-sm font-medium text-indigo-200">Qual è il tuo ombrellone?</p>
          </div>
          <input
            type="text"
            placeholder="Es. Fila 2 - Ombrellone 15"
            value={ombrelloneManuale}
            onChange={(e) => setOmbrelloneManuale(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      )}

      {/* CATEGORIE STICKY (SCROLL ORIZZONTALE) */}
      <div className="sticky top-[72px] z-20 backdrop-blur-xl bg-slate-900/90 border-b border-slate-800/40 px-4 md:px-6 py-3.5 overflow-x-auto scrollbar-none flex gap-2.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              selectedCategory === cat.id
                ? 'text-white border-none shadow-lg shadow-indigo-900/40'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:bg-slate-700/60'
            }`}
            style={selectedCategory === cat.id ? { backgroundColor: 'var(--lido-primary)' } : {}}
          >
            {cat.nome}
          </button>
        ))}
      </div>

      {/* PRODOTTI LIST */}
      <main className="px-4 md:px-6 grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm">
            Nessun prodotto disponibile in questa categoria.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const qty = getProductCartQty(product.id);
            return (
              <div key={product.id} className="bg-slate-800/25 backdrop-blur-md border border-slate-800/60 rounded-3xl p-4 flex gap-4 transition-all duration-300 hover:border-slate-700/40">
                {product.immagine_url ? (
                  <img src={product.immagine_url} alt={product.nome} className="w-20 h-20 rounded-2xl object-cover border border-slate-700/60 flex-shrink-0 bg-slate-900" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                    {getPlaceholderIcon(categories.find((c) => c.id === product.categoria_id)?.nome)}
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-100 leading-snug truncate">{product.nome}</h3>
                    {product.descrizione && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{product.descrizione}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-black text-sm text-indigo-400">
                      €{Number(product.prezzo).toFixed(2)}
                    </span>
                    
                    {qty === 0 ? (
                      <button
                        onClick={() => addToCart(product)}
                        className="flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl text-slate-200 hover:text-white transition-all active:scale-95"
                      >
                        <Plus className="w-3 h-3 text-indigo-400" />
                        <span>Aggiungi</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-750 rounded-xl px-2 py-1">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="p-1 hover:bg-slate-750 rounded text-slate-400 hover:text-white transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-black text-xs min-w-4 text-center">{qty}</span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="p-1 hover:bg-slate-750 rounded text-slate-400 hover:text-white transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* FLOATING ACTION CART BUTTON */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-6 right-6 z-40 max-w-lg mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between px-6 py-4.5 rounded-2xl shadow-xl shadow-slate-950/80 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-white"
            style={{ backgroundColor: 'var(--lido-primary)' }}
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <span className="block text-xs uppercase tracking-wider font-semibold opacity-75">{cartCount} Articoli</span>
                <span className="block font-extrabold text-base">Vedi Carrello</span>
              </div>
            </div>
            <span className="font-black text-lg">€{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* CHECKOUT MODAL / DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-[2.5rem] p-6 max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div>
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                <div>
                  <h2 className="font-extrabold text-xl">Il mio Ordine</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Rivedi ed effettua il pagamento</p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ERRORE BANNER */}
              {errorMsg && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold leading-relaxed">
                  {errorMsg}
                </div>
              )}

              {/* LOCK INDICATOR SE CON TOKEN CODICE OMBRELLONE (ANTI-FRODE) */}
              {initialOmbrellone ? (
                <div className="mt-5 p-4 bg-emerald-950/20 border border-emerald-500/25 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Punto Consegna Bloccato (QR)</span>
                    <span className="block text-sm font-black text-white">{initialOmbrellone.codice_identificativo}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Numero Ombrellone / Tavolo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Fila 1 - Ombrellone 4"
                    value={ombrelloneManuale}
                    onChange={(e) => setOmbrelloneManuale(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              )}

              {/* LISTA ELEMENTI CARRELLO */}
              <div className="mt-5 space-y-4 max-h-[25vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.prodotto.id} className="flex items-center justify-between bg-slate-800/20 border border-slate-800/50 p-3 rounded-2xl">
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-200">{item.prodotto.nome}</h4>
                      <span className="text-xs font-extrabold text-indigo-400 block mt-0.5">€{Number(item.prodotto.prezzo).toFixed(2)}</span>
                      {/* Nota personalizzazione */}
                      <input
                        type="text"
                        placeholder="Aggiungi una nota (es. senza ghiaccio)..."
                        value={item.note}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCart((prev) => prev.map((c) => c.prodotto.id === item.prodotto.id ? { ...c, note: val } : c));
                        }}
                        className="w-full bg-transparent border-b border-slate-800 text-xs text-slate-400 py-1 mt-1 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-2.5 ml-4">
                      <button
                        onClick={() => updateQuantity(item.prodotto.id, -1)}
                        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-sm w-4 text-center">{item.quantita}</span>
                      <button
                        onClick={() => updateQuantity(item.prodotto.id, 1)}
                        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ACCUMULO / RISCATTO PUNTI IN CHECKOUT */}
              {lido.fidelity_attivo && fidelityPoints >= (lido.fidelity_soglia_punti || 100) && (
                <div className="mt-5 p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <h4 className="font-extrabold text-sm text-indigo-400">Riscatta Premio Fedeltà</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Usa {lido.fidelity_soglia_punti || 100} punti per ottenere {Number(lido.fidelity_valore_sconto || 5).toFixed(2)}€ di Sconto immediato!</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={useFidelityDiscount}
                    onChange={(e) => setUseFidelityDiscount(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer"
                  />
                </div>
              )}

              {/* METODI DI PAGAMENTO */}
              <div className="mt-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Metodo di Pagamento</label>
                <div className="grid grid-cols-2 gap-3">
                  {lido.pagamenti_digitali_attivi && (
                    <button
                      onClick={() => setPaymentMethod('carta_stripe')}
                      className={`flex flex-col items-center justify-center p-4.5 rounded-2xl border text-center transition-all duration-200 ${
                        paymentMethod === 'carta_stripe'
                          ? 'border-indigo-500 bg-indigo-950/20 text-white'
                          : 'border-slate-800 bg-slate-800/20 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <CreditCard className={`w-6 h-6 mb-2 ${paymentMethod === 'carta_stripe' ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span className="font-bold text-xs">Carta / Apple Pay</span>
                    </button>
                  )}
                  {lido.accetta_contanti && (
                    <button
                      onClick={() => setPaymentMethod('contanti')}
                      className={`flex flex-col items-center justify-center p-4.5 rounded-2xl border text-center transition-all duration-200 ${
                        paymentMethod === 'contanti'
                          ? 'border-emerald-500 bg-emerald-950/20 text-white'
                          : 'border-slate-800 bg-slate-800/20 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <DollarSign className={`w-6 h-6 mb-2 ${paymentMethod === 'contanti' ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span className="font-bold text-xs">Contanti al cameriere</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* PULSANTE PROCEDI */}
            <div className="mt-8 pt-4 border-t border-slate-800">
              {discountAmount > 0 && (
                <div className="space-y-1.5 mb-3.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotale carrello:</span>
                    <span>€{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Sconto Fedeltà (Riscatto {lido.fidelity_soglia_punti || 100} pt):</span>
                    <span>-€{discountAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-slate-400">Totale Ordine</span>
                <span className="font-extrabold text-2xl">€{finalTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all duration-300 disabled:opacity-50 text-white shadow-lg"
                style={{
                  backgroundColor: paymentMethod === 'contanti' ? '#10b981' : 'var(--lido-primary)',
                  boxShadow: paymentMethod === 'contanti' 
                    ? '0 10px 15px -3px rgba(16, 185, 129, 0.4)' 
                    : '0 10px 15px -3px rgba(0, 112, 243, 0.4)'
                }}
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Invia Ordine (€{finalTotal.toFixed(2)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
