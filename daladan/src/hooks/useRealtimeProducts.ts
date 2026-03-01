import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type RealtimeProduct = {
    id: string;
    crop_name: string;
    quantity: number;
    price_per_kg: number | null;
    image_url: string | null;
    region: string;
    farmer_provides_transport: boolean;
    created_at: string;
    user_id: string;
    seller_name?: string;
};

/**
 * Real-time hook for products (harvests).
 * - Fetches initial data on mount
 * - Subscribes to INSERT events via Supabase Realtime
 * - Auto-appends new products without page refresh
 * @param userId Optional: filter to only this user's products (for producer view)
 */
export function useRealtimeProducts(userId?: string) {
    const [products, setProducts] = useState<RealtimeProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Initial fetch
        const fetchProducts = async () => {
            let query = supabase
                .from('harvests')
                .select('id, crop_name, quantity, price_per_kg, image_url, region, farmer_provides_transport, created_at, user_id')
                .order('created_at', { ascending: false });

            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query;
            if (error) console.error('Products fetch error:', error);
            if (data) setProducts(data as RealtimeProduct[]);
            setLoading(false);
        };

        fetchProducts();

        // 2. Realtime subscription
        const channelName = userId ? `products-${userId}` : 'products-all';
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'harvests',
                    ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
                },
                (payload) => {
                    const newProduct = payload.new as RealtimeProduct;
                    setProducts(prev => {
                        // Deduplicate — skip if already known
                        if (prev.some(p => p.id === newProduct.id)) return prev;
                        return [newProduct, ...prev];
                    });
                }
            )
            .subscribe();

        // 3. Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return { products, loading };
}
