"use client";

import { useEffect, useState } from "react";
import { Users, Search, Shield, UserCheck, GraduationCap } from "lucide-react";

type User = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "ADMIN" | "STAFF" | "STUDENT";
  createdAt: string;
  _count: { appointments: number; courseAccess: number };
};

const ROLE_CONFIG = {
  ADMIN: { label: "Admin", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Shield },
  STAFF: { label: "Staff", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: UserCheck },
  STUDENT: { label: "Estudiante", color: "bg-white/10 text-white/60 border-white/10", icon: GraduationCap },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = (s = search, r = roleFilter) => {
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (r !== "all") params.set("role", r);
    setLoading(true);
    fetch(`/api/admin/users?${params}`)
      .then((res) => res.json())
      .then((d) => setUsers(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(search, roleFilter);
  };

  const handleRoleChange = async (userId: string, newRole: "ADMIN" | "STAFF" | "STUDENT") => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (!confirm(`¿Cambiar el rol de ${user.name ?? user.email} a ${ROLE_CONFIG[newRole].label}?`)) return;

    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      } else {
        alert(data.error ?? "Error al actualizar rol");
      }
    } catch {
      alert("Error al actualizar rol");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-ap-copper" /> Gestión de Usuarios
        </h1>
        <p className="text-white/60 mt-1 text-sm">
          Ve y gestiona todos los usuarios registrados en la plataforma.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {(["ADMIN", "STAFF", "STUDENT"] as const).map((role) => {
          const count = users.filter((u) => u.role === role).length;
          const cfg = ROLE_CONFIG[role];
          const Icon = cfg.icon;
          return (
            <div key={role} className={`bg-white/5 border border-white/10 rounded-[20px] p-4 flex items-center gap-3`}>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${cfg.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xl font-semibold text-white">{count}</div>
                <div className="text-xs text-white/50">{cfg.label}s</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search + filter */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-ap-copper/50 text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); fetchUsers(search, e.target.value); }}
          className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2.5 text-sm outline-none"
        >
          <option value="all" className="bg-[#1a1a2e]">Todos los roles</option>
          <option value="ADMIN" className="bg-[#1a1a2e]">Admins</option>
          <option value="STAFF" className="bg-[#1a1a2e]">Staff</option>
          <option value="STUDENT" className="bg-[#1a1a2e]">Estudiantes</option>
        </select>
        <button
          type="submit"
          className="px-5 py-2.5 bg-ap-copper hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition"
        >
          Buscar
        </button>
      </form>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-[28px] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-white/60">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-white/50">No se encontraron usuarios.</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wide">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wide hidden md:table-cell">Citas</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wide hidden md:table-cell">Cursos</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wide hidden lg:table-cell">Registro</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wide">Rol</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white/50 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => {
                const cfg = ROLE_CONFIG[user.role];
                const Icon = cfg.icon;
                const isUpdating = updating === user.id;

                return (
                  <tr key={user.id} className="hover:bg-white/5 transition">
                    {/* User info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name ?? ""}
                            className="h-9 w-9 rounded-2xl object-cover border border-white/10 flex-shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-2xl bg-ap-copper/20 border border-ap-copper/30 flex items-center justify-center text-sm font-bold text-ap-copper flex-shrink-0">
                            {(user.name ?? user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {user.name ?? "Sin nombre"}
                          </div>
                          <div className="text-xs text-white/50 truncate">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Counts */}
                    <td className="px-6 py-4 text-sm text-white/60 hidden md:table-cell">
                      {user._count.appointments}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60 hidden md:table-cell">
                      {user._count.courseAccess}
                    </td>

                    {/* Registration date */}
                    <td className="px-6 py-4 text-sm text-white/50 hidden lg:table-cell">
                      {new Date(user.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>

                    {/* Current role badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>

                    {/* Role change actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {user.role !== "STUDENT" && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleRoleChange(user.id, "STUDENT")}
                            className="px-3 py-1.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition disabled:opacity-40"
                          >
                            → Estudiante
                          </button>
                        )}
                        {user.role !== "STAFF" && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleRoleChange(user.id, "STAFF")}
                            className="px-3 py-1.5 text-xs rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition disabled:opacity-40"
                          >
                            → Staff
                          </button>
                        )}
                        {user.role !== "ADMIN" && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleRoleChange(user.id, "ADMIN")}
                            className="px-3 py-1.5 text-xs rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition disabled:opacity-40"
                          >
                            → Admin
                          </button>
                        )}
                        {isUpdating && (
                          <span className="text-xs text-white/40">Actualizando...</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
