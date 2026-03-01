import type { RealtimeProduct } from '@/hooks/useRealtimeProducts';
import type { RealtimeNeed } from '@/hooks/useRealtimeNeeds';

export type Match = {
    need: RealtimeNeed;
    score: number;
    reasons: string[];
};

/**
 * Scores how well a product matches a need.
 * Returns matches sorted by score (highest first).
 *
 * Scoring:
 *  - Region match: +40 points
 *  - Name/keyword overlap: +30 points
 *  - Price compatibility (product ≤ need target): +20 points
 *  - Quantity availability (product ≥ need): +10 points
 */
export function matchProductToNeeds(
    product: RealtimeProduct,
    needs: RealtimeNeed[]
): Match[] {
    const matches: Match[] = [];

    for (const need of needs) {
        if (need.status !== 'open') continue;

        let score = 0;
        const reasons: string[] = [];

        // 1. Region match (exact)
        if (product.region && need.region &&
            product.region.toLowerCase() === need.region.toLowerCase()) {
            score += 40;
            reasons.push(`📍 ${product.region}`);
        }

        // 2. Name/keyword overlap
        const productWords = product.crop_name.toLowerCase().split(/\s+/);
        const needWords = need.product_name.toLowerCase().split(/\s+/);
        const commonWords = productWords.filter(w => needWords.some(nw =>
            nw.includes(w) || w.includes(nw)
        ));
        if (commonWords.length > 0) {
            score += 30;
            reasons.push(`🏷️ "${commonWords.join(', ')}"`);
        }

        // 3. Price compatibility
        if (product.price_per_kg && need.price_per_kg) {
            if (product.price_per_kg <= need.price_per_kg) {
                score += 20;
                reasons.push(`💲 $${product.price_per_kg} ≤ $${need.price_per_kg}`);
            }
        }

        // 4. Quantity availability
        if (product.quantity >= need.quantity) {
            score += 10;
            reasons.push(`📦 ${product.quantity} ≥ ${need.quantity} kg`);
        }

        // Only return if there's some meaningful match (score > 20)
        if (score > 20) {
            matches.push({ need, score, reasons });
        }
    }

    return matches.sort((a, b) => b.score - a.score);
}
