import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const headersMock = jest.fn();
const verifyStripeWebhook = jest.fn();
const processStripeEvent = jest.fn();

const db = {
  webhookEvent: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("next/headers", () => ({
  headers: headersMock,
}));
jest.mock("@/lib/stripe", () => ({
  verifyStripeWebhook,
}));
jest.mock("@/lib/db", () => ({ db }));
jest.mock("@/server/services/stripe-webhook-service", () => ({
  processStripeEvent,
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
