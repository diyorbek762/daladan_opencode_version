import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type RealtimeNeed = {
    id: string;
    user_id: string;
    product_name: string;
    category: string;
    quantity: number;
    price_per_kg: number | null;
    deadline: string | null;
    urgency: 'high' | 'medium' | 'low';
    delivery_notes: string | null;
    region: string;
    status: string;
    created_at: string;
    profiles?: { username: string } | null;
};

/**
 * Real-time hook for retailer needs.
 * - Fetches initial open needs on mount
 * - Subscribes to INSERT events via Supabase Realtime
 * - Auto-appends new needs without page refresh
 */
export function useRealtimeNeeds() {
    const [needs, setNeeds] = useState<RealtimeNeed[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Initial fetch — only open needs
        const fetchNeeds = async () => {
            const { data, error } = await supabase
                .from('needs')
                .select('*')
                .eq('status', 'open')
                .order('created_at', { ascending: false });
            if (error) console.error('Needs fetch error:', error);
            if (data) setNeeds(data as RealtimeNeed[]);
            setLoading(false);
        };

        fetchNeeds();

        // 2. Realtime subscription
        const channel = supabase
            .channel('needs-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'needs',
                },
                (payload) => {
                    const newNeed = payload.new as RealtimeNeed;
                    setNeeds(prev => {
                        if (prev.some(n => n.id === newNeed.id)) return prev;
                        return [newNeed, ...prev];
                    });
                }
            )
            .subscribe();

        // 3. Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return { needs, loading };
}
