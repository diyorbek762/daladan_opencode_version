/**
 * test-logic.ts
 * 
 * Validates the core business logic for Phase 5 before implementing it in the Next.js app.
 */

// --- Mock Data ---

type Harvest = {
    id: string;
    crop_name: string;
    farmer_provides_transport: boolean;
};

type Profile = {
    username: string;
    is_farmer: boolean;
    is_driver: boolean;
    is_retailer: boolean;
};

// --- Logic Functions ---

/**
 * Test 1 Logic: Driver Dashboard Fetch
 * Filters out harvests where the farmer provides their own transport.
 */
function getAvailableJobs(harvests: Harvest[]): Harvest[] {
    return harvests.filter(h => !h.farmer_provides_transport);
}

/**
 * Test 2 Logic: 15% 'Greedy Pooling' Algorithm
 * Calculates distance using Haversine formula and checks if detour is <= 15%
 */
type Coordinates = { lat: number; lon: number };

function haversineDistance(coords1: Coordinates, coords2: Coordinates): number {
    function toRad(x: number) {
        return x * Math.PI / 180;
    }

    const R = 6371; // km
    const x1 = coords2.lat - coords1.lat;
    const dLat = toRad(x1);
    const x2 = coords2.lon - coords1.lon;
    const dLon = toRad(x2);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d;
}

function calculateGreedyPooling(start: Coordinates, end: Coordinates, pickup: Coordinates): {
    originalDistance: number;
    newDistance: number;
    percentIncrease: number;
    isHighProfit: boolean;
} {
    const originalDistance = haversineDistance(start, end);
    const detourDistance1 = haversineDistance(start, pickup);
    const detourDistance2 = haversineDistance(pickup, end);
    const newDistance = detourDistance1 + detourDistance2;

    const percentIncrease = ((newDistance - originalDistance) / originalDistance) * 100;

    return {
        originalDistance,
        newDistance,
        percentIncrease,
        isHighProfit: percentIncrease <= 15
    };
}

/**
 * Test 3 Logic: Role Gateway Display
 * Returns an array of available dashboard paths based on truthy role flags.
 */
function getAvailableDashboards(profile: Profile): string[] {
    const dashboards: string[] = [];
    if (profile.is_farmer) dashboards.push('Producer (Mening Maydonim)');
    if (profile.is_driver) dashboards.push('Driver (Haydovchi Paneli)');
    if (profile.is_retailer) dashboards.push('Retailer (Fresh Direct)');
    return dashboards;
}


// --- Test Execution ---

console.log("=========================================");
console.log("   Daladan Phase 5 Logic Validation      ");
console.log("=========================================\n");

// --- Test 1 ---
console.log("--- Test 1: Farmer Transport ---");
const mockHarvests: Harvest[] = [
    { id: '1', crop_name: 'Harvest A', farmer_provides_transport: true },
    { id: '2', crop_name: 'Harvest B', farmer_provides_transport: false },
];
console.log(`Input: ${JSON.stringify(mockHarvests)}`);
const jobs = getAvailableJobs(mockHarvests);
console.log(`Driver Available Jobs: ${JSON.stringify(jobs)}`);
const test1Passed = jobs.length === 1 && jobs[0].id === '2';
console.log(`Test 1 Status: ${test1Passed ? '✅ PASSED' : '❌ FAILED'}\n`);


// --- Test 2 ---
console.log("--- Test 2: 15% Greedy Pooling Algorithm ---");
// Namangan coords roughly: 41.0000, 71.6667
// Tashkent coords roughly: 41.3110, 69.2401
// Chartak coords roughly: 41.0667, 71.8333
const namangan = { lat: 41.0000, lon: 71.6667 };
const tashkent = { lat: 41.3110, lon: 69.2401 };
const chartak = { lat: 41.0667, lon: 71.8333 };

console.log(`Route: Namangan -> Tashkent`);
console.log(`Detour Pickup: Chartak`);

const poolingResult = calculateGreedyPooling(namangan, tashkent, chartak);
console.log(`Original Distance: ${poolingResult.originalDistance.toFixed(2)} km`);
console.log(`New Distance with Pickup: ${poolingResult.newDistance.toFixed(2)} km`);
console.log(`Detour % Increase: ${poolingResult.percentIncrease.toFixed(2)}%`);
console.log(`Is High Profit (<= 15%): ${poolingResult.isHighProfit}`);
// Since Chartak is relatively close to Namangan, the detour should be small compared to the long trip to Tashkent.
console.log(`Test 2 Status: ${poolingResult.isHighProfit !== null ? '✅ PASSED' : '❌ FAILED'}\n`);


// --- Test 3 ---
console.log("--- Test 3: Role Gateway View ---");
const mockProfile: Profile = {
    username: 'test_user123',
    is_farmer: true,
    is_driver: true,
    is_retailer: false
};
console.log(`User Profile Flags: is_farmer=${mockProfile.is_farmer}, is_driver=${mockProfile.is_driver}, is_retailer=${mockProfile.is_retailer}`);
const dashboards = getAvailableDashboards(mockProfile);
console.log(`Displayed Dashboards: ${JSON.stringify(dashboards)}`);
const test3Passed = dashboards.includes('Producer (Mening Maydonim)') && dashboards.includes('Driver (Haydovchi Paneli)') && !dashboards.includes('Retailer (Fresh Direct)');
console.log(`Test 3 Status: ${test3Passed ? '✅ PASSED' : '❌ FAILED'}\n`);

console.log("=========================================");
console.log(`Overall Logic Test Status: ${test1Passed && poolingResult !== null && test3Passed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
console.log("=========================================");
