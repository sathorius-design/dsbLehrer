document.addEventListener("DOMContentLoaded", () => {
  const OVERLAY_ENABLED = false; // <- true = an, false = aus

  const overlay = document.getElementById("globalOverlay");
  const img = document.getElementById("globalOverlayImg");

  if (!overlay || !img) return;
  if (!OVERLAY_ENABLED) return; // <- hier wird gestoppt wenn aus

  const IMAGE_SRC = "/assets/bild5.jpg";
  const SHOW_MS = 10000;

  const preload = new Image();
  preload.src = IMAGE_SRC;

  function showOverlay() {
    img.src = IMAGE_SRC;
    overlay.classList.add("show");
    setTimeout(() => overlay.classList.remove("show"), SHOW_MS);
  }

  const now = new Date();
  const msToNextMinute =
    (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {
    showOverlay();
    setInterval(showOverlay, 60_000);
  }, msToNextMinute);
});

// ===== 1) Datum & Uhr =====
function updateDateTime() {
  const now = new Date();

  const dateEl = document.getElementById("dateText");
  const timeEl = document.getElementById("timeText");

  if (dateEl) {
    const weekday = now
      .toLocaleDateString("de-DE", { weekday: "short" })
      .replace(".", "");
    const date = now.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
    dateEl.textContent = `${weekday} ${date}`;
  }

  if (timeEl) {
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    timeEl.textContent = `${hours}.${minutes}`;
  }
}
updateDateTime();
setInterval(updateDateTime, 10000);

// ===== 2) Aktuelles aus content.json + Mensa =====
fetch("content.json")
  .then((r) => r.json())
  .then((data) => {
    // --- Aktuelles ---
    const wrap = document.getElementById("newsCards");
    if (wrap) {
      wrap.innerHTML = (data.news || [])
        .map((t) => `<div class="news-card">${t}</div>`)
        .join("");
    }

    // --- Mensa ---
    const lines = document.querySelectorAll(".mensa-box .mensa-line");
    if (lines && lines.length) {
      const days = ["Mo", "Di", "Mi", "Do", "Fr"];
      const mensa = data.mensa;

      days.forEach((day, i) => {
        const line = lines[i];
        if (!line) return;

        const spans = line.querySelectorAll("span");
        if (!spans || spans.length < 2) return;

        let text = "—";
        if (Array.isArray(mensa)) {
          if (typeof mensa[i] === "string" && mensa[i].trim() !== "") text = mensa[i];
        } else if (mensa && typeof mensa === "object") {
          if (typeof mensa[day] === "string" && mensa[day].trim() !== "") text = mensa[day];
        }

        spans[1].textContent = text;
      });
    }

  })
  .catch(() => {
    const wrap = document.getElementById("newsCards");
    if (wrap)
      wrap.innerHTML = `<div class="news-card">Aktuelles konnte nicht geladen werden.</div>`;
  });

// ===== 3) Wetter (Open-Meteo, München) =====
async function updateWeather() {
  const tempEl = document.getElementById("tempText");
  const textEl = document.getElementById("weatherText");
  if (!tempEl || !textEl) return;

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=48.137&longitude=11.575&current_weather=true&timezone=Europe%2FBerlin";
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();

    const cw = json.current_weather;
    if (!cw) throw new Error("no current_weather");

    tempEl.textContent = Math.round(cw.temperature);
    textEl.textContent = weatherCodeToText(cw.weathercode);
  } catch (e) {
    textEl.textContent = "Wetter nicht verfügbar";
  }
}

function weatherCodeToText(code) {
  const map = {
    0: "klar",
    1: "überwiegend klar",
    2: "teilweise bewölkt",
    3: "bewölkt",
    45: "Nebel",
    48: "Reifnebel",
    51: "Niesel (leicht)",
    53: "Niesel",
    55: "Niesel (stark)",
    61: "Regen (leicht)",
    63: "Regen",
    65: "Regen (stark)",
    71: "Schnee (leicht)",
    73: "Schnee",
    75: "Schnee (stark)",
    80: "Schauer (leicht)",
    81: "Schauer",
    82: "Schauer (stark)",
    95: "Gewitter",
  };
  return map[code] ?? "Wetter";
}

updateWeather();
setInterval(updateWeather, 10 * 60 * 1000);

// ===== 4) Abfahrten (MVG) =====
//
// Holt für jede .departures-station mit data-query die nächsten Abfahrten
// von der Edge Function /api/mvg und rendert sie in die .departures-list.

const DEP_LIMIT = 4;
const DEP_REFRESH_MS = 30 * 1000;

function formatMinutes(m) {
  if (m <= 0) return "jetzt";
  return `${m} min`;
}

function formatLeave(leaveIn) {
  if (leaveIn === 0) return { text: "jetzt!", urgent: true };
  return { text: `los: ${leaveIn}`, urgent: false };
}

function renderDepartures(listEl, departures, walkMin) {
  // verpasste Abfahrten (los-Zeit < 0) ausfiltern
  const reachable = (departures || []).filter(d => (d.minutes - walkMin) >= 0);

  if (reachable.length === 0) {
    listEl.innerHTML = `<div class="dep-placeholder">Keine erreichbaren Abfahrten</div>`;
    return;
  }

  listEl.innerHTML = reachable.slice(0, DEP_LIMIT).map(d => {
    const lineStyle = d.color ? `style="background:${d.color}"` : "";
    const minutesClass = d.minutes === 0 ? "dep-minutes is-now" : "dep-minutes";
    const delayHtml = d.delay && d.delay > 0
      ? `<span class="dep-delay">(+${d.delay})</span>`
      : "";
    const dest = (d.destination || "").replace(/</g, "&lt;");
    const line = (d.line || "").replace(/</g, "&lt;");

    // Loslaufen-Zeit: bei walkMin = 0 weglassen
    let leaveHtml = "";
    if (walkMin > 0) {
      const leaveIn = d.minutes - walkMin;
      const leave = formatLeave(leaveIn);
      const cls = leave.urgent ? "dep-leave is-now" : "dep-leave";
      leaveHtml = `<span class="${cls}">${leave.text}</span>`;
    }

    return `
      <div class="departure-row">
        <span class="dep-line" ${lineStyle}>${line}</span>
        <span class="dep-destination">${dest}</span>
        <div class="dep-times">
          <span class="${minutesClass}">${formatMinutes(d.minutes)}${delayHtml}</span>
          ${leaveHtml}
        </div>
      </div>
    `;
  }).join("");
}

async function fetchStation(stationEl) {
  const query = stationEl.dataset.query;
  const walkMin = parseInt(stationEl.dataset.walk || "0", 10);
  const listEl = stationEl.querySelector(".departures-list");
  const metaEl = stationEl.querySelector(".station-meta");
  const walkEl = stationEl.querySelector(".station-walk");
  if (!query || !listEl) return;

  // Gehzeit-Hinweis im Header anzeigen
  if (walkEl && walkMin > 0) {
    walkEl.textContent = `${walkMin} min zu Fuß`;
  }

  try {
    const res = await fetch(`/api/mvg?q=${encodeURIComponent(query)}&limit=${DEP_LIMIT + walkMin + 3}`, {
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderDepartures(listEl, data.departures, walkMin);

    if (metaEl) {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, "0");
      const mm = now.getMinutes().toString().padStart(2, "0");
      metaEl.textContent = `${hh}:${mm}`;
    }
  } catch (err) {
    listEl.innerHTML = `<div class="dep-error">Abfahrten nicht verfügbar</div>`;
  }
}

function updateAllDepartures() {
  const stations = document.querySelectorAll(".departures-station");
  stations.forEach(s => fetchStation(s));
}

updateAllDepartures();
setInterval(updateAllDepartures, DEP_REFRESH_MS);

// ===== 5) Update-Formular =====
const form = document.getElementById("updateForm");
if (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = {
      aktuelles: this.aktuelles.value,
      bilder: this.bilder.value,
      mensa: this.mensa.value,
    };
    console.log("Daten zum Speichern:", formData);
  });
}










