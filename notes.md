7) Webhook: asegurar que soporta PAYMENT_LINK

Tu webhook ya hace upsert Payment con type por metadata. Solo asegurate de:

si metadata.type === "PAYMENT_LINK" guarde paymentLinkId

marque PaymentLink.status = PAID

En tu webhook dentro de checkout.session.completed, agregá esto después del upsert payment:

if (payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
  await db.paymentLink.update({
    where: { id: payment.paymentLinkId },
    data: { status: "PAID" },
  });
}


✅ Y el recibo por email ya se manda porque usa payerEmail.