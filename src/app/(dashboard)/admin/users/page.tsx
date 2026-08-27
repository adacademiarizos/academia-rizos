"use client";

import { useEffect, useState } from "react";
import { Users, Search, Shield, UserCheck, GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";
import { UserCommunityTabs } from "./components/UserCommunityTabs";
import { toast } from "sonner";

type User = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "ADMIN" | "STAFF" | "STUDENT";
  createdAt: string;
  _count: { appointments: number; courseAccess: number };
};

type RoleCounts = {
  ADMIN: number;
  STAFF: number;
  STUDENT: number;
};

type UsersResponse = {
  ok: boolean;
  data: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  roleCounts?: RoleCounts;
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({
    ADMIN: 0,
    STAFF: 0,
    STUDENT: 0,
  });

  const fetchUsers = async (opts?: {
    search?: string;
    role?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const nextSearch = opts?.search ?? search;
    const nextRole = opts?.role ?? roleFilter;
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;

    const params = new URLSearchParams();
    if (nextSearch) params.set("search", nextSearch);
    if (nextRole !== "all") params.set("role", nextRole);
    params.set("page", String(nextPage));
    params.set("limit", String(nextPageSize));

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = (await res.json()) as UsersResponse;

      setUsers(data.data ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setPage(data.pagination?.page ?? nextPage);
      setPageSize(data.pagination?.limit ?? nextPageSize);
      setRoleCounts(data.roleCounts ?? { ADMIN: 0, STAFF: 0, STUDENT: 0 });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers({ page: 1, pageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers({ page: 1, search, role: roleFilter, pageSize });
  };

  const handleRoleChange = async (userId: string, newRole: "ADMIN" | "STAFF" | "STUDENT") => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (!confirm(`Cambiar el rol de ${user.name ?? user.email} a ${ROLE_CONFIG[newRole].label}?`)) return;

    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchUsers({ search, role: roleFilter, page: 1, pageSize });
      } else {
        toast.error(data.error ?? "Error al actualizar rol");
      }
    } catch {
      toast.error("Error al actualizar rol");
    } finally {
      setUpdating(null);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      <UserCommunityTabs />

      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-ap-copper" /> Gestion de Usuarios
        </h1>
        <p className="text-white/60 mt-1 text-sm">
          Ve y gestiona todos los usuarios registrados en la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["ADMIN", "STAFF", "STUDENT"] as const).map((role) => {
          const count = roleCounts[role];
          const cfg = ROLE_CONFIG[role];
          const Icon = cfg.icon;
          return (
            <div key={role} className="bg-white/5 border border-white/10 rounded-[20px] p-4 flex items-center gap-3">
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
          onChange={(e) => {
            const nextRole = e.target.value;
            setRoleFilter(nextRole);
            setPage(1);
            fetchUsers({ search, role: nextRole, page: 1, pageSize });
          }}
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

                    <td className="px-6 py-4 text-sm text-white/60 hidden md:table-cell">
                      {user._count.appointments}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60 hidden md:table-cell">
                      {user._count.courseAccess}
                    </td>

                    <td className="px-6 py-4 text-sm text-white/50 hidden lg:table-cell">
                      {new Date(user.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {user.role !== "STUDENT" && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleRoleChange(user.id, "STUDENT")}
                            className="px-3 py-1.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition disabled:opacity-40"
                          >
                            -&gt; Estudiante
                          </button>
                        )}
                        {user.role !== "STAFF" && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleRoleChange(user.id, "STAFF")}
                            className="px-3 py-1.5 text-xs rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition disabled:opacity-40"
                          >
                            -&gt; Staff
                          </button>
                        )}
                        {user.role !== "ADMIN" && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleRoleChange(user.id, "ADMIN")}
                            className="px-3 py-1.5 text-xs rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition disabled:opacity-40"
                          >
                            -&gt; Admin
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="text-sm text-white/60">
          Mostrando {from}-{to} de {total} usuarios
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-white/60">
            Ver
            <select
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                setPageSize(nextSize);
                setPage(1);
                fetchUsers({ search, role: roleFilter, page: 1, pageSize: nextSize });
              }}
              className="rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-white outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size} className="bg-[#1a1a2e]">
                  {size}
                </option>
              ))}
            </select>
            por pagina
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                setPage(nextPage);
                fetchUsers({ search, role: roleFilter, page: nextPage, pageSize });
              }}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/15 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>

            <span className="text-sm text-white/65">
              Pagina {page} de {totalPages}
            </span>

            <button
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1);
                setPage(nextPage);
                fetchUsers({ search, role: roleFilter, page: nextPage, pageSize });
              }}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/15 disabled:opacity-40"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
