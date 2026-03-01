'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtimeProducts, type RealtimeProduct } from '@/hooks/useRealtimeProducts';
import { useTranslations } from 'next-intl';
import AuthGuard from '@/components/AuthGuard';
import FloatingChat from '@/components/FloatingChat';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type CartItem = {
    name: string;
    price: number;
    seller: string;
    qty: number;
    selfDelivery: boolean;
};

type PostedNeed = {
    productName: string;
    category: string;
    quantity: string;
    pricePerKg: string;
    deadline: string;
    urgency: 'high' | 'medium' | 'low';
    deliveryNotes: string;
    region: string;
    postedAt: string;
};

type ProductItem = {
    name: string;
    price: number;
    seller: string;
    minOrder: string;
    rating: string;
    region: string;
    organic: boolean;
    img: string;
    category: string;
    selfDelivery: boolean;
};

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&h=350&fit=crop';

const staticProducts: ProductItem[] = [
    { name: 'Oltin Olma — Premium', price: 3.80, seller: 'Namangan Vodiy Fermalari', minOrder: '500 kg', rating: '4.9', region: 'Namangan', organic: true, img: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=500&h=350&fit=crop', category: 'fruits', selfDelivery: false },
    { name: 'Qizil Piyoz — A Sinf', price: 1.60, seller: 'Samarqand Agro MChJ', minOrder: '1,000 kg', rating: '4.7', region: 'Samarkand', organic: false, img: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&h=350&fit=crop', category: 'root-crops', selfDelivery: false },
    { name: 'Cherry Pomidor — Novda', price: 3.10, seller: 'Yashil Vodiy Issiqxonalari', minOrder: '300 kg', rating: '5.0', region: 'Tashkent', organic: true, img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&h=350&fit=crop', category: 'vegetables', selfDelivery: true },
    { name: 'Yangi Sabzi — Shirin', price: 2.40, seller: "Farg'ona Organik Fermasi", minOrder: '800 kg', rating: '4.6', region: 'Fergana', organic: false, img: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&h=350&fit=crop', category: 'root-crops', selfDelivery: false },
    { name: 'Forscha Bodring', price: 2.90, seller: 'Buxoro Dalalari MChJ', minOrder: '400 kg', rating: '4.8', region: 'Bukhara', organic: true, img: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=500&h=350&fit=crop', category: 'vegetables', selfDelivery: true },
    { name: 'Organik Anor', price: 5.20, seller: 'Denov Premium Mevalar', minOrder: '200 kg', rating: '4.9', region: 'Surxondaryo', organic: true, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&h=350&fit=crop', category: 'fruits', selfDelivery: false },
];

const regions = [
    'Tashkent', 'Namangan', 'Samarkand', 'Fergana', 'Bukhara',
    'Andijan', 'Kashkadarya', 'Surxondaryo', 'Jizzakh', 'Syrdarya',
    'Navoiy', 'Xorazm', 'Karakalpakstan',
];

export default function RetailerDashboard() {
    const t = useTranslations('Retailer');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [showCheckout, setShowCheckout] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [paymentDone, setPaymentDone] = useState(false);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());

    const [showPostNeed, setShowPostNeed] = useState(false);
    const [postedNeeds, setPostedNeeds] = useState<PostedNeed[]>([]);
    const [needForm, setNeedForm] = useState<PostedNeed>({
        productName: '', category: 'fruits', quantity: '', pricePerKg: '',
        deadline: '', urgency: 'medium', deliveryNotes: '', region: 'Tashkent', postedAt: '',
    });
    const [needSuccess, setNeedSuccess] = useState(false);
    const [transportMethod, setTransportMethod] = useState('driver_network');

    // Fetch this retailer's own posted needs from DB on mount
    useEffect(() => {
        const fetchMyNeeds = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { data } = await supabase
                .from('needs')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });
            if (data) {
                setPostedNeeds(data.map((n: any) => ({
                    productName: n.product_name,
                    category: n.category,
                    quantity: String(n.quantity),
                    pricePerKg: String(n.price_per_kg || ''),
                    deadline: n.deadline || '',
                    urgency: n.urgency,
                    deliveryNotes: n.delivery_notes || '',
                    region: n.region,
                    postedAt: new Date(n.created_at).toLocaleDateString('uz-Latn', { month: 'short', day: 'numeric' }),
                    status: n.status,
                })));
            }
        };
        fetchMyNeeds();
    }, []);

    // Realtime products from Supabase (farmer harvests appear live)
    const { products: realtimeHarvests } = useRealtimeProducts();
    const dbProducts: ProductItem[] = realtimeHarvests.map((h: RealtimeProduct) => ({
        name: h.crop_name,
        price: h.price_per_kg ? h.price_per_kg : 2.50,
        seller: h.seller_name || 'Daladan Fermer',
        minOrder: `${Math.min(h.quantity, 500)} kg`,
        rating: '4.8',
        region: h.region || 'Tashkent',
        organic: true,
        img: h.image_url || DEFAULT_IMG,
        category: 'vegetables',
        selfDelivery: h.farmer_provides_transport || false,
    }));

    const allProducts = [...dbProducts, ...staticProducts];

    const addToCart = (product: ProductItem) => {
        setCart(prev => {
            const existing = prev.find(c => c.name === product.name);
            if (existing) return prev.map(c => c.name === product.name ? { ...c, qty: c.qty + 1 } : c);
            return [...prev, { name: product.name, price: product.price, seller: product.seller, qty: 1, selfDelivery: product.selfDelivery }];
        });
    };

    const removeFromCart = (name: string) => setCart(prev => prev.filter(c => c.name !== name));
    const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty * 500, 0);

    const toggleFav = (name: string) => {
        setFavorites(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
    };

    const filteredProducts = allProducts
        .filter((p: ProductItem) => {
            if (activeFilter !== 'all' && p.category !== activeFilter) return false;
            if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        })
        .sort((a: ProductItem, b: ProductItem) => {
            if (sortBy === 'price-asc') return a.price - b.price;
            if (sortBy === 'price-desc') return b.price - a.price;
            return 0;
        });

    const handlePayment = () => {
        setPaymentDone(true);
        setTimeout(() => { setPaymentDone(false); setShowCheckout(false); setCart([]); }, 2000);
    };

    const handlePostNeed = async () => {
        if (!needForm.productName || !needForm.quantity || !needForm.pricePerKg || !needForm.deadline) return;
        // Persist to Supabase needs table
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { error: needError } = await supabase.from('needs').insert({
            user_id: session.user.id,
            product_name: needForm.productName,
            category: needForm.category,
            quantity: parseInt(needForm.quantity),
            price_per_kg: parseFloat(needForm.pricePerKg),
            deadline: needForm.deadline || null,
            urgency: needForm.urgency,
            delivery_notes: needForm.deliveryNotes || null,
            region: needForm.region,
        });
        if (needError) {
            console.error('Need insert error:', needError);
            alert(`❌ Xatolik: ${needError.message}`);
            return;
        }
        // Also update local state for immediate display
        const newNeed: PostedNeed = { ...needForm, postedAt: new Date().toLocaleDateString('uz-Latn', { month: 'short', day: 'numeric' }) };
        setPostedNeeds(prev => [newNeed, ...prev]);
        setNeedSuccess(true);
        setTimeout(() => {
            setNeedSuccess(false);
            setShowPostNeed(false);
            setNeedForm({ productName: '', category: 'fruits', quantity: '', pricePerKg: '', deadline: '', urgency: 'medium', deliveryNotes: '', region: 'Tashkent', postedAt: '' });
        }, 2000);
    };

    const urgencyConfig = {
        high: { label: t('urgent'), color: '#EF4444', bg: '#FEE2E2' },
        medium: { label: t('medium'), color: '#D97706', bg: '#FEF3C7' },
        low: { label: t('flexible'), color: '#059669', bg: '#ECFDF5' },
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '0.7rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', background: 'var(--surface-primary)', color: 'var(--text-primary)' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' };

    const categories = [
        { id: 'all', label: t('allProducts') },
        { id: 'fruits', label: t('fruits') },
        { id: 'vegetables', label: t('vegetables') },
        { id: 'root-crops', label: t('rootCrops') },
    ];

    return (
        <AuthGuard>
            <Navbar />
            <div className="view-hero">
                <div className="view-header">
                    <h1 className="view-title">{t('title')}</h1>
                    <p className="view-subtitle">{t('subtitle')}</p>
                </div>

                {/* Bulk Request CTA */}
                <div className="bulk-request-cta">
                    <div className="bulk-cta-left">
                        <div className="bulk-cta-icon"><i className="fa-solid fa-bullhorn"></i></div>
                        <div className="bulk-cta-text">
                            <h3>{t('postBulk')}</h3>
                            <p>{t('postBulkDesc')}</p>
                        </div>
                    </div>
                    <button className="bulk-cta-btn" onClick={() => setShowPostNeed(true)}><i className="fa-solid fa-plus"></i> {t('postRequest')}</button>
                </div>

                {/* Posted Needs — always visible, fetched from DB */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: '#EDE9FE', color: '#7C3AED', fontSize: '0.8rem' }}>
                            <i className="fa-solid fa-clipboard-list"></i>
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{t('yourPostedNeeds')}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-secondary)' }}>({postedNeeds.length})</span>
                    </div>
                    {postedNeeds.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'var(--surface-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <i className="fa-solid fa-clipboard-list" style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block', opacity: 0.4 }}></i>
                            {t('noPostedNeeds') || "Hozircha ehtiyoj e'lon qilinmagan"}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                            {postedNeeds.map((need, i) => (
                                <div key={i} style={{ background: 'var(--surface-primary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem 1.15rem', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: urgencyConfig[need.urgency].color }}></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{need.productName}</div>
                                        <span style={{ padding: '0.15rem 0.55rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600, background: urgencyConfig[need.urgency].bg, color: urgencyConfig[need.urgency].color }}>
                                            {urgencyConfig[need.urgency].label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                                        <span><i className="fa-solid fa-weight-hanging" style={{ fontSize: '0.65rem', marginRight: '0.25rem' }}></i>{need.quantity} kg</span>
                                        <span><i className="fa-solid fa-dollar-sign" style={{ fontSize: '0.65rem', marginRight: '0.25rem' }}></i>{need.pricePerKg}/kg</span>
                                        <span><i className="fa-solid fa-calendar" style={{ fontSize: '0.65rem', marginRight: '0.25rem' }}></i>{need.deadline}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <i className="fa-solid fa-location-dot" style={{ fontSize: '0.6rem', marginRight: '0.25rem' }}></i>{need.region} · {t('posted')} {need.postedAt}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search + Filter + Sort */}
                <div className="marketplace-search">
                    <div className="search-input-wrap">
                        <i className="fa-solid fa-magnifying-glass"></i>
                        <input type="text" placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="search-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                        <option value="newest">{t('sortNewest')}</option>
                        <option value="price-asc">{t('sortPriceAsc')}</option>
                        <option value="price-desc">{t('sortPriceDesc')}</option>
                    </select>
                    {cart.length > 0 && (
                        <button onClick={() => setShowCart(!showCart)} style={{ padding: '0.7rem 1.2rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, var(--agro-green), var(--agro-green-lighter))', color: '#fff', fontFamily: 'Inter,sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' as const }}>
                            <i className="fa-solid fa-shopping-cart"></i> {t('cart')} ({cart.reduce((s, c) => s + c.qty, 0)})
                        </button>
                    )}
                </div>

                <div className="filter-pills">
                    {categories.map(cat => (
                        <button key={cat.id} className={`filter-pill ${activeFilter === cat.id ? 'active' : ''}`} onClick={() => setActiveFilter(cat.id)}>{cat.label}</button>
                    ))}
                </div>

                {/* Product Grid */}
                <div className="product-grid">
                    {filteredProducts.map((p: ProductItem, i: number) => (
                        <div className="product-card" key={i}>
                            <div className="product-img-wrap">
                                <img src={p.img} alt={p.name} loading="lazy" />
                                <div className="product-img-badges">
                                    <span className="product-region-tag"><i className="fa-solid fa-location-dot" style={{ fontSize: '0.55rem' }}></i> {p.region}</span>
                                    {p.organic && <span className="product-organic-tag"><i className="fa-solid fa-leaf" style={{ fontSize: '0.5rem' }}></i> Organik</span>}
                                </div>
                            </div>
                            <div className="product-card-body">
                                <div className="product-name">{p.name}</div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.4rem', background: p.selfDelivery ? '#ECFDF5' : '#FEF3C7', color: p.selfDelivery ? '#059669' : '#B45309' }}>
                                    <i className={`fa-solid ${p.selfDelivery ? 'fa-truck-fast' : 'fa-truck'}`} style={{ fontSize: '0.6rem' }}></i>
                                    {p.selfDelivery ? t('sellerDelivers') : t('requiresDriver')}
                                </div>
                                <div className="product-seller"><span className="verified-badge"><i className="fa-solid fa-check"></i></span> {p.seller}</div>
                                <div className="product-meta-row">
                                    <div className="product-meta-chip"><div className="pmc-value">${p.price.toFixed(2)}/kg</div><div className="pmc-label">{t('price' as any) || 'Narx'}</div></div>
                                    <div className="product-meta-chip"><div className="pmc-value">{p.minOrder}</div><div className="pmc-label">{t('minOrder')}</div></div>
                                    <div className="product-meta-chip"><div className="pmc-value">⭐ {p.rating}</div><div className="pmc-label">{t('rating' as any) || 'Reyting'}</div></div>
                                </div>
                                <div className="product-card-footer">
                                    <button className="product-cart-btn" onClick={() => addToCart(p)}><i className="fa-solid fa-cart-plus"></i> {t('addToCart')}</button>
                                    <button className="product-fav-btn" onClick={() => toggleFav(p.name)}>
                                        <i className={`fa-${favorites.has(p.name) ? 'solid' : 'regular'} fa-heart`} style={favorites.has(p.name) ? { color: '#EF4444' } : {}}></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Cart Sidebar */}
                {showCart && cart.length > 0 && (
                    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'var(--surface-primary)', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', zIndex: 9998, display: 'flex', flexDirection: 'column', animation: 'viewFadeIn .3s ease-out' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}><i className="fa-solid fa-shopping-cart" style={{ marginRight: '0.5rem', color: 'var(--agro-green)' }}></i> {t('yourCart')}</h3>
                            <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
                            {cart.map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 0', borderBottom: '1px solid var(--surface-tertiary)' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.seller} · {item.qty} × 500 kg</div>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--agro-green)' }}>${(item.price * item.qty * 500).toLocaleString()}</div>
                                    <button onClick={() => removeFromCart(item.name)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.85rem' }}><i className="fa-solid fa-trash"></i></button>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 700 }}>
                                <span>{t('total')}</span><span style={{ color: 'var(--agro-green)' }}>${cartTotal.toLocaleString()}</span>
                            </div>
                            <button onClick={() => { setShowCart(false); setShowCheckout(true); }}
                                style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--agro-green), var(--agro-green-lighter))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <i className="fa-solid fa-credit-card"></i> {t('proceedCheckout')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Checkout Modal */}
                <div className={`modal-overlay ${showCheckout ? 'open' : ''}`} onClick={() => setShowCheckout(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--agro-green), var(--agro-green-lighter))' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <i className="fa-solid fa-credit-card" style={{ fontSize: '1.2rem' }}></i>
                                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('checkout')}</h2>
                            </div>
                            <button className="modal-close" onClick={() => setShowCheckout(false)}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div className="modal-body">
                            {paymentDone ? (
                                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('paymentSuccess')}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{t('paymentSuccessDesc')}</p>
                                </div>
                            ) : (
                                <>
                                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>{t('orderSummary')}</h3>
                                    {cart.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--surface-tertiary)', fontSize: '0.85rem' }}>
                                            <span>{item.name} × {item.qty * 500} kg</span>
                                            <span style={{ fontWeight: 600 }}>${(item.price * item.qty * 500).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', fontSize: '1.1rem', fontWeight: 700, borderTop: '2px solid var(--border-color)', marginTop: '0.5rem' }}>
                                        <span>{t('total')}</span><span style={{ color: 'var(--agro-green)' }}>${cartTotal.toLocaleString()}</span>
                                    </div>

                                    {/* Transport Options */}
                                    <div style={{ marginBottom: '1.15rem' }}>
                                        <label style={labelStyle}>{t('transportMethod')}</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {/* Driver Network — always shown */}
                                            <label style={{
                                                display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem',
                                                borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                                                border: transportMethod === 'driver_network' ? '2px solid var(--agro-green)' : '1px solid var(--border-color)',
                                                background: transportMethod === 'driver_network' ? 'rgba(6,78,59,0.05)' : 'var(--surface-secondary)',
                                            }}>
                                                <input type="radio" name="transport" value="driver_network" checked={transportMethod === 'driver_network'} onChange={e => setTransportMethod(e.target.value)} style={{ accentColor: 'var(--agro-green)' }} />
                                                <div><div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('driverNetwork')}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('driverNetworkDesc')}</div></div>
                                            </label>

                                            {/* Producer Self-Transport — only if any cart item has selfDelivery */}
                                            {cart.some(c => c.selfDelivery) && (
                                                <label style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem',
                                                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                                                    border: transportMethod === 'producer_transport' ? '2px solid var(--agro-green)' : '1px solid var(--border-color)',
                                                    background: transportMethod === 'producer_transport' ? 'rgba(6,78,59,0.05)' : 'var(--surface-secondary)',
                                                }}>
                                                    <input type="radio" name="transport" value="producer_transport" checked={transportMethod === 'producer_transport'} onChange={e => setTransportMethod(e.target.value)} style={{ accentColor: 'var(--agro-green)' }} />
                                                    <div><div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('producerTransport')}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('producerTransportDesc')}</div></div>
                                                </label>
                                            )}

                                            {/* Retailer Pickup — always shown */}
                                            <label style={{
                                                display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem',
                                                borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                                                border: transportMethod === 'retailer_pickup' ? '2px solid var(--agro-green)' : '1px solid var(--border-color)',
                                                background: transportMethod === 'retailer_pickup' ? 'rgba(6,78,59,0.05)' : 'var(--surface-secondary)',
                                            }}>
                                                <input type="radio" name="transport" value="retailer_pickup" checked={transportMethod === 'retailer_pickup'} onChange={e => setTransportMethod(e.target.value)} style={{ accentColor: 'var(--agro-green)' }} />
                                                <div><div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('retailerPickup')}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('retailerPickupDesc')}</div></div>
                                            </label>
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={labelStyle}>{t('cardNumber')}</label>
                                        <input type="text" placeholder="4242 4242 4242 4242" style={inputStyle} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>{t('expiry')}</label>
                                            <input type="text" placeholder="MM/YY" style={inputStyle} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>CVC</label>
                                            <input type="text" placeholder="123" style={inputStyle} />
                                        </div>
                                    </div>
                                    <button onClick={handlePayment}
                                        style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--agro-green), var(--agro-green-lighter))', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 2px 8px rgba(6,78,59,0.25)' }}>
                                        <i className="fa-solid fa-lock"></i> {t('pay')} ${cartTotal.toLocaleString()}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Post a Need Modal */}
                <div className={`modal-overlay ${showPostNeed ? 'open' : ''}`} onClick={() => { if (!needSuccess) setShowPostNeed(false); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <i className="fa-solid fa-bullhorn" style={{ fontSize: '1.2rem' }}></i>
                                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('postNeed')}</h2>
                            </div>
                            <button className="modal-close" onClick={() => setShowPostNeed(false)}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div className="modal-body">
                            {needSuccess ? (
                                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('needPosted')}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{t('needPostedDesc')}</p>
                                </div>
                            ) : (
                                <>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.15rem', lineHeight: 1.5 }}>
                                        <i className="fa-solid fa-circle-info" style={{ marginRight: '0.3rem', color: '#7C3AED' }}></i>
                                        {t('postNeedInfo')}
                                    </p>

                                    <div style={{ marginBottom: '0.9rem' }}>
                                        <label style={labelStyle}>{t('productName')} *</label>
                                        <input type="text" value={needForm.productName} onChange={e => setNeedForm(f => ({ ...f, productName: e.target.value }))} placeholder={t('productNamePlaceholder')} style={inputStyle} />
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>{t('category')}</label>
                                            <select value={needForm.category} onChange={e => setNeedForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                                                <option value="fruits">{t('fruits')}</option>
                                                <option value="vegetables">{t('vegetables')}</option>
                                                <option value="root-crops">{t('rootCrops')}</option>
                                                <option value="grains">{t('grains')}</option>
                                                <option value="dairy">{t('dairy')}</option>
                                                <option value="other">{t('other')}</option>
                                            </select>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>{t('region')}</label>
                                            <select value={needForm.region} onChange={e => setNeedForm(f => ({ ...f, region: e.target.value }))} style={inputStyle}>
                                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>{t('quantityKg')} *</label>
                                            <input type="number" value={needForm.quantity} onChange={e => setNeedForm(f => ({ ...f, quantity: e.target.value }))} placeholder={t('quantityPlaceholder')} style={inputStyle} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={labelStyle}>{t('maxPrice')} *</label>
                                            <input type="number" step="0.01" value={needForm.pricePerKg} onChange={e => setNeedForm(f => ({ ...f, pricePerKg: e.target.value }))} placeholder={t('maxPricePlaceholder')} style={inputStyle} />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '0.9rem' }}>
                                        <label style={labelStyle}>{t('neededBy')} *</label>
                                        <input type="date" value={needForm.deadline} onChange={e => setNeedForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} />
                                    </div>

                                    <div style={{ marginBottom: '0.9rem' }}>
                                        <label style={labelStyle}>{t('urgencyLevel')}</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {(['high', 'medium', 'low'] as const).map(u => (
                                                <button key={u} type="button"
                                                    onClick={() => setNeedForm(f => ({ ...f, urgency: u }))}
                                                    style={{
                                                        flex: 1, padding: '0.6rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                                        border: needForm.urgency === u ? `2px solid ${urgencyConfig[u].color}` : '1px solid var(--border-color)',
                                                        background: needForm.urgency === u ? `${urgencyConfig[u].color}15` : 'var(--surface-secondary)',
                                                        color: needForm.urgency === u ? urgencyConfig[u].color : 'var(--text-secondary)',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                >
                                                    {urgencyConfig[u].label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <label style={labelStyle}>{t('deliveryNotes')}</label>
                                        <textarea value={needForm.deliveryNotes} onChange={e => setNeedForm(f => ({ ...f, deliveryNotes: e.target.value }))} placeholder={t('deliveryNotesPlaceholder')} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
                                    </div>

                                    <button onClick={handlePostNeed}
                                        style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}>
                                        <i className="fa-solid fa-paper-plane"></i> {t('postNeedBtn')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <FloatingChat />
                <Footer />
            </div>
        </AuthGuard>
    );
}
