import { db } from "@/lib/db";

type BusinessHours = {
  id: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

type BusinessOffDay = {
  id: string;
  date: Date;
  reason: string | null;
};

const DAY_NAMES_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function Schedule() {
  const [hours, offDays] = await Promise.all([
    db.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } }),
    db.businessOffDay.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Reorder: Mon → Sun so Mon first (dayOfWeek 1..6, then 0)
  const orderedHours = [
    ...hours.filter((h) => h.dayOfWeek !== 0),
    ...hours.filter((h) => h.dayOfWeek === 0),
  ] as BusinessHours[];

  return (
    <div className="space-y-10">
      {/* Weekly hours */}
      <div className="bg-[#181716] border border-[#2E2A25] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#2E2A25]">
          <h2
            style={{ fontFamily: "Georgia, serif", letterSpacing: "3px" }}
            className="text-xs uppercase tracking-widest text-[#B16E34]"
          >
            Horario de atención
          </h2>
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-[#2E2A25]">
            {orderedHours.map((h) => (
              <tr key={h.dayOfWeek}>
                <td className="px-6 py-4 text-sm font-medium text-[#FAF4EA] w-36">
                  {DAY_NAMES_ES[h.dayOfWeek]}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  {h.isOpen ? (
                    <span className="text-[#C4B49A]">
                      {h.openTime} – {h.closeTime}
                    </span>
                  ) : (
                    <span className="text-[#7A6E60] italic">Cerrado</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Off-days */}
      <div className="bg-[#181716] border border-[#2E2A25] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#2E2A25]">
          <h2
            style={{ fontFamily: "Georgia, serif", letterSpacing: "3px" }}
            className="text-xs uppercase tracking-widest text-[#B16E34]"
          >
            Fechas especiales
          </h2>
        </div>
        {offDays.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[#7A6E60] italic">
            No hay fechas especiales próximas.
          </p>
        ) : (
          <ul className="divide-y divide-[#2E2A25]">
            {(offDays as BusinessOffDay[]).map((d) => {
              const date = new Date(d.date);
              const dateStr = date.toLocaleDateString("es-ES", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              });
              const capital = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
              return (
                <li key={d.id} className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm text-[#FAF4EA]">{capital}</span>
                  {d.reason && (
                    <span className="text-xs text-[#7A6E60] italic">{d.reason}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
