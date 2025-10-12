import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import Papa from 'papaparse';
import { Cloud, ArrowUp, Loader2 } from 'lucide-react';

// --- TYPE DEFINITIONS (Moved Outside Component) ---
interface RegionData {
  emissions: number;
  count: number;
}

interface GroupedData {
  [key: string]: RegionData;
}

// --- CONSTANTS (Moved Outside Component) ---
const REGION_COORDS: { [key: string]: [number, number] } = {
  'us-east-1': [-77.0369, 38.9072],
  'us-east-2': [-82.9988, 39.9612],
  'us-west-2': [-122.3321, 47.6062],
  'eu-west-1': [-6.2603, 53.3498],
  'eu-central-1': [8.6821, 50.1109],
  'ap-south-1': [72.8777, 19.0760],
  'ap-northeast-1': [139.6917, 35.6895],
  'ap-southeast-1': [103.8198, 1.3521],
  'ap-southeast-2': [151.2093, -33.8688],
  'sa-east-1': [-46.6333, -23.5505],
  'ca-central-1': [-75.6972, 45.4215],
  'eu-west-2': [-0.1276, 51.5072]
};


const CarbonFootprintMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [regionData, setRegionData] = useState<GroupedData | null>(null);
  const [totalResources, setTotalResources] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const prettyNum = (n: number) => {
    if (n === null || isNaN(n)) return '0';
    if (n < 0.000001) return '< 0.000001';
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.000001) return parseFloat(n.toFixed(6)).toString();
    return n.toFixed(6);
  };

  const getEmissionColor = (value: number, max: number) => {
    if (value < 0.000001) return '#6c757d';
    const ratio = value / max;
    if (ratio < 0.33) return '#28a745';
    if (ratio < 0.66) return '#ffc107';
    return '#dc3545';
  };

  const getEmissionLevel = (value: number, max: number) => {
    if (value < 0.000001) return 'negligible';
    const ratio = value / max;
    if (ratio < 0.33) return 'low';
    if (ratio < 0.66) return 'medium';
    return 'high';
  };

  const getEmissionBadge = (value: number, max: number) => {
    const level = getEmissionLevel(value, max);
    let text, className;
    switch (level) {
      case 'negligible': text = 'Negligible'; className = 'emission-negligible'; break;
      case 'low': text = 'Low'; className = 'emission-low'; break;
      case 'medium': text = 'Medium'; className = 'emission-medium'; break;
      case 'high': text = 'High'; className = 'emission-high'; break;
    }
    return `<span class="emission-badge ${className}">${text}</span>`;
  };

  useEffect(() => {
    Papa.parse('https://s3.us-west-2.amazonaws.com/cloudbillanalyzer.epiuse-aws.com/titans-carbon-emission-00001.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Array<{ [key: string]: string }>;
        if (!data.length) {
          setError('No data found in CSV.');
          setLoading(false);
          return;
        }

        const regionCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('region'));
        const emissionCol = Object.keys(data[0]).find(k => k.toLowerCase().includes('emiss'));
        if (!regionCol || !emissionCol) {
          setError('Missing required columns (region, emissions) in CSV.');
          setLoading(false);
          return;
        }

        const grouped: GroupedData = {};
        let totalRes = 0;
        data.forEach(row => {
          const region = (row[regionCol] || '').trim();
          if (!region) return;
          const val = parseFloat(row[emissionCol]) || 0;
          if (!grouped[region]) grouped[region] = { emissions: 0, count: 0 };
          grouped[region].emissions += val;
          grouped[region].count += 1;
          totalRes++;
        });

        setRegionData(grouped);
        setTotalResources(totalRes);
        setLoading(false);
      },
      error: (err) => {
        console.error(err);
        setError('Error loading or parsing CSV file.');
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { zoomControl: true }).setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !regionData) return;
    const map = mapRef.current; // Create a local variable to avoid null issues inside loops

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const regions = Object.keys(regionData);
    const maxEmission = Math.max(...regions.map(r => regionData[r].emissions));

    regions.forEach(region => {
      const coords = REGION_COORDS[region];
      if (!coords) return;

      const { emissions, count } = regionData[region];
      const color = getEmissionColor(emissions, maxEmission);
      
      let radius;
      if (emissions < 0.000001) {
        radius = 15;
      } else {
        const scale = Math.sqrt(emissions / maxEmission);
        radius = Math.max(20, scale * 60);
      }
      
      let displayText;
      if (emissions < 0.000001) {
        displayText = '~';
      } else if (emissions >= 1) {
        displayText = emissions.toFixed(1);
      } else {
        displayText = prettyNum(emissions).substring(0, 4);
      }

      const labelHtml = `
        <div class="map-marker-wrapper">
          <div style="background:${color};border-radius:50%;width:${radius}px;height:${radius}px;" class="map-marker-circle">
            <span style="font-size:${Math.max(11, radius/3)}px">${displayText}</span>
          </div>
          <div class="map-marker-label">${region.toUpperCase()}</div>
        </div>`;

      const icon = L.divIcon({
        html: labelHtml,
        className: '',
        iconSize: [radius, radius + 20],
        iconAnchor: [radius / 2, radius / 2]
      });

      const popupContent = `
        <div class="popup-content">
          <div class="popup-title">${region.toUpperCase()}</div>
          <div class="popup-row">
            <span class="popup-label">Emissions:</span>
            <span class="popup-value">${prettyNum(emissions)} MTCO₂e</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Level:</span>
            <span>${getEmissionBadge(emissions, maxEmission)}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Resources:</span>
            <span class="popup-value">${count}</span>
          </div>
        </div>`;
      
      // **FIXED**: Added check for map before adding marker
      const marker = L.marker([coords[1], coords[0]], { icon })
        .addTo(map)
        .bindPopup(popupContent);

      markersRef.current.push(marker);
    });
  }, [regionData]);

  return (
    <>
      <style>{`
        .leaflet-popup-content-wrapper, .leaflet-popup-tip-container { box-sizing: content-box; }
        .map-marker-wrapper { display: flex; flex-direction: column; align-items: center; }
        .map-marker-circle { display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.15); transition: all 0.3s ease; color: white; font-weight: 700; }
        .map-marker-label { margin-top: 6px; font-size: 11px; color: #6c757d; font-weight: 700; text-shadow: 1px 1px 2px white; }
        .legend { position: absolute; bottom: 20px; right: 20px; background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-size: 12px; z-index: 1000; border: 1px solid #e9ecef; }
        .legend-title { font-weight: 600; margin-bottom: 8px; color: #212529; }
        .legend-item { display: flex; align-items: center; margin-bottom: 4px; }
        .legend-color { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .popup-content { font-size: 14px; font-family: 'Inter', sans-serif; min-width: 200px; }
        .popup-title { font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #3B82F6; }
        .popup-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .popup-label { font-weight: 500; color: #6c757d; }
        .popup-value { font-weight: 600; color: #212529; }
        .emission-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .emission-low { background: rgba(16, 185, 129, 0.1); color: #10B981; }
        .emission-medium { background: rgba(245, 158, 11, 0.1); color: #F59E0B; }
        .emission-high { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
        .emission-negligible { background: rgba(108, 117, 125, 0.1); color: #6c757d; }
      `}</style>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Cloud className="text-blue-600" />
              Cloud Carbon Footprint
            </h3>
            <p className="text-gray-500">Geographical distribution of carbon emissions</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 font-medium">Total Resources</div>
              <div className="text-2xl font-bold text-gray-800">{totalResources ?? '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 font-medium">New Resources</div>
              <div className="text-2xl font-bold text-gray-800 flex items-center justify-end gap-1">
                {totalResources ? Math.floor(totalResources / 10) : '—'}
                {totalResources && <ArrowUp className="w-4 h-4 text-green-500" />}
              </div>
            </div>
          </div>
        </div>

        <div className="relative h-[560px] rounded-lg border border-gray-200">
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-20">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="mt-4 text-gray-600">Loading Cloud Footprint data...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-20 p-4 rounded-lg">
              <p className="text-red-600 font-semibold">{error}</p>
            </div>
          )}
          <div ref={mapContainerRef} className="h-full w-full rounded-lg" />
          <div className="legend">
            <div className="legend-title">Emission Levels</div>
            <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#6c757d' }}></div><span>Negligible</span></div>
            <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#28a745' }}></div><span>Low</span></div>
            <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ffc107' }}></div><span>Medium</span></div>
            <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#dc3545' }}></div><span>High</span></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CarbonFootprintMap;