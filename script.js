
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("globalOverlay");
  const img = document.getElementById("globalOverlayImg");

  if (!overlay || !img) return;

  const IMAGE_SRC = "/assets/bild2.jpg";
  const SHOW_MS = 10000; // 5 Sekunden

  // Bild vorladen (verhindert Ruckeln)
  const preload = new Image();
  preload.src = IMAGE_SRC;

  function showOverlay() {
    img.src = IMAGE_SRC;
    overlay.classList.add("show");
    setTimeout(() => overlay.classList.remove("show"), SHOW_MS);
  }

  // Auf die nächste volle Minute synchronisieren
  const now = new Date();
  const msToNextMinute =
    (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {
    showOverlay();               // einmal bei :00
    setInterval(showOverlay, 60_000); // dann jede Minute wieder
  }, msToNextMinute);
});

// ===== 1) Datum & Uhr (lokal, sekundengenau brauchst du nicht für Beamer) =====
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

// ===== 2) Aktuelles aus content.json (ohne Backend) + Mensa + Bilder =====
let newsSlideTimer = null; // Slideshow-Timer

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

    // --- Bilder in der 3. Kachel: Slideshow aus assets/ (4 Bilder, Loop) + Fade ---
    const imgWrap = document.getElementById("newsImages");
    if (imgWrap) {
      // alte Slideshow stoppen (falls vorhanden)
      if (newsSlideTimer) {
        clearInterval(newsSlideTimer);
        newsSlideTimer = null;
      }

      // AUS content.json: entweder data.bilder (empfohlen) oder fallback data.newsImages
      const imgsRaw = data.bilder ?? data.newsImages;

      const imgs = Array.isArray(imgsRaw)
        ? imgsRaw
        : typeof imgsRaw === "string"
        ? [imgsRaw]
        : [];

      // nur gültige Einträge, auf max. 4 begrenzen
      const list = imgs.filter(Boolean).slice(0, 4);

      // helper: immer aus assets/ laden, außer es steht schon assets/ drin
      const toAssetPath = (p) => (p.startsWith("assets/") ? p : `assets/${p}`);

      if (list.length === 0) {
        // Kachel bleibt sichtbar, nur Inhalt leer
        imgWrap.innerHTML = "";
      } else {
        // genau 1 <img>, nur src wechselt
        imgWrap.innerHTML = `<img id="newsImage" src="${toAssetPath(list[0])}" alt="">`;

        // rotieren, wenn mehr als 1 Bild vorhanden
        if (list.length > 1) {
          let idx = 0;
          newsSlideTimer = setInterval(() => {
            const imgEl = document.getElementById("newsImage");
            if (!imgEl) return;

            // Fade-out
            imgEl.classList.add("is-fading");

            // Bildwechsel in der Mitte des Fades
            setTimeout(() => {
              idx = (idx + 1) % list.length;
              imgEl.src = toAssetPath(list[idx]);

              // Fade-in
              imgEl.classList.remove("is-fading");
            }, 400); // halbe Dauer der CSS-Transition (0.8s)
          }, 15000); // Wechselintervall
        }
      }
    }
  })
  .catch(() => {
    const wrap = document.getElementById("newsCards");
    if (wrap)
      wrap.innerHTML = `<div class="news-card">Aktuelles konnte nicht geladen werden.</div>`;
  });

// ===== 3) Temperatur live (ohne Key) – München (Neufreimann) =====
// Open-Meteo: aktuelle Temperatur + Wettercode
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

    const desc = weatherCodeToText(cw.weathercode);
    textEl.textContent = desc;
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
setInterval(updateWeather, 10 * 60 * 1000); // alle 10 Minuten

setInterval(updateWeather, 10 * 60 * 1000); // alle 10 Minuten


