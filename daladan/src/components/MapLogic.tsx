'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Setup default marker icons for Leaflet (prevent standard Next.js path issues)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Mock Route: Namangan (start) -> Tashkent (destination)
const startBase = { lat: 41.0000, lon: 71.6667, name: "Namangan (Start)" };
const endBase = { lat: 41.3110, lon: 69.2401, name: "Tashkent (Dest)" };

// --- Haversine logic ---
function haversineDist(coords1: { lat: number, lon: number }, coords2: { lat: number, lon: number }) {
    const toR = (x: number) => x * Math.PI / 180;
    const R = 6371;
    const dLat = toR(coords2.lat - coords1.lat);
    const dLon = toR(coords2.lon - coords1.lon);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toR(coords1.lat)) * Math.cos(toR(coords2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateGreedyPooling(pickup: { lat: number, lon: number }) {
    const original = haversineDist(startBase, endBase);
    const newDist = haversineDist(startBase, pickup) + haversineDist(pickup, endBase);
    const percentInc = ((newDist - original) / original) * 100;
    return {
        detourPercent: percentInc,
        isHighProfit: percentInc <= 15
    };
}

export default function MapLogic({ jobs }: { jobs: any[] }) {
    // Center roughly in the Fergana Valley / Tashkent area
    const position: [number, number] = [41.15, 70.45];

    return (
        <div className="w-full h-[400px] rounded-lg overflow-hidden border border-gray-300 shadow-inner z-0 relative">
            <MapContainer center={position} zoom={7} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Base Route Markers */}
                <Marker position={[startBase.lat, startBase.lon]}>
                    <Popup>🚚 Base Start: {startBase.name}</Popup>
                </Marker>
                <Marker position={[endBase.lat, endBase.lon]}>
                    <Popup>🏢 Base Destination: {endBase.name}</Popup>
                </Marker>

                {/* Dynamic Jobs */}
                {jobs.map((job, idx) => {
                    // Mocking slightly different coordinates for each job to show on map near Namangan/Fergana
                    const lat = 41.0 + (Math.random() * 0.5 - 0.25);
                    const lon = 71.6 + (Math.random() * 0.5 - 0.25);

                    const pooling = calculateGreedyPooling({ lat, lon });

                    return (
                        <Marker key={job.id} position={[lat, lon]}>
                            <Popup>
                                <div className="font-sans">
                                    <h4 className="font-bold text-gray-900 border-b pb-1 mb-1">{job.crop_name}</h4>
                                    <p className="text-sm m-0 p-0 text-gray-700">Farmer: {job.profiles?.username}</p>
                                    <p className="text-sm m-0 p-0 text-gray-700">Quantity: {job.quantity}kg</p>
                                    <div className="mt-2 text-xs">
                                        <p className="m-0 p-0 text-gray-500">Detour: +{pooling.detourPercent.toFixed(1)}%</p>
                                        {pooling.isHighProfit ? (
                                            <span className="inline-block mt-1 bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">
                                                High Profit ({"<"}15%)
                                            </span>
                                        ) : (
                                            <span className="inline-block mt-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">
                                                Standard
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
