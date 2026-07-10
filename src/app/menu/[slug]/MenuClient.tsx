'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingBag, Plus, Minus, X, CreditCard, DollarSign, Check, HelpCircle } from 'lucide-react';

interface Lido {
  id: string;
  nome_struttura: string;
  slug: string;
  logo_url: string | null;
  colore_primario: string;
  accetta_contanti: boolean;
  pagamenti_digitali_attivi: boolean;
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

  const handleCheckout = async () => {
    if (!ombrelloneManuale.trim()) {
      setErrorMsg("Per favore inserisci il numero dell'ombrellone o tavolo.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload = {
      lido_id: lido.id,
      ombrellone_id: initialOmbrellone?.id || null,
      numero_ombrellone_manuale: ombrelloneManuale,
      items: cart.map((item) => ({
        prodotto_id: item.prodotto.id,
        quantita: item.quantita,
        note: item.note,
      })),
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

      {/* CATEGORIE (SCROLL ORIZZONTALE) */}
      <div className="px-6 py-4 overflow-x-auto scrollbar-none flex gap-2.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`whitespace-nowrap px-4.5 py-2.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 ${
              selectedCategory === cat.id
                ? 'text-white border-none shadow-lg shadow-indigo-900/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
            }`}
            style={selectedCategory === cat.id ? { backgroundColor: 'var(--lido-primary)' } : {}}
          >
            {cat.nome}
          </button>
        ))}
      </div>

      {/* PRODOTTI LIST */}
      <main className="px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500">
            Nessun prodotto disponibile in questa categoria.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-slate-800/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4.5 flex gap-4 transition-all duration-300 hover:border-slate-700/50">
              {product.immagine_url && (
                <img src={product.immagine_url} alt={product.nome} className="w-20 h-20 rounded-xl object-cover border border-slate-700" />
              )}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-100 leading-snug">{product.nome}</h3>
                  {product.descrizione && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{product.descrizione}</p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-extrabold text-base tracking-wide text-indigo-400">
                    €{Number(product.prezzo).toFixed(2)}
                  </span>
                  <button
                    onClick={() => addToCart(product)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 hover:text-white transition-all duration-200 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
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

              {/* OMBRELLONE REQUIREMENT IN MODAL IF MANUAL */}
              {!initialOmbrellone && (
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
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-slate-400">Totale Ordine</span>
                <span className="font-extrabold text-2xl">€{cartTotal.toFixed(2)}</span>
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
                    <span>Invia Ordine (€{cartTotal.toFixed(2)})</span>
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
