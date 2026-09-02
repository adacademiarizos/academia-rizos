import { beforeEach, describe, expect, it, vi } from "vitest";

const { headersMock, verifyStripeWebhook, processStripeEvent, db } = vi.hoisted(() => {
  const headersMock = vi.fn();
  const verifyStripeWebhook = vi.fn();
  const processStripeEvent = vi.fn();
  const db = {
    webhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { headersMock, verifyStripeWebhook, processStripeEvent, db };
});

vi.mock("next/headers", () => ({
  headers: headersMock,
}));
vi.mock("@/lib/stripe", () => ({
  verifyStripeWebhook,
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/server/services/stripe-webhook-service", () => ({
  processStripeEvent,
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "stripe-signature" ? "sig_123" : null),
    });
  });

  it("returns early for already-processed Stripe events", async () => {
    verifyStripeWebhook.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    db.webhookEvent.findUnique.mockResolvedValue({
      processedAt: new Date("2026-07-05T10:00:00Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_1" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deduplicated: true,
    });
    expect(processStripeEvent).not.toHaveBeenCalled();
    expect(db.webhookEvent.update).not.toHaveBeenCalled();
  });
});
