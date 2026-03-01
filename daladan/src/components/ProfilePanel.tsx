'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type TrustProfile = {
    user_id: string;
    full_name: string;
    role: string;
    region: string | null;
    trust_score: number;
    leaderboard_rank: number;
    total_ratings: number;
    avg_score: number;
    documents: { id: string; file_url: string; document_type: string; is_verified: boolean; created_at: string }[];
    contacts: { id: string; contact_type: string; contact_value: string; is_public: boolean; created_at: string }[];
};

type SupabaseProfile = {
    username: string;
    email: string | null;
    phone: string | null;
    location: string | null;
};

const CONTACT_META: Record<string, { icon: string; color: string; bg: string; prefix: string }> = {
    telegram: { icon: 'fa-brands fa-telegram', color: '#38BDF8', bg: '#0EA5E9', prefix: 'https://t.me/' },
    whatsapp: { icon: 'fa-brands fa-whatsapp', color: '#4ADE80', bg: '#22C55E', prefix: 'https://wa.me/' },
    phone: { icon: 'fa-solid fa-phone', color: '#818CF8', bg: '#6366F1', prefix: 'tel:' },
    website: { icon: 'fa-solid fa-globe', color: '#C084FC', bg: '#A855F7', prefix: '' },
};

const DOC_ICONS: Record<string, string> = {
    license: '🪪', certificate: '📜', passport: '🛂',
};

export default function ProfilePanel({ onClose }: { onClose: () => void }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [profile, setProfile] = useState<SupabaseProfile | null>(null);
    const [trust, setTrust] = useState<TrustProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setUserId(session.user.id);
        });
    }, []);

    useEffect(() => {
        if (!userId) return;

        const load = async () => {
            setLoading(true);

            // Fetch Supabase profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('username, email, phone, location')
                .eq('id', userId)
                .single();
            if (profileData) setProfile(profileData);

            // Fetch trust profile from FastAPI
            try {
                const resp = await fetch(`/api/trust/users/${userId}/trust-profile`);
                if (resp.ok) {
                    const data = await resp.json();
                    setTrust(data);
                }
            } catch (e) {
                console.warn('Trust profile fetch failed:', e);
            }

            setLoading(false);
        };
        load();
    }, [userId]);

    const scoreValue = trust?.trust_score ?? 0;
    const dashOffset = 314 - (314 * Math.min(scoreValue, 100) / 100);

    const rankLabel = (rank: number) => {
        if (rank === 1) return { text: '🥇', badge: 'profile-rank-gold' };
        if (rank === 2) return { text: '🥈', badge: 'profile-rank-silver' };
        if (rank === 3) return { text: '🥉', badge: 'profile-rank-bronze' };
        return { text: `#${rank}`, badge: '' };
    };

    return (
        <div className="slide-panel-content">
            {/* Panel Header */}
            <div className="profile-panel-header">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    <i className="fa-solid fa-user-circle" style={{ marginRight: '0.4rem' }}></i>
                    Profile
                </span>
                <button onClick={onClose} className="profile-panel-close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i> Loading…
                </div>
            ) : (
                <div className="profile-panel-body">
                    {/* User Card */}
                    <div className="profile-user-card">
                        <div className="profile-avatar">
                            {(profile?.username || trust?.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="profile-name">{profile?.username || trust?.full_name || '—'}</div>
                            <div className="profile-role">{trust?.role || '—'}</div>
                            {profile?.location && (
                                <div className="profile-location">
                                    <i className="fa-solid fa-location-dot" style={{ fontSize: '0.6rem' }}></i>
                                    {profile.location}
                                </div>
                            )}
                        </div>
                        {trust && trust.leaderboard_rank > 0 && (
                            <div className={`profile-rank-badge ${rankLabel(trust.leaderboard_rank).badge}`}>
                                {rankLabel(trust.leaderboard_rank).text}
                            </div>
                        )}
                    </div>

                    {/* Contact Info */}
                    <div className="profile-section">
                        <div className="profile-section-label">
                            <i className="fa-solid fa-address-card" style={{ fontSize: '0.65rem' }}></i> Contact Info
                        </div>
                        <div className="profile-contact-list">
                            {profile?.email && (
                                <div className="profile-contact-row">
                                    <i className="fa-solid fa-envelope" style={{ color: 'var(--text-muted)', width: '18px', fontSize: '0.7rem' }}></i>
                                    <span>{profile.email}</span>
                                </div>
                            )}
                            {profile?.phone && (
                                <div className="profile-contact-row">
                                    <i className="fa-solid fa-phone" style={{ color: 'var(--text-muted)', width: '18px', fontSize: '0.7rem' }}></i>
                                    <span>{profile.phone}</span>
                                </div>
                            )}
                            {trust?.contacts && trust.contacts.map(c => {
                                const meta = CONTACT_META[c.contact_type] || CONTACT_META.website;
                                const href = meta.prefix
                                    ? `${meta.prefix}${c.contact_value.replace(/^[@+]/, '')}`
                                    : c.contact_value;
                                return (
                                    <a key={c.id} href={href} target="_blank" rel="noopener noreferrer" className="profile-contact-row profile-contact-link" style={{ color: meta.color }}>
                                        <i className={meta.icon} style={{ width: '18px', fontSize: '0.8rem' }}></i>
                                        <span>{c.contact_value}</span>
                                    </a>
                                );
                            })}
                            {!profile?.email && !profile?.phone && (!trust?.contacts || trust.contacts.length === 0) && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.3rem 0' }}>No contacts added</div>
                            )}
                        </div>
                    </div>

                    {/* Trust Score */}
                    {trust && (
                        <div className="profile-section">
                            <div className="profile-section-label">
                                <i className="fa-solid fa-shield-halved" style={{ fontSize: '0.65rem' }}></i> Trust Score
                            </div>
                            <div className="profile-trust-row">
                                <div className="profile-score-ring">
                                    <svg viewBox="0 0 120 120" style={{ width: '64px', height: '64px', transform: 'rotate(-90deg)' }}>
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--agro-green)" strokeWidth="8"
                                            strokeLinecap="round" strokeDasharray="314"
                                            strokeDashoffset={dashOffset}
                                            style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                                    </svg>
                                    <span className="profile-score-value">{scoreValue.toFixed(0)}</span>
                                </div>
                                <div className="profile-trust-stats">
                                    <div className="profile-trust-stat">
                                        <span className="pts-val">{trust.total_ratings}</span>
                                        <span className="pts-label">Ratings</span>
                                    </div>
                                    <div className="profile-trust-stat">
                                        <span className="pts-val">{trust.avg_score.toFixed(1)}★</span>
                                        <span className="pts-label">Avg Score</span>
                                    </div>
                                    <div className="profile-trust-stat">
                                        <span className="pts-val">#{trust.leaderboard_rank || '—'}</span>
                                        <span className="pts-label">Rank</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    {trust && trust.documents.length > 0 && (
                        <div className="profile-section">
                            <div className="profile-section-label">
                                <i className="fa-solid fa-file-shield" style={{ fontSize: '0.65rem' }}></i> Verified Documents
                            </div>
                            <div className="profile-docs-list">
                                {trust.documents.map(d => (
                                    <div key={d.id} className="profile-doc-item">
                                        <span className="profile-doc-icon">{DOC_ICONS[d.document_type] || '📄'}</span>
                                        <span className="profile-doc-type">{d.document_type}</span>
                                        {d.is_verified && (
                                            <span className="profile-doc-verified">
                                                <i className="fa-solid fa-circle-check"></i> Verified
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
