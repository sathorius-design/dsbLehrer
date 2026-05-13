// netlify/edge-functions/mvg.js
//
// Proxy zur inoffiziellen MVG-API (bgw-pt/v3).
// Browser können die MVG-API nicht direkt aufrufen (CORS),
// deshalb läuft die Anfrage über diese Edge Function.
//
// Aufruf vom Frontend:
//   fetch("/api/mvg?q=Neufreimann&limit=4")
//
// Antwort:
//   { station: "Neufreimann", departures: [ { line, destination, minutes, delay, type, color }, ... ] }

// Station-IDs werden im Speicher der Function-Instance gecacht,
// damit nicht bei jedem Aufruf zweimal die MVG angefragt wird.
const stationCache = new Map();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (DSB-Lehrer / Netlify Edge Function)",
  "Accept": "application/json"
};

// Standard-Farben pro Verkehrsmittel falls die API keine liefert
const DEFAULT_COLORS = {
  BUS: "#0d5c75",
  REGIONAL_BUS: "#0d5c75",
  TRAM: "#c8102e",
  UBAHN: "#777777",
  SBAHN: "#008d4f"
};

async function findStation(query) {
  if (stationCache.has(query)) return stationCache.get(query);

  const url = `https://www.mvg.de/api/bgw-pt/v3/locations?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`locations API: ${res.status}`);

  const list = await res.json();
  // Erstes Ergebnis vom Typ STATION nehmen
  const station = Array.isArray(list)
    ? list.find(l => (l.type === "STATION") && l.globalId)
    : null;

  if (!station) throw new Error(`station not found: ${query}`);

  const result = { globalId: station.globalId, name: station.name };
  stationCache.set(query, result);
  return result;
}

async function fetchDepartures(globalId, limit) {
  const url = `https://www.mvg.de/api/bgw-pt/v3/departures?globalId=${encodeURIComponent(globalId)}&limit=${limit * 3}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`departures API: ${res.status}`);
  return res.json();
}

export default async (request) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "4", 10), 10);

  if (!query) {
    return new Response(JSON.stringify({ error: "missing query parameter 'q'" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const station = await findStation(query);
    const raw = await fetchDepartures(station.globalId, limit);

    const now = Date.now();
    const cleaned = (raw || [])
      .filter(d => !d.cancelled)
      .map(d => {
        const planned = d.plannedDepartureTime;
        const actual = d.realtimeDepartureTime || d.plannedDepartureTime;
        const minutes = Math.max(0, Math.round((actual - now) / 60000));
        const delay = typeof d.delayInMinutes === "number"
          ? d.delayInMinutes
          : (planned ? Math.round((actual - planned) / 60000) : 0);

        return {
          line: d.label || "?",
          destination: d.destination || "",
          minutes,
          delay,
          type: d.transportType || "BUS",
          color: DEFAULT_COLORS[d.transportType] || DEFAULT_COLORS.BUS,
          realtime: !!d.realtime
        };
      })
      .filter(d => d.minutes >= 0)
      .slice(0, limit);

    return new Response(JSON.stringify({
      station: station.name,
      departures: cleaned
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Browser-Cache 20s, CDN-Cache 20s -> entlastet die MVG-API massiv
        "Cache-Control": "public, max-age=20",
        "Netlify-CDN-Cache-Control": "public, s-maxage=20"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err.message || err),
      query
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
};

export const config = {
  path: "/api/mvg"
};
