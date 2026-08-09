import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const getServerSession = jest.fn();
const getNotifications = jest.fn();

const db = {
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock("next-auth", () => ({ getServerSession }));
jest.mock("@/lib/auth-options", () => ({ authOptions: {} }));
jest.mock("@/lib/db", () => ({ db }));
jest.mock("@/server/services/notification-service", () => ({
  NotificationService: { getNotifications },
}));

import { GET } from "@/app/api/notifications/route";

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { email: "student@example.com" } });
    db.user.findUnique.mockResolvedValue({ id: "student-1" });
  });

  it("keeps legacy records compatible and exposes new metadata only when present", async () => {
    getNotifications.mockResolvedValue({
      notifications: [
        {
          id: "legacy-1",
          userId: "student-1",
          type: "PAYMENT",
          title: "Pago recibido",
          message: "Gracias",
          relatedId: "payment-1",
          isRead: false,
          createdAt: new Date("2026-08-09T12:00:00.000Z"),
          eventKey: null,
          dedupeKey: null,
          resourceType: null,
          resourceId: null,
          actionUrl: null,
          priority: "NORMAL",
          readAt: null,
        },
        {
          id: "outbox-1",
          userId: "student-1",
          type: "APPOINTMENT",
          title: "Cita confirmada",
          message: "Tu cita fue confirmada",
          relatedId: "appointment-1",
          isRead: true,
          createdAt: new Date("2026-08-09T12:00:00.000Z"),
          eventKey: "appointment.paid",
          dedupeKey: "event-1:user:student-1",
          resourceType: "APPOINTMENT",
          resourceId: "appointment-1",
          actionUrl: "/staff/appointments",
          priority: "HIGH",
          readAt: new Date("2026-08-09T12:01:00.000Z"),
        },
      ],
      total: 2,
      unreadCount: 1,
    });

    const response = await GET(
      new NextRequest("https://example.com/api/notifications"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: "legacy-1",
          userId: "student-1",
          type: "PAYMENT",
          title: "Pago recibido",
          message: "Gracias",
          relatedId: "payment-1",
          isRead: false,
          createdAt: "2026-08-09T12:00:00.000Z",
        },
        {
          id: "outbox-1",
          userId: "student-1",
          type: "APPOINTMENT",
          title: "Cita confirmada",
          message: "Tu cita fue confirmada",
          relatedId: "appointment-1",
          isRead: true,
          createdAt: "2026-08-09T12:00:00.000Z",
          eventKey: "appointment.paid",
          dedupeKey: "event-1:user:student-1",
          resourceType: "APPOINTMENT",
          resourceId: "appointment-1",
          actionUrl: "/staff/appointments",
          priority: "HIGH",
          readAt: "2026-08-09T12:01:00.000Z",
        },
      ],
      unreadCount: 1,
      total: 2,
      count: 2,
    });
  });
});
