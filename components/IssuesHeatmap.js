import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from 'react-leaflet';

const INDIA_CENTER = [22.5937, 78.9629];

function colorForIntensity(intensity = 0) {
  if (intensity >= 0.8) return '#7f1d1d';
  if (intensity >= 0.6) return '#b91c1c';
  if (intensity >= 0.4) return '#ef4444';
  if (intensity >= 0.2) return '#f97316';
  if (intensity > 0) return '#f59e0b';
  return '#e5e7eb';
}

export default function IssuesHeatmap({ points = [], boundaries = null }) {
  return (
    <div className="rounded overflow-hidden border border-gray-200" role="region" aria-label="Issue density heatmap">
      <MapContainer center={INDIA_CENTER} zoom={5} style={{ height: '520px', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {boundaries?.features?.length ? (
          <GeoJSON
            data={boundaries}
            style={(feature) => {
              const intensity = feature?.properties?.intensity || 0;
              return {
                fillColor: colorForIntensity(intensity),
                weight: 1,
                opacity: 1,
                color: '#4b5563',
                fillOpacity: intensity > 0 ? 0.35 : 0.1
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              layer.bindPopup(`
                <div style="font-size:12px; line-height:1.4;">
                  <div><strong>${props.name || 'Constituency'}</strong> (${props.code || '-'})</div>
                  <div>Total: ${props.total || 0}</div>
                  <div>Pending: ${props.pending || 0}</div>
                  <div>Resolved: ${props.resolved || 0}</div>
                  <div>Resolution rate: ${props.resolutionRate || 0}%</div>
                </div>
              `);
            }}
          />
        ) : null}

        {points.map((point, idx) => {
          const radius = Math.min(24, 4 + point.count * 1.5);
          const color = point.pending > 0 ? '#f97316' : '#16a34a';

          return (
            <CircleMarker
              key={`${point.lat}-${point.lng}-${point.category}-${idx}`}
              center={[point.lat, point.lng]}
              radius={radius}
              pathOptions={{ color, fillOpacity: 0.35 }}
            >
              <Popup>
                <div className="text-sm">
                  <p>
                    <strong>Category:</strong> {point.category}
                  </p>
                  <p>
                    <strong>Total:</strong> {point.count}
                  </p>
                  <p>
                    <strong>Pending:</strong> {point.pending}
                  </p>
                  <p>
                    <strong>Resolved:</strong> {point.resolved}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
