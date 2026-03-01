'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';

type DbMessage = {
    id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    created_at: string;
};

type Contact = {
    id: string;
    username: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    lastMessage: string;
    lastTime: string;
    unread: number;
};

export default function ChatView() {
    const t = useTranslations('Chat');
    const [userId, setUserId] = useState<string | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [activeContact, setActiveContact] = useState<Contact | null>(null);
    const [messages, setMessages] = useState<DbMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [showContactInfo, setShowContactInfo] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Init user session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setUserId(session.user.id);
        });
    }, []);

    // Fetch contacts (users who have messaged us or we've messaged)
    useEffect(() => {
        if (!userId) return;

        const fetchContacts = async () => {
            // Get all messages involving this user
            const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (!msgs || msgs.length === 0) {
                setContacts([]);
                return;
            }

            // Extract unique contact IDs
            const contactIds = new Set<string>();
            msgs.forEach((m: any) => {
                if (m.sender_id !== userId) contactIds.add(m.sender_id);
                if (m.recipient_id !== userId) contactIds.add(m.recipient_id);
            });

            if (contactIds.size === 0) {
                setContacts([]);
                return;
            }

            // Fetch profiles for these contacts
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, email, phone, location')
                .in('id', Array.from(contactIds));

            const profileMap = new Map<string, any>();
            profiles?.forEach((p: any) => profileMap.set(p.id, p));

            // Build contact list with last message
            const contactList: Contact[] = Array.from(contactIds).map(cid => {
                const profile = profileMap.get(cid);
                const contactMsgs = msgs.filter((m: any) =>
                    (m.sender_id === cid && m.recipient_id === userId) ||
                    (m.sender_id === userId && m.recipient_id === cid)
                );
                const lastMsg = contactMsgs[0];
                const unread = contactMsgs.filter((m: any) =>
                    m.sender_id === cid && m.recipient_id === userId
                ).length;

                return {
                    id: cid,
                    username: profile?.username || 'Foydalanuvchi',
                    email: profile?.email || null,
                    phone: profile?.phone || null,
                    location: profile?.location || null,
                    lastMessage: lastMsg?.content?.substring(0, 60) + (lastMsg?.content?.length > 60 ? '...' : '') || '',
                    lastTime: lastMsg ? getRelativeTime(lastMsg.created_at) : '',
                    unread,
                };
            });

            contactList.sort((a, b) => b.unread - a.unread);
            setContacts(contactList);
            if (!activeContact && contactList.length > 0) {
                setActiveContact(contactList[0]);
            }
        };

        fetchContacts();

        // Realtime: listen for new messages
        const channel = supabase
            .channel('chat-messages-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, (payload) => {
                const msg = payload.new as DbMessage;
                if (msg.sender_id === userId || msg.recipient_id === userId) {
                    fetchContacts();
                    if (activeContact && (msg.sender_id === activeContact.id || msg.recipient_id === activeContact.id)) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                    }
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    // Fetch messages for active contact
    useEffect(() => {
        if (!userId || !activeContact) return;

        const fetchConversation = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .or(
                    `and(sender_id.eq.${userId},recipient_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},recipient_id.eq.${userId})`
                )
                .order('created_at', { ascending: true });
            if (data) setMessages(data as DbMessage[]);
        };

        fetchConversation();
    }, [userId, activeContact]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !userId || !activeContact) return;

        await supabase.from('messages').insert({
            sender_id: userId,
            recipient_id: activeContact.id,
            content: newMessage.trim(),
        });

        setNewMessage('');
    };

    const getRelativeTime = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'hozirgina';
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} soat`;
        const days = Math.floor(hrs / 24);
        return `${days} kun`;
    };

    return (
        <div className="msg-layout">
            {/* Contacts Sidebar */}
            <div className="deal-groups-panel">
                <div className="deal-groups-header">
                    <span><i className="fa-solid fa-comments" style={{ marginRight: '0.4rem', color: 'var(--agro-green)' }}></i>{t('chats') || 'Suhbatlar'}</span>
                    <span className="dg-count">{contacts.length}</span>
                </div>
                <div className="deal-groups-list">
                    {contacts.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                            <i className="fa-solid fa-inbox" style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block', opacity: 0.4 }}></i>
                            {t('noChats') || 'Hozircha xabarlar yo\'q'}
                        </div>
                    ) : (
                        contacts.map(contact => (
                            <div
                                key={contact.id}
                                className={`deal-group-item ${activeContact?.id === contact.id ? 'active' : ''}`}
                                onClick={() => { setActiveContact(contact); setShowContactInfo(false); }}
                            >
                                <div className="dg-avatar" style={{ background: '#ECFDF5', color: '#059669' }}>
                                    {contact.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="dg-info">
                                    <div className="dg-name">{contact.username}</div>
                                    <div className="dg-preview">{contact.lastMessage}</div>
                                </div>
                                <div className="dg-meta">
                                    <div className="dg-time">{contact.lastTime}</div>
                                    {contact.unread > 0 && <div className="dg-unread">{contact.unread}</div>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Panel */}
            <div className="chat-panel">
                {activeContact ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-header-left">
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{activeContact.username}</h3>
                                <div className="chat-members" style={{ cursor: 'pointer' }} onClick={() => setShowContactInfo(!showContactInfo)}>
                                    <i className="fa-solid fa-circle-info" style={{ fontSize: '0.6rem', marginRight: '0.25rem' }}></i>
                                    {t('contactInfo') || 'Kontakt ma\'lumotlari'}
                                </div>
                            </div>
                        </div>

                        {/* Contact Info Dropdown */}
                        {showContactInfo && (
                            <div style={{
                                background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)', border: '1px solid #BBF7D0',
                                borderRadius: '12px', padding: '0.85rem 1rem', margin: '0 0.75rem 0.5rem',
                                animation: 'viewFadeIn 0.3s ease-out',
                            }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    <i className="fa-solid fa-address-card" style={{ marginRight: '0.3rem' }}></i> {t('contactDetails') || 'Kontakt tafsilotlari'}
                                </div>
                                <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.82rem' }}>
                                    <div><i className="fa-solid fa-user" style={{ width: '18px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}></i> {activeContact.username}</div>
                                    <div><i className="fa-solid fa-envelope" style={{ width: '18px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}></i> {activeContact.email || '—'}</div>
                                    <div><i className="fa-solid fa-phone" style={{ width: '18px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}></i> {activeContact.phone || '—'}</div>
                                    <div><i className="fa-solid fa-location-dot" style={{ width: '18px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}></i> {activeContact.location || '—'}</div>
                                </div>
                            </div>
                        )}

                        <div className="chat-body">
                            {messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem', fontSize: '0.85rem' }}>
                                    <i className="fa-solid fa-comments" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block', opacity: 0.3 }}></i>
                                    {t('startConversation') || 'Suhbatni boshlang!'}
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isMe = msg.sender_id === userId;
                                    return (
                                        <div className={`chat-bubble ${isMe ? 'seller' : 'buyer'}`} key={msg.id}>
                                            <div className="cb-sender">{isMe ? `🌱 ${t('you') || 'Siz'}` : `📨 ${activeContact.username}`}</div>
                                            <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
                                            <div className="cb-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="chat-input-bar" onSubmit={handleSend}>
                            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={t('writeMessage') || "Xabar yozing…"} />
                            <button type="submit" className="chat-send-btn" disabled={!newMessage.trim()}>
                                <i className="fa-solid fa-paper-plane"></i>
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: '0.85rem', flexDirection: 'column', gap: '0.5rem' }}>
                        <i className="fa-solid fa-comments" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                        {t('selectChat') || 'Suhbatni tanlang'}
                    </div>
                )}
            </div>
        </div>
    );
}
