export default function BookingSuccess() {
  return (
    <main className="min-h-screen bg-ap-bg px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
        <h1 className="font-(--font-display) text-4xl">Pago procesado</h1>
        <p className="mt-3 text-white/70">
          Si el pago fue exitoso, recibirás confirmación y comprobante por correo.
        </p>
      </div>
    </main>
  );
}
