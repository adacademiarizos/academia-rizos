"use client";

type StaffMember = {
  staffId: string;
  name: string | null;
  photoUrl: string | null;
  priceCents: number;
  currency: string;
};

function Initials({ name }: { name: string | null }) {
  const letters = (name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#646a40]/40 text-lg font-bold text-[#c8cf94]">
      {letters}
    </div>
  );
}

export default function StaffCards({
  staff,
  selected,
  onSelect,
}: {
  staff: StaffMember[];
  selected: string | null;
  onSelect: (staffId: string) => void;
}) {
  if (staff.length === 0) {
    return (
      <p className="text-sm text-white/40 mt-2">No hay profesionales disponibles para este servicio.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-3">
      {staff.map((s) => {
        const isSelected = selected === s.staffId;
        return (
          <button
            key={s.staffId}
            type="button"
            onClick={() => onSelect(s.staffId)}
            className={`group flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-all duration-200 hover:scale-[1.02]
              ${isSelected
                ? "border-[#646a40] bg-[#646a40]/15 ring-2 ring-[#646a40]/50"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
              }`}
          >
            {/* Photo / initials */}
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
              {s.photoUrl ? (
                <img src={s.photoUrl} alt={s.name ?? ""} className="h-full w-full object-cover" />
              ) : (
                <Initials name={s.name} />
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-white leading-tight">
                {s.name ?? "Staff"}
              </span>
              <span className="text-xs text-[#c8cf94]">
                {(s.priceCents / 100).toFixed(2)} {s.currency}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
