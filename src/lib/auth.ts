import { Role } from "@prisma/client";

export function isAdmin(role?: Role | null) {
  return role === "ADMIN";
}
