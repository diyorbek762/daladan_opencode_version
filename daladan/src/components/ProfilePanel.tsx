'use client';

import { useEffect, useState, useRef } from 'react';
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

const CONTACT_TYPES = [
    { key: 'telegram', icon: 'fa-brands fa-telegram', color: '#38BDF8', placeholder: '@username' },
    { key: 'whatsapp', icon: 'fa-brands fa-whatsapp', color: '#4ADE80', placeholder: '+998901234567' },
    { key: 'phone', icon: 'fa-solid fa-phone', color: '#818CF8', placeholder: '+998901234567' },
    { key: 'website', icon: 'fa-solid fa-globe', color: '#C084FC', placeholder: 'https://example.com' },
];

const CONTACT_META: Record<string, { icon: string; color: string; prefix: string }> = {
    telegram: { icon: 'fa-brands fa-telegram', color: '#38BDF8', prefix: 'https://t.me/' },
    whatsapp: { icon: 'fa-brands fa-whatsapp', color: '#4ADE80', prefix: 'https://wa.me/' },
    phone: { icon: 'fa-solid fa-phone', color: '#818CF8', prefix: 'tel:' },
    website: { icon: 'fa-solid fa-globe', color: '#C084FC', prefix: '' },
};

const DOC_TYPES = [
    { key: 'certificate', label: 'Certificate', icon: '📜' },
    { key: 'license', label: 'License', icon: '🪪' },
    { key: 'passport', label: 'Passport', icon: '🛂' },
];

const DOC_ICONS: Record<string, string> = {
    license: '🪪', certificate: '📜', passport: '🛂',
};

export default function ProfilePanel({ onClose }: { onClose: () => void }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [profile, setProfile] = useState<SupabaseProfile | null>(null);
    const [trust, setTrust] = useState<TrustProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    // ── Contact editing state ──
    const [editingContacts, setEditingContacts] = useState(false);
    const [contactValues, setContactValues] = useState<Record<string, string>>({});
    const [savingContacts, setSavingContacts] = useState(false);

    // ── Document upload state ──
    const [showUpload, setShowUpload] = useState(false);
    const [uploadDocType, setUploadDocType] = useState('certificate');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setUserId(session.user.id);
        });
    }, []);

    const loadData = async () => {
        if (!userId) return;
        setLoading(true);

        const { data: profileData } = await supabase
            .from('profiles')
            .select('username, email, phone, location')
            .eq('id', userId)
            .single();
        if (profileData) setProfile(profileData);

        try {
            const resp = await fetch(`/api/trust/users/${userId}/trust-profile`);
            if (resp.ok) {
                const data = await resp.json();
                setTrust(data);
                // Populate contact values for editing
                const vals: Record<string, string> = {};
                data.contacts?.forEach((c: any) => { vals[c.contact_type] = c.contact_value; });
                setContactValues(vals);
            }
        } catch (e) {
            console.warn('Trust profile fetch failed:', e);
        }

        setLoading(false);
    };

    useEffect(() => { loadData(); }, [userId]);

    // ── Save contacts ──
    const handleSaveContacts = async () => {
        if (!userId) return;
        setSavingContacts(true);
        const token = localStorage.getItem('daladan_token') || '';

        let saved = 0;
        for (const ct of CONTACT_TYPES) {
            const val = contactValues[ct.key]?.trim();
            if (val) {
                try {
                    const resp = await fetch(`/api/trust/users/${userId}/contacts`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ contact_type: ct.key, contact_value: val, is_public: true }),
                    });
                    if (resp.ok) saved++;
                } catch (e) { console.warn(`Failed to save ${ct.key}:`, e); }
            }
        }

        setSavingContacts(false);
        setEditingContacts(false);
        showToast(`✅ ${saved} contact${saved !== 1 ? 's' : ''} saved!`);
        await loadData();
    };

    // ── Upload document ──
    const handleUploadDoc = async () => {
        if (!userId || !uploadFile) return;
        setUploading(true);
        const token = localStorage.getItem('daladan_token') || '';

        // Convert file to base64 data URL for storage
        const reader = new FileReader();
        reader.onloadend = async () => {
            const fileUrl = reader.result as string;
            try {
                const resp = await fetch(`/api/trust/users/${userId}/documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ file_url: fileUrl.substring(0, 500), document_type: uploadDocType }),
                });
                if (resp.ok) {
                    showToast('✅ Document uploaded successfully!');
                    setShowUpload(false);
                    setUploadFile(null);
                    await loadData();
                } else {
                    const err = await resp.json().catch(() => ({}));
                    showToast(`❌ ${err.detail || 'Upload failed'}`);
                }
            } catch (e) {
                showToast('❌ Upload failed');
            }
            setUploading(false);
        };
        reader.readAsDataURL(uploadFile);
    };

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

                    {/* ═══ CONTACTS (Editable) ═══ */}
                    <div className="profile-section">
                        <div className="profile-section-label">
                            <i className="fa-solid fa-address-card" style={{ fontSize: '0.65rem' }}></i> Contacts
                            <button onClick={() => setEditingContacts(!editingContacts)}
                                style={{
                                    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'inherit',
                                    color: editingContacts ? '#EF4444' : 'var(--agro-green)'
                                }}>
                                <i className={`fa-solid ${editingContacts ? 'fa-xmark' : 'fa-pen'}`} style={{ marginRight: '0.2rem' }}></i>
                                {editingContacts ? 'Cancel' : 'Edit'}
                            </button>
                        </div>

                        {editingContacts ? (
                            /* ── Edit Mode ── */
                            <div style={{ padding: '0.75rem 0.85rem' }}>
                                {CONTACT_TYPES.map(ct => (
                                    <div key={ct.key} className="profile-edit-row">
                                        <i className={ct.icon} style={{ color: ct.color, width: '20px', fontSize: '0.85rem', flexShrink: 0 }}></i>
                                        <input
                                            type="text"
                                            className="profile-edit-input"
                                            placeholder={ct.placeholder}
                                            value={contactValues[ct.key] || ''}
                                            onChange={e => setContactValues({ ...contactValues, [ct.key]: e.target.value })}
                                        />
                                    </div>
                                ))}
                                <button
                                    onClick={handleSaveContacts}
                                    disabled={savingContacts}
                                    className="profile-save-btn"
                                >
                                    {savingContacts ? (
                                        <><i className="fa-solid fa-spinner fa-spin"></i> Saving…</>
                                    ) : (
                                        <><i className="fa-solid fa-check"></i> Save Contacts</>
                                    )}
                                </button>
                            </div>
                        ) : (
                            /* ── View Mode ── */
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
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0', textAlign: 'center' }}>
                                        No contacts yet — tap <i className="fa-solid fa-pen" style={{ fontSize: '0.65rem' }}></i> Edit to add
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ═══ TRUST SCORE ═══ */}
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

                    {/* ═══ DOCUMENTS (with Upload) ═══ */}
                    <div className="profile-section">
                        <div className="profile-section-label">
                            <i className="fa-solid fa-file-shield" style={{ fontSize: '0.65rem' }}></i> Documents
                            <button onClick={() => setShowUpload(!showUpload)}
                                style={{
                                    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'inherit',
                                    color: showUpload ? '#EF4444' : 'var(--agro-green)'
                                }}>
                                <i className={`fa-solid ${showUpload ? 'fa-xmark' : 'fa-plus'}`} style={{ marginRight: '0.2rem' }}></i>
                                {showUpload ? 'Cancel' : 'Upload'}
                            </button>
                        </div>

                        {/* Upload Form */}
                        {showUpload && (
                            <div className="profile-upload-form">
                                {/* Document Type */}
                                <div className="profile-upload-types">
                                    {DOC_TYPES.map(dt => (
                                        <button key={dt.key}
                                            className={`profile-upload-type-btn ${uploadDocType === dt.key ? 'active' : ''}`}
                                            onClick={() => setUploadDocType(dt.key)}
                                        >
                                            <span>{dt.icon}</span>
                                            <span>{dt.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* File Picker */}
                                <div
                                    className="profile-file-dropzone"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploadFile ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <i className="fa-solid fa-file-circle-check" style={{ color: 'var(--agro-green)', fontSize: '1.2rem' }}></i>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadFile.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(uploadFile.size / 1024).toFixed(0)} KB</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center' }}>
                                            <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.5rem', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block' }}></i>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Tap to select file</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>PDF, JPG, PNG — max 5MB</div>
                                        </div>
                                    )}
                                </div>
                                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} />

                                {/* Upload Button */}
                                <button
                                    onClick={handleUploadDoc}
                                    disabled={!uploadFile || uploading}
                                    className="profile-save-btn"
                                >
                                    {uploading ? (
                                        <><i className="fa-solid fa-spinner fa-spin"></i> Uploading…</>
                                    ) : (
                                        <><i className="fa-solid fa-cloud-arrow-up"></i> Upload Document</>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Existing Documents List */}
                        <div className="profile-docs-list">
                            {trust && trust.documents.length > 0 ? (
                                trust.documents.map(d => (
                                    <div key={d.id} className="profile-doc-item">
                                        <span className="profile-doc-icon">{DOC_ICONS[d.document_type] || '📄'}</span>
                                        <span className="profile-doc-type">{d.document_type}</span>
                                        <span className={`profile-doc-status ${d.is_verified ? 'verified' : 'pending'}`}>
                                            <i className={`fa-solid ${d.is_verified ? 'fa-circle-check' : 'fa-clock'}`}></i>
                                            {d.is_verified ? 'Verified' : 'Pending'}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                !showUpload && (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0', textAlign: 'center' }}>
                                        No documents yet — tap <i className="fa-solid fa-plus" style={{ fontSize: '0.65rem' }}></i> Upload to add
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                    background: '#1F2937', color: '#fff', padding: '0.75rem 1.25rem',
                    borderRadius: '10px', fontSize: '0.82rem', fontWeight: 500,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 10000,
                    animation: 'viewFadeIn 0.3s ease-out',
                }}>
                    {toast}
                </div>
            )}
        </div>
    );
}
