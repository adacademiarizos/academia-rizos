import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getServerSession, db } = vi.hoisted(() => {
  const getServerSession = vi.fn();
  const db = {
    user: {
      findUnique: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return { getServerSession, db };
});

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ db }));

import { GET, PATCH } from "@/app/api/notification-preferences/route";

describe("/api/notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { email: "student@example.com" } });
    db.user.findUnique.mockResolvedValue({ id: "student-1" });
  });

  it("returns every optional category enabled by default, while preserving an explicit opt-out", async () => {
    db.notificationPreference.findMany.mockResolvedValue([
      { category: "COMMUNITY", enabled: false },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        { category: "COURSE_UPDATES", enabled: true },
        { category: "COMMUNITY", enabled: false },
        { category: "ACHIEVEMENTS", enabled: true },
      ],
    });
    expect(db.notificationPreference.findMany).toHaveBeenCalledWith({
      where: { userId: "student-1" },
      select: { category: true, enabled: true },
    });
  });

  it("persists a valid optional-category preference for the authenticated user", async () => {
    db.notificationPreference.upsert.mockResolvedValue({
      category: "COMMUNITY",
      enabled: false,
    });

    const response = await PATCH(
      new NextRequest("https://example.com/api/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: "COMMUNITY", enabled: false }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { category: "COMMUNITY", enabled: false },
    });
    expect(db.notificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        userId_category: {
          userId: "student-1",
          category: "COMMUNITY",
        },
      },
      create: { userId: "student-1", category: "COMMUNITY", enabled: false },
      update: { enabled: false },
      select: { category: true, enabled: true },
    });
  });

  it.each([
    { category: "PAYMENT", enabled: false },
    { category: "COMMUNITY", enabled: "false" },
    { enabled: false },
  ])("rejects an invalid preference payload: %p", async (body) => {
    const response = await PATCH(
      new NextRequest("https://example.com/api/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid preference",
    });
    expect(db.notificationPreference.upsert).not.toHaveBeenCalled();
  });
});
