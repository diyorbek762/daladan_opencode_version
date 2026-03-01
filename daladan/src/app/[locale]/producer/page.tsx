'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';
import AuthGuard from '@/components/AuthGuard';
import FloatingChat from '@/components/FloatingChat';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useRealtimeProducts, type RealtimeProduct } from '@/hooks/useRealtimeProducts';
import { useRealtimeNeeds, type RealtimeNeed } from '@/hooks/useRealtimeNeeds';
import { matchProductToNeeds, type Match } from '@/lib/matchProductToNeeds';

const REGIONS = [
    'Tashkent', 'Namangan', 'Samarkand', 'Fergana', 'Bukhara',
    'Andijan', 'Kashkadarya', 'Surxondaryo', 'Jizzakh', 'Syrdarya',
    'Navoiy', 'Xorazm', 'Karakalpakstan',
];
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&h=300&fit=crop';

export default function ProducerDashboard() {
    const t = useTranslations('Producer');
    const [loading, setLoading] = useState(false);
    const [cropName, setCropName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [pricePerKg, setPricePerKg] = useState('');
    const [region, setRegion] = useState('Tashkent');
    const [transport, setTransport] = useState('need_driver');
    const [imagePreview, setImagePreview] = useState('');
    const [imageFile, setImageFile] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showHarvestModal, setShowHarvestModal] = useState(false);
    const [shippedItems, setShippedItems] = useState<Set<string>>(new Set());
    const [acceptedNeeds, setAcceptedNeeds] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<string | null>(null);
    const [matchResults, setMatchResults] = useState<Match[]>([]);
    const [userId, setUserId] = useState<string | undefined>();

    // Get current user ID for filtering
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setUserId(session.user.id);
        });
    }, []);

    // Realtime hooks
    const { products: myProducts, loading: productsLoading } = useRealtimeProducts(userId);
    const { needs: liveNeeds, loading: needsLoading } = useRealtimeNeeds();

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleShipNow = (itemName: string) => {
        setShippedItems(prev => { const next = new Set(prev); next.add(itemName); return next; });
        showToast(`✅ "${itemName}" ${t('shipToast')}`);
    };

    const handleAcceptNeed = async (need: RealtimeNeed) => {
        setAcceptedNeeds(prev => { const next = new Set(prev); next.add(need.id); return next; });
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Update need status to 'matched'
        await supabase.from('needs').update({ status: 'matched' }).eq('id', need.id);

        // 2. Send auto-message to the retailer
        const msg = `🤝 Buyurtmangiz qabul qilindi!\n\n📦 Mahsulot: ${need.product_name}\n📊 Miqdor: ${need.quantity} kg\n💲 Narx: $${need.price_per_kg}/kg\n📍 Hudud: ${need.region}\n\nMen sizning so'rovingizni bajarish uchun tayyorman. Yetkazib berish shartlarini muhokama qilaylik!`;

        await supabase.from('messages').insert({
            sender_id: session.user.id,
            recipient_id: need.user_id,
            content: msg,
        });

        showToast(`🤝 "${need.product_name}" ${t('acceptToast')}`);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setImagePreview(base64);
            setImageFile(base64);
        };
        reader.readAsDataURL(file);
    };

    const submitHarvest = async () => {
        if (!cropName || !quantity) return;
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const insertData: Record<string, any> = {
            user_id: session.user.id,
            crop_name: cropName,
            quantity: parseInt(quantity),
            farmer_provides_transport: transport === 'self_deliver',
            region: region,
        };
        if (pricePerKg) insertData.price_per_kg = parseFloat(pricePerKg);
        if (imageFile) insertData.image_url = imageFile;

        const { data, error } = await supabase.from('harvests').insert(insertData).select().single();
        if (error) {
            console.error('Harvest insert error:', error);
            showToast(`❌ Xatolik: ${error.message}`);
            setLoading(false);
            return;
        }

        // Check for matching needs
        if (data && liveNeeds.length > 0) {
            const matches = matchProductToNeeds(data as RealtimeProduct, liveNeeds);
            if (matches.length > 0) {
                setMatchResults(matches);
                showToast(`🎯 ${matches.length} ${t('matchesFound') || 'mos keluvchi ehtiyoj topildi!'}`);
            } else {
                showToast(`✅ ${t('addedToInventory')}`);
            }
        } else {
            showToast(`✅ ${t('addedToInventory')}`);
        }

        setLoading(false);
        setCropName('');
        setQuantity('');
        setPricePerKg('');
        setRegion('Tashkent');
        setImagePreview('');
        setImageFile('');
        setShowHarvestModal(false);
    };

    const urgencyConfig: Record<string, { emoji: string; color: string; bg: string }> = {
        high: { emoji: '🔴', color: '#DC2626', bg: '#FEE2E2' },
        medium: { emoji: '🟡', color: '#D97706', bg: '#FEF3C7' },
        low: { emoji: '🟢', color: '#059669', bg: '#ECFDF5' },
    };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '0.7rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' };

    return (
        <AuthGuard>
            <Navbar />
            <div className="view-hero">
                <div className="view-header">
                    <h1 className="view-title">{t('title')}</h1>
                    <p className="view-subtitle">{t('subtitle')}</p>
                </div>

                {/* Revenue Header */}
                <div className="revenue-header">
                    <div className="revenue-top">
                        <div>
                            <div className="revenue-label">{t('totalRevenue')}</div>
                            <div className="revenue-amount"><span className="currency">$</span>127,450</div>
                            <div className="revenue-change">
                                <i className="fa-solid fa-arrow-trend-up" style={{ fontSize: '0.7rem' }}></i>
                                +18.3% {t('vsLastSeason')}
                            </div>
                        </div>
                        <div className="revenue-sparkline">
                            {[35, 50, 40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                                <div key={i} className="bar" style={{ height: `${h}%` }}></div>
                            ))}
                            <div className="bar" style={{ height: '100%', background: 'var(--harvest-amber-light)' }}></div>
                        </div>
                    </div>
                    <div className="revenue-stats-row">
                        <div className="revenue-stat-item">
                            <div className="rs-value">$34,250</div>
                            <div className="rs-label">{t('thisMonth')}</div>
                        </div>
                        <div className="revenue-stat-item">
                            <div className="rs-value">{myProducts.length + liveNeeds.length}</div>
                            <div className="rs-label">{t('activeOrders')}</div>
                        </div>
                        <div className="revenue-stat-item">
                            <div className="rs-value">{myProducts.reduce((sum, p) => sum + p.quantity, 0).toLocaleString()} kg</div>
                            <div className="rs-label">{t('totalInventory')}</div>
                        </div>
                    </div>
                </div>

                {/* Match Notifications */}
                {matchResults.length > 0 && (
                    <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)', border: '1px solid #BBF7D0', borderRadius: '14px', animation: 'viewFadeIn 0.4s ease-out' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>🎯</span>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#059669' }}>{t('matchesFound') || 'Mos keluvchi ehtiyojlar topildi!'}</span>
                            <button onClick={() => setMatchResults([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem' }}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        {matchResults.slice(0, 3).map((match, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderTop: i > 0 ? '1px solid #D1FAE5' : 'none' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{match.need.product_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {match.need.quantity} kg · ${match.need.price_per_kg}/kg · {match.need.region}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem' }}>{match.reasons.join(' · ')}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{match.score}%</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>mos</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Live Market Needs (from Retailer — Realtime) */}
                <div className="market-scroll-wrapper">
                    <div className="section-header">
                        <div className="section-title">
                            <span className="icon-bg" style={{ background: '#FFFBEB', color: 'var(--harvest-amber)' }}>
                                <i className="fa-solid fa-fire-flame-curved"></i>
                            </span>
                            {t('marketNeeds')}
                            <span className="pulse-dot" style={{ marginLeft: '0.4rem' }}></span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            <i className="fa-solid fa-signal" style={{ fontSize: '0.6rem', color: '#059669', marginRight: '0.25rem' }}></i>
                            {t('liveUpdates') || 'Jonli yangilanish'}
                        </span>
                    </div>
                    <div className="market-scroll">
                        {needsLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.4rem' }}></i> {t('loading') || 'Yuklanmoqda...'}
                            </div>
                        ) : liveNeeds.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {t('noNeeds') || 'Hozircha ehtiyojlar yo\'q'}
                            </div>
                        ) : (
                            liveNeeds.map((need) => {
                                const uc = urgencyConfig[need.urgency] || urgencyConfig.medium;
                                return (
                                    <div className="market-card" key={need.id}>
                                        <div className="market-card-top">
                                            <div className="market-card-icon" style={{ background: uc.bg, color: uc.color }}>{uc.emoji}</div>
                                            <span className={`market-urgency ${need.urgency}`}>{uc.emoji}</span>
                                        </div>
                                        <div className="market-card-name">{need.product_name}</div>
                                        <div className="market-card-buyer">
                                            <i className="fa-solid fa-store" style={{ fontSize: '0.7rem' }}></i> {need.profiles?.username || 'Sotuvchi'}
                                        </div>
                                        <div className="market-card-details">
                                            <div className="market-detail"><div className="md-value">{need.quantity.toLocaleString()} kg</div><div className="md-label">{t('quantity')}</div></div>
                                            <div className="market-detail"><div className="md-value">{need.price_per_kg ? `$${need.price_per_kg}/kg` : '—'}</div><div className="md-label">{t('price')}</div></div>
                                            <div className="market-detail"><div className="md-value">{need.deadline || '—'}</div><div className="md-label">{t('deadline')}</div></div>
                                        </div>
                                        <button
                                            className="market-card-action"
                                            onClick={() => handleAcceptNeed(need)}
                                            disabled={acceptedNeeds.has(need.id)}
                                            style={acceptedNeeds.has(need.id) ? { opacity: 0.6, cursor: 'default', background: '#D1FAE5', color: '#059669' } : {}}
                                        >
                                            <i className={`fa-solid ${acceptedNeeds.has(need.id) ? 'fa-check-circle' : 'fa-handshake'}`}></i>
                                            {acceptedNeeds.has(need.id) ? t('accepted') : t('acceptOrder')}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Inventory Section (Realtime) */}
                <div className="section-header">
                    <div className="section-title">
                        <span className="icon-bg" style={{ background: '#ECFDF5', color: 'var(--agro-green)' }}>
                            <i className="fa-solid fa-boxes-stacked"></i>
                        </span>
                        {t('inventory')}
                        <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-secondary)' }}>({myProducts.length} {t('batches')})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="section-see-all">{t('manageAll')} <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.7rem' }}></i></button>
                        <button className="section-see-all" onClick={() => setShowHarvestModal(true)}
                            style={{ background: 'var(--agro-green)', color: '#fff', padding: '0.4rem 0.85rem', borderRadius: '8px' }}>
                            <i className="fa-solid fa-plus" style={{ fontSize: '0.7rem', marginRight: '0.3rem' }}></i> {t('logHarvest')}
                        </button>
                    </div>
                </div>

                <div className="inventory-grid">
                    {productsLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', gridColumn: '1/-1' }}>
                            <i className="fa-solid fa-spinner fa-spin"></i>
                        </div>
                    ) : myProducts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', gridColumn: '1/-1' }}>{t('noInventory')}</div>
                    ) : (
                        myProducts.map((item) => (
                            <div className="inventory-card" key={item.id}>
                                <div className="inv-card-img" style={{ backgroundImage: `url('${item.image_url || DEFAULT_IMG}')` }}>
                                    <div className="inv-badge-row">
                                        <span className="inv-badge organic"><i className="fa-solid fa-leaf" style={{ fontSize: '0.6rem' }}></i> {t('organic')}</span>
                                        <span className="inv-badge batch"><i className="fa-solid fa-location-dot" style={{ fontSize: '0.55rem' }}></i> {item.region}</span>
                                    </div>
                                </div>
                                <div className="inv-card-body">
                                    <div className="inv-card-head"><span className="inv-card-name">{item.crop_name}</span></div>
                                    <div className="inv-meta-grid">
                                        <div className="inv-meta"><div className="im-value">{item.quantity.toLocaleString()} kg</div><div className="im-label">{t('inStock')}</div></div>
                                        {item.price_per_kg && <div className="inv-meta"><div className="im-value">${item.price_per_kg}/kg</div><div className="im-label">{t('price')}</div></div>}
                                        <div className="inv-meta"><div className="im-value">{new Date(item.created_at).toLocaleDateString('uz-Latn', { day: 'numeric', month: 'short' })}</div><div className="im-label">{t('harvested')}</div></div>
                                    </div>
                                    <div className="inv-card-actions">
                                        <button className="inv-btn inv-btn-primary"
                                            onClick={() => handleShipNow(item.crop_name)}
                                            disabled={shippedItems.has(item.crop_name)}
                                            style={shippedItems.has(item.crop_name) ? { opacity: 0.6, cursor: 'default' } : {}}>
                                            <i className={`fa-solid ${shippedItems.has(item.crop_name) ? 'fa-check' : 'fa-paper-plane'}`}></i>
                                            {shippedItems.has(item.crop_name) ? t('shipped') : t('shipNow')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                        background: '#1F2937', color: '#fff', padding: '0.85rem 1.5rem',
                        borderRadius: '12px', fontSize: '0.88rem', fontWeight: 500,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 10000,
                        animation: 'viewFadeIn 0.3s ease-out', fontFamily: 'Inter, sans-serif',
                    }}>
                        {toast}
                    </div>
                )}

                <FloatingChat />
                <Footer />
            </div>

            {/* Harvest Modal */}
            <div className={`modal-overlay ${showHarvestModal ? 'open' : ''}`} onClick={() => setShowHarvestModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <i className="fa-solid fa-wheat-awn" style={{ fontSize: '1.2rem', color: '#A78BFA' }}></i>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{t('harvestLog')}</h2>
                        </div>
                        <button className="modal-close" onClick={() => setShowHarvestModal(false)}><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="modal-body">
                        {/* Image Upload */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>{t('uploadImage')}</label>
                            <div onClick={() => fileInputRef.current?.click()} style={{
                                width: '100%', height: imagePreview ? '180px' : '100px',
                                border: '2px dashed var(--border-color)', borderRadius: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', overflow: 'hidden', background: imagePreview ? 'transparent' : 'var(--surface-secondary)',
                            }}>
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <i className="fa-solid fa-camera" style={{ fontSize: '1.5rem', marginBottom: '0.3rem', display: 'block' }}></i>
                                        <span style={{ fontSize: '0.78rem' }}>{t('imageHint')}</span>
                                    </div>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>{t('cropName')}</label>
                            <input type="text" value={cropName} onChange={(e) => setCropName(e.target.value)} placeholder={t('cropPlaceholder')} style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>{t('quantityKg')}</label>
                                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('quantityPlaceholder')} style={inputStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>{t('pricePerKg')}</label>
                                <input type="number" step="0.01" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} placeholder={t('pricePlaceholder')} style={inputStyle} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>{t('region')}</label>
                            <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
                                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={labelStyle}>{t('transportMethod')}</label>
                            <div className="transport-options">
                                <label className="transport-option">
                                    <input type="radio" name="transport" value="need_driver" checked={transport === 'need_driver'} onChange={(e) => setTransport(e.target.value)} />
                                    <div><div className="to-text">{t('needDriver')}</div><div className="to-desc">{t('needDriverDesc')}</div></div>
                                </label>
                                <label className="transport-option">
                                    <input type="radio" name="transport" value="self_deliver" checked={transport === 'self_deliver'} onChange={(e) => setTransport(e.target.value)} />
                                    <div><div className="to-text">{t('selfDeliver')}</div><div className="to-desc">{t('selfDeliverDesc')}</div></div>
                                </label>
                            </div>
                        </div>
                        <button onClick={submitHarvest} disabled={loading}
                            style={{ width: '100%', padding: '0.85rem', background: 'var(--agro-green)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <i className="fa-solid fa-check"></i> {loading ? t('submitting') : t('submitHarvest')}
                        </button>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
