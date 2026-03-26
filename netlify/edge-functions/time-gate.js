export default async (request, context) => {
  const now = new Date();
  
  // Zeitzone München: UTC+1 (Winter) / UTC+2 (Sommer)
  const offsetHours = isDST(now) ? 2 : 1;
  const localHour = (now.getUTCHours() + offsetHours) % 24;
  const day = now.getUTCDay(); // 0=So, 6=Sa

  const isWeekend = day === 0 || day === 6;
  const isOffHours = localHour < 7 || localHour >= 17;

  if (isWeekend || isOffHours) {
    return new Response("Service außerhalb der Betriebszeiten.", { 
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  return context.next();
};

function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return date.getTimezoneOffset() < Math.max(jan, jul);
}
