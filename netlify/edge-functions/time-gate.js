export default async (request, context) => {
  const now = new Date();

  // Korrekte Berliner Zeit via Intl (funktioniert auf allen Servern)
  const berlin = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const hour    = parseInt(berlin.find(p => p.type === "hour").value);
  const minute  = parseInt(berlin.find(p => p.type === "minute").value);
  const weekday = berlin.find(p => p.type === "weekday").value; // Mo, Di, ...
  
  const isWeekend   = weekday === "Sa" || weekday === "So";
  const timeMinutes = hour * 60 + minute;
  const isOffHours  = timeMinutes < 7 * 60 || timeMinutes >= 17 * 60;

  if (isWeekend || isOffHours) {
    return new Response("Service außerhalb der Betriebszeiten.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  return context.next();
};
