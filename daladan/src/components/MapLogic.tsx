'use client';

import { useEffect, useRef } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    GeoJSON,
    Polyline,
    CircleMarker,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { NearestOrder, PredictedRoute } from '@/hooks/useDriverTracking';

// Fix default Leaflet marker icon paths (required in Next.js)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ── Custom driver icon (pulsing blue dot) ──
const driverIcon = L.divIcon({
    className: 'driver-live-icon',
    html: `<div style="
        width: 18px; height: 18px;
        background: #2563EB;
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(37,99,235,0.3), 0 2px 8px rgba(0,0,0,0.3);
        animation: driverPulse 2s ease-in-out infinite;
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

// ── Custom order pickup icon ──
const orderIcon = L.divIcon({
    className: 'order-pickup-icon',
    html: `<div style="
        width: 14px; height: 14px;
        background: #F59E0B;
        border: 2.5px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 3px rgba(245,158,11,0.3), 0 2px 6px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

// ── Base route ──
const startBase = { lat: 41.0000, lon: 71.6667, name: 'Namangan' };
const endBase = { lat: 41.3110, lon: 69.2401, name: 'Toshkent' };

// ── Haversine distance (km) ──
function haversineDist(
    coords1: { lat: number; lon: number },
    coords2: { lat: number; lon: number }
): number {
    const toR = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toR(coords2.lat - coords1.lat);
    const dLon = toR(coords2.lon - coords1.lon);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toR(coords1.lat)) *
        Math.cos(toR(coords2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Greedy pooling ──
function calculateGreedyPooling(pickup: { lat: number; lon: number }) {
    const originalDist = haversineDist(startBase, endBase);
    const detourDist =
        haversineDist(startBase, pickup) + haversineDist(pickup, endBase);
    const percentInc = ((detourDist - originalDist) / originalDist) * 100;
    return { detourPercent: percentInc, isHighProfit: percentInc <= 15 };
}

// ── Deterministic seeded offset for stable job markers ──
function seededOffset(id: string, index: number): number {
    let hash = 0;
    const seed = `${id}_${index}`;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
    }
    return ((hash >>> 0) / 0xffffffff) * 0.5 - 0.25;
}

// ═══════════════════════════════════════════════════════
//  Auto-pan to driver position
// ═══════════════════════════════════════════════════════
function FlyToDriver({ position }: { position: { lat: number; lng: number } | null }) {
    const map = useMap();
    const hasFlown = useRef(false);

    useEffect(() => {
        if (position && !hasFlown.current) {
            map.flyTo([position.lat, position.lng], 12, { duration: 1.5 });
            hasFlown.current = true;
        }
    }, [position, map]);

    return null;
}

// ═══════════════════════════════════════════════════════
//  Props
// ═══════════════════════════════════════════════════════
interface MapLogicProps {
    jobs: any[];
    driverPosition?: { lat: number; lng: number } | null;
    nearestOrders?: NearestOrder[];
    routeGeoJSON?: GeoJSON.FeatureCollection | null;
    isTracking?: boolean;
    predictedRoute?: PredictedRoute | null;
    predictLoading?: boolean;
    onFindLoads?: () => void;
}

// ═══════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════
export default function MapLogic({
    jobs,
    driverPosition = null,
    nearestOrders = [],
    routeGeoJSON = null,
    isTracking = false,
    predictedRoute = null,
    predictLoading = false,
    onFindLoads,
}: MapLogicProps) {
    const center: [number, number] = [41.0, 71.6667]; // Namangan
    const geoJsonKeyRef = useRef(0);

    // Force re-render of GeoJSON layer when data changes
    useEffect(() => {
        geoJsonKeyRef.current += 1;
    }, [routeGeoJSON]);

    return (
        <div className="w-full h-[420px] rounded-lg overflow-hidden border border-gray-300 shadow-inner z-0 relative">
            {/* ── Top-right overlays ── */}
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {/* LIVE badge */}
                {isTracking && (
                    <div style={{ background: 'rgba(5,150,105,0.9)', color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)' }}>
                        <span style={{ width: 7, height: 7, background: '#34D399', borderRadius: '50%', animation: 'driverPulse 1.5s ease-in-out infinite' }} />
                        LIVE
                    </div>
                )}

                {/* Find Loads button */}
                {onFindLoads && (
                    <button
                        onClick={onFindLoads}
                        disabled={predictLoading}
                        style={{
                            background: predictLoading ? '#9CA3AF' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                            color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10,
                            fontSize: '0.82rem', fontWeight: 700, cursor: predictLoading ? 'wait' : 'pointer',
                            boxShadow: '0 3px 12px rgba(217,119,6,0.4)', display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'transform 0.15s', ...(predictLoading ? {} : {}),
                        }}
                    >
                        {predictLoading ? (
                            <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Qidirilmoqda...</>
                        ) : (
                            <>🔍 Yuk Topish</>
                        )}
                    </button>
                )}
            </div>

            {/* ── Predicted route stats panel (bottom-left) ── */}
            {predictedRoute && predictedRoute.stops.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
                    background: 'rgba(255,255,255,0.95)', borderRadius: 12,
                    padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    backdropFilter: 'blur(8px)', maxWidth: 260,
                }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F2937', marginBottom: 6, borderBottom: '1px solid #E5E7EB', paddingBottom: 4 }}>
                        🗺️ Eng arzon marshrut
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#2563EB' }}>{predictedRoute.total_km}</div>
                            <div style={{ fontSize: '0.65rem', color: '#6B7280' }}>km</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#059669' }}>{predictedRoute.duration_min}</div>
                            <div style={{ fontSize: '0.65rem', color: '#6B7280' }}>daqiqa</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#D97706' }}>{predictedRoute.stops.length}</div>
                            <div style={{ fontSize: '0.65rem', color: '#6B7280' }}>to&apos;xtash</div>
                        </div>
                    </div>
                    {predictedRoute.stops.map((s, i) => (
                        <div key={s.deal_id} style={{ fontSize: '0.73rem', color: '#374151', paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, color: '#F59E0B' }}>{i + 1}.</span>
                            {s.title}
                            <span style={{ color: '#9CA3AF', marginLeft: 'auto' }}>{s.distance_from_prev_km} km</span>
                        </div>
                    ))}
                </div>
            )}

            <MapContainer
                center={center}
                zoom={7}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Auto-pan to driver on first fix */}
                <FlyToDriver position={driverPosition} />

                {/* ── Live driver marker ── */}
                {driverPosition && (
                    <Marker
                        position={[driverPosition.lat, driverPosition.lng]}
                        icon={driverIcon}
                    >
                        <Popup>
                            <div className="font-sans">
                                <p className="font-bold text-blue-700">📍 Sizning joylashuvingiz</p>
                                <p className="text-xs text-gray-500">
                                    {driverPosition.lat.toFixed(4)}, {driverPosition.lng.toFixed(4)}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* ── Nearest-order pickup markers ── */}
                {nearestOrders.map((order) => (
                    <Marker
                        key={order.deal_id}
                        position={[order.pickup_lat, order.pickup_lng]}
                        icon={orderIcon}
                    >
                        <Popup>
                            <div className="font-sans min-w-[140px]">
                                <h4 className="font-bold text-amber-700 border-b pb-1 mb-1">
                                    📦 #{order.deal_number} — {order.title}
                                </h4>
                                <p className="text-sm text-gray-600 m-0">
                                    {order.distance_km} km uzoqlikda
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* ── GeoJSON route line (driver → pickups) ── */}
                {routeGeoJSON && (
                    <GeoJSON
                        key={`route-${geoJsonKeyRef.current}`}
                        data={routeGeoJSON}
                        style={(feature) => {
                            if (feature?.geometry.type === 'LineString') {
                                return {
                                    color: '#2563EB',
                                    weight: 4,
                                    opacity: 0.8,
                                    dashArray: '8, 6',
                                };
                            }
                            return {};
                        }}
                        pointToLayer={(_feature, latlng) => {
                            return L.circleMarker(latlng, {
                                radius: 6,
                                fillColor: '#F59E0B',
                                color: '#fff',
                                weight: 2,
                                fillOpacity: 0.9,
                            });
                        }}
                    />
                )}

                {/* ── Static base route markers ── */}
                <Marker position={[startBase.lat, startBase.lon]}>
                    <Popup>
                        <div className="font-sans">
                            <p className="font-bold">🚚 {startBase.name}</p>
                            <p className="text-xs text-gray-500">Baza boshlanish nuqtasi</p>
                        </div>
                    </Popup>
                </Marker>

                <Marker position={[endBase.lat, endBase.lon]}>
                    <Popup>
                        <div className="font-sans">
                            <p className="font-bold">🏢 {endBase.name}</p>
                            <p className="text-xs text-gray-500">Baza yetkazib berish manzili</p>
                        </div>
                    </Popup>
                </Marker>

                {/* ── Static job markers with pooling analysis ── */}
                {jobs.map((job) => {
                    const lat = 41.0 + seededOffset(job.id, 0);
                    const lon = 71.6 + seededOffset(job.id, 1);
                    const pooling = calculateGreedyPooling({ lat, lon });

                    return (
                        <Marker key={job.id} position={[lat, lon]}>
                            <Popup>
                                <div className="font-sans min-w-[160px]">
                                    <h4 className="font-bold text-gray-900 border-b pb-1 mb-2">
                                        {job.crop_name}
                                    </h4>
                                    <p className="text-sm text-gray-700 m-0 p-0">
                                        👤 {job.profiles?.username || '—'}
                                    </p>
                                    <p className="text-sm text-gray-700 m-0 p-0">
                                        📦 {job.quantity} kg
                                    </p>
                                    <div className="mt-2 text-xs">
                                        <p className="text-gray-500 m-0 p-0">
                                            Chetlanish: +{pooling.detourPercent.toFixed(1)}%
                                        </p>
                                        {pooling.isHighProfit ? (
                                            <span className="inline-block mt-1 bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">
                                                🟢 Yuqori Daromad (&lt;15%)
                                            </span>
                                        ) : (
                                            <span className="inline-block mt-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">
                                                🟡 Standart
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* CSS for the driver pulse animation */}
            <style jsx global>{`
                @keyframes driverPulse {
                    0%, 100% { box-shadow: 0 0 0 4px rgba(37,99,235,0.3), 0 2px 8px rgba(0,0,0,0.3); }
                    50% { box-shadow: 0 0 0 8px rgba(37,99,235,0.1), 0 2px 8px rgba(0,0,0,0.3); }
                }
            `}</style>
        </div>
    );
}
