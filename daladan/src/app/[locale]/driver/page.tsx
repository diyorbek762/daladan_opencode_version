'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';
import AuthGuard from '@/components/AuthGuard';
import FloatingChat from '@/components/FloatingChat';
import ClientMap from '@/components/ClientMap';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useDriverTracking } from '@/hooks/useDriverTracking';

type HarvestJob = {
    id: string;
    crop_name: string;
    quantity: number;
    profiles: { username: string } | null;
};

export default function DriverDashboard() {
    const t = useTranslations('Driver');
    const [jobs, setJobs] = useState<HarvestJob[]>([]);
    const [aiAdvice, setAiAdvice] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [driverId, setDriverId] = useState<string | null>(null);
    const [trackingPanelOpen, setTrackingPanelOpen] = useState(false);

    // Get the current user's ID for the WebSocket
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session?.user?.id) {
                setDriverId(data.session.user.id);
            }
        });
    }, []);

    // Live tracking hook — WebSocket + Geolocation
    const tracking = useDriverTracking(driverId);

    useEffect(() => {
        const fetchJobs = async () => {
            const { data } = await supabase
                .from('harvests')
                .select('id, crop_name, quantity, profiles(username)')
                .eq('farmer_provides_transport', false)
                .order('created_at', { ascending: false })
                .limit(10);
            if (data) setJobs(data as any);
        };
        fetchJobs();
    }, []);

    const acceptJob = async (jobId: string) => {
        await supabase.from('harvests').update({ status: 'accepted' }).eq('id', jobId);
        setJobs(prev => prev.filter(j => j.id !== jobId));
    };

    const updateRouteIntelligence = () => {
        setAiLoading(true);
        setTimeout(() => {
            setAiAdvice('🛣️ Optimal marshrut aniqlandi: M39 trassa orqali Guliston aylanma yo\'ldan o\'ting — shahar marshrutiga nisbatan 23 daqiqa tejaysiz. Joriy trafik: Past. Yoqilg\'i tejovchi tezlik: 65 km/soat. 3-to\'xtash joyini (Sergeli) Namangan qaytish yuki bilan birlashtirishni ko\'rib chiqing — +$180 qo\'shimcha daromad.');
            setAiLoading(false);
        }, 2500);
    };

    return (
        <AuthGuard>
            <Navbar />
            <div className="view-hero">
                <div className="view-header">
                    <h1 className="view-title">{t('title')}</h1>
                    <p className="view-subtitle">{t('subtitle')}</p>
                </div>

                {/* Stats Row */}
                <div className="driver-stats-row">
                    <div className="driver-stat">
                        <div className="ds-icon" style={{ background: '#DBEAFE', color: '#2563EB' }}><i className="fa-solid fa-route"></i></div>
                        <div><div className="ds-value">3</div><div className="ds-label">{t('activeRoutes')}</div></div>
                    </div>
                    <div className="driver-stat">
                        <div className="ds-icon" style={{ background: '#ECFDF5', color: '#059669' }}><i className="fa-solid fa-circle-check"></i></div>
                        <div><div className="ds-value">12</div><div className="ds-label">{t('deliveriesToday')}</div></div>
                    </div>
                    <div className="driver-stat">
                        <div className="ds-icon" style={{ background: '#FFFBEB', color: 'var(--harvest-amber)' }}><i className="fa-solid fa-gas-pump"></i></div>
                        <div><div className="ds-value">$1,240</div><div className="ds-label">{t('fuelMTD')}</div></div>
                    </div>
                    <div className="driver-stat">
                        <div className="ds-icon" style={{ background: '#FEF3C7', color: 'var(--harvest-amber)' }}><i className="fa-solid fa-star"></i></div>
                        <div><div className="ds-value">4.9</div><div className="ds-label">{t('rating')}</div></div>
                    </div>
                </div>

                {/* Map */}
                <div className="driver-map-wrapper">
                    <div style={{ height: '420px', width: '100%' }}>
                        <ClientMap
                            jobs={jobs}
                            driverPosition={tracking.driverPosition}
                            nearestOrders={tracking.nearestOrders}
                            routeGeoJSON={tracking.routeGeoJSON}
                            isTracking={tracking.connected}
                            predictedRoute={tracking.predictedRoute}
                            predictLoading={tracking.predictLoading}
                            onFindLoads={tracking.fetchPredictedRoute}
                        />
                    </div>
                    <div className="map-floating-box" style={{ cursor: 'pointer' }}>
                        <div className="float-box-header" onClick={() => setTrackingPanelOpen(prev => !prev)}>
                            <div className="float-box-status"><span className="pulse-dot"></span> {t('liveTracking')}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="float-box-title">Namangan → Toshkent</span>
                                <i className={`fa-solid fa-chevron-${trackingPanelOpen ? 'down' : 'up'}`} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', transition: 'transform 0.2s' }}></i>
                            </div>
                        </div>
                        {trackingPanelOpen && (
                            <>
                                <div className="float-box-destination">
                                    <i className="fa-solid fa-location-dot" style={{ color: '#DC2626' }}></i> Chorsu Bozori
                                </div>
                                <div className="float-box-metrics">
                                    <div className="float-metric highlight"><div className="fm-value">12.4 km</div><div className="fm-label">{t('distance')}</div></div>
                                    <div className="float-metric"><div className="fm-value">18 min</div><div className="fm-label">{t('eta')}</div></div>
                                    <div className="float-metric"><div className="fm-value">42 km/h</div><div className="fm-label">{t('speed')}</div></div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 2-Column Layout */}
                <div className="driver-layout">
                    <div style={{ minWidth: 0 }}>
                        {/* Available Transport Jobs */}
                        <div className="content-card" style={{ marginBottom: '1.5rem' }}>
                            <div className="content-card-header">
                                <span className="content-card-title"><i className="fa-solid fa-box-open" style={{ color: 'var(--harvest-amber)', marginRight: '0.5rem' }}></i>{t('availableJobs')}</span>
                                {jobs.length > 0 && <span className="content-card-badge" style={{ background: '#FFFBEB', color: 'var(--harvest-amber)' }}>{jobs.length} {t('newJobs')}</span>}
                            </div>
                            {jobs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('noJobs')}</div>
                            ) : (
                                jobs.map((job) => (
                                    <div className="placeholder-row" key={job.id}>
                                        <div className="placeholder-avatar" style={{ background: '#FFFBEB', color: 'var(--harvest-amber)' }}><i className="fa-solid fa-wheat-awn"></i></div>
                                        <div className="placeholder-text">
                                            <div className="name">{job.crop_name}</div>
                                            <div className="desc">{job.quantity} kg · {job.profiles?.username || t('unknown')}</div>
                                            <div className="route-info">
                                                <i className="fa-solid fa-location-dot" style={{ color: 'var(--agro-green)' }}></i>
                                                <span>{(job as any).pickup_location || 'Namangan'}</span>
                                                <span className="route-arrow">→</span>
                                                <i className="fa-solid fa-flag-checkered" style={{ color: '#DC2626' }}></i>
                                                <span>{(job as any).delivery_location || 'Toshkent'}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => acceptJob(job.id)} className="inv-btn inv-btn-primary" style={{ flex: 'none', padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                                            <i className="fa-solid fa-check"></i> {t('accept')}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Today's Deliveries */}
                        <div className="content-card">
                            <div className="content-card-header">
                                <span className="content-card-title"><i className="fa-solid fa-map-location-dot" style={{ color: '#2563EB', marginRight: '0.5rem' }}></i>{t('todaysDeliveries')}</span>
                                <span className="content-card-badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>3 {t('stops')}</span>
                            </div>
                            <div className="placeholder-row">
                                <div className="placeholder-avatar" style={{ background: '#ECFDF5', color: '#059669' }}><i className="fa-solid fa-circle-check"></i></div>
                                <div className="placeholder-text"><div className="name">1-to&apos;xtash — Namangan Ombori</div><div className="desc">{t('pickedUp')} 2,400 kg · {t('departed')} 6:30</div></div>
                                <span className="placeholder-status" style={{ background: '#ECFDF5', color: '#059669' }}>{t('completed')}</span>
                            </div>
                            <div className="placeholder-row">
                                <div className="placeholder-avatar" style={{ background: '#DBEAFE', color: '#2563EB' }}><i className="fa-solid fa-truck-fast"></i></div>
                                <div className="placeholder-text"><div className="name">2-to&apos;xtash — Chorsu Bozori, Toshkent</div><div className="desc">1,500 kg · {t('eta')} 18 min · 12.4 km {t('remaining')}</div></div>
                                <span className="placeholder-status" style={{ background: '#DBEAFE', color: '#2563EB' }}>{t('inTransit')}</span>
                            </div>
                            <div className="placeholder-row">
                                <div className="placeholder-avatar" style={{ background: '#F3F4F6', color: 'var(--text-secondary)' }}><i className="fa-solid fa-clock"></i></div>
                                <div className="placeholder-text"><div className="name">3-to&apos;xtash — Sergeli Depot, Toshkent</div><div className="desc">900 kg · {t('scheduled')} 14:00</div></div>
                                <span className="placeholder-status" style={{ background: '#F3F4F6', color: 'var(--text-secondary)' }}>{t('pending')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Pooling Engine Sidebar */}
                    <aside className="pooling-sidebar">
                        <div className="pooling-header">
                            <div className="pooling-header-top">
                                <div className="pooling-header-icon"><i className="fa-solid fa-microchip"></i></div>
                                <span className="pooling-header-title">{t('poolingEngine')}</span>
                            </div>
                            <div className="pooling-header-sub">{t('intelligentOpt')}</div>
                        </div>
                        <div className="pooling-body">
                            <div className="greedy-bar-section">
                                <div className="greedy-bar-label"><span>{t('truckCapacity')}</span><span className="capacity">1,920 / 2,400 kg</span></div>
                                <div className="greedy-bar">
                                    <div className="greedy-segment apples" style={{ width: '50%' }}>🍎 Olma</div>
                                    <div className="greedy-segment onions" style={{ width: '30%' }}>🧅 Piyoz</div>
                                    <div className="greedy-segment empty" style={{ width: '20%' }}>{t('empty')}</div>
                                </div>
                                <div className="greedy-legend">
                                    <div className="greedy-legend-item"><div className="greedy-legend-dot" style={{ background: '#EF4444' }}></div> Olma — 1,200 kg</div>
                                    <div className="greedy-legend-item"><div className="greedy-legend-dot" style={{ background: '#F59E0B' }}></div> Piyoz — 720 kg</div>
                                    <div className="greedy-legend-item"><div className="greedy-legend-dot" style={{ background: '#D1D5DB' }}></div> {t('empty')} — 480 kg</div>
                                </div>
                            </div>

                            <div className="pooling-stats">
                                <div className="pooling-stat-card profit"><div className="ps-icon">💰</div><div className="ps-value" style={{ color: '#059669' }}>+$340</div><div className="ps-label">{t('profitBoost')}</div></div>
                                <div className="pooling-stat-card co2"><div className="ps-icon">🌿</div><div className="ps-value" style={{ color: '#2563EB' }}>-12.6 kg</div><div className="ps-label">{t('co2Saved')}</div></div>
                            </div>

                            <div className="ai-advisor-box">
                                <div className="ai-advisor-title"><i className="fa-solid fa-robot"></i> {t('aiRouteAdvisor')}</div>
                                {aiAdvice && <div style={{ fontSize: '0.8rem', color: '#6D28D9', lineHeight: 1.55, animation: 'resultSlideIn 0.4s ease-out' }}>{aiAdvice}</div>}
                                <button className="ai-route-btn" onClick={updateRouteIntelligence} disabled={aiLoading} style={{ marginTop: aiAdvice ? '0.6rem' : 0 }}>
                                    {aiLoading ? (
                                        <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}></span> {t('analyzingRoutes')}</>
                                    ) : (
                                        <><i className="fa-solid fa-satellite-dish"></i> {t('updateRoute')}</>
                                    )}
                                </button>
                            </div>

                            <button className="greedy-explain-btn"><i className="fa-solid fa-graduation-cap"></i> {t('explainAlg')}</button>
                        </div>
                    </aside>
                </div>

                <FloatingChat />
                <Footer />
            </div>
        </AuthGuard>
    );
}
