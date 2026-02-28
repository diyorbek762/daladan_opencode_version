'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';

type Message = {
    id: string;
    sender_id: string;
    recipient_id: string;
    content: string;
    created_at: string;
    sender_profile?: { username: string };
};

export default function ChatView() {
    const t = useTranslations('Chat');
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [recipientUsername, setRecipientUsername] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function initUser() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
                fetchMessages(session.user.id);
            }
        }
        initUser();

        // Subscribe to new incoming messages
        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    // If message belongs to this conversation (sent or received by us)
                    // we re-fetch to get joined profile data easily, or manually construct it
                    const msg = payload.new as Message;
                    if (msg.recipient_id === userId || msg.sender_id === userId) {
                        fetchMessages(userId);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const fetchMessages = async (currentUserId: string | null) => {
        if (!currentUserId) return;
        const { data, error } = await supabase
            .from('messages')
            .select(`
        id,
        sender_id,
        content,
        created_at,
        sender_profile:profiles!sender_id(username)
      `)
            .or(`recipient_id.eq.${currentUserId},sender_id.eq.${currentUserId}`)
            .order('created_at', { ascending: true })
            .limit(50);

        if (data) {
            setMessages(data as unknown as Message[]);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !userId || !recipientUsername.trim()) return;

        // First find recipient ID
        const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', recipientUsername)
            .single();

        if (!profileData) {
            alert("User not found!");
            return;
        }

        const { error } = await supabase
            .from('messages')
            .insert([
                {
                    sender_id: userId,
                    recipient_id: profileData.id,
                    content: newMessage,
                }
            ]);

        if (!error) {
            setNewMessage('');
        }
    };

    return (
        <div className="flex flex-col h-[500px] max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 border-b p-4 flex items-center justify-between z-10">
                <h3 className="font-bold text-gray-800">{t('title')}</h3>
                <input
                    type="text"
                    placeholder="To (Username)"
                    value={recipientUsername}
                    onChange={(e) => setRecipientUsername(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1 w-32 focus:ring-1 focus:ring-agro-green outline-none"
                />
            </div>

            {/* Messages Window */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg) => {
                    const isMe = msg.sender_id === userId;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe
                                    ? 'bg-gradient-to-r from-agro-green to-agro-green-lighter text-white rounded-br-none'
                                    : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'
                                    }`}
                            >
                                {!isMe && (
                                    <p className="text-xs text-gray-500 font-semibold mb-1">
                                        {msg.sender_profile?.username}
                                    </p>
                                )}
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${isMe ? 'text-green-100 text-right' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t p-3">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t('typeMessage')}
                        className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-agro-green focus:ring-1 focus:ring-agro-green"
                    />
                    <button
                        type="submit"
                        className="p-2 rounded-full bg-agro-green text-white hover:bg-agro-green-light transition-colors"
                        disabled={!newMessage.trim()}
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
