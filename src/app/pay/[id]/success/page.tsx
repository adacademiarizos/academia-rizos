export default function PaySuccessPage() {
  return (
    <main className="min-h-screen bg-ap-bg px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
        <h1 className="font-(--font-display) text-4xl">Pago confirmado</h1>
        <p className="mt-3 text-white/70">
          Si el pago fue exitoso, recibirás un comprobante por correo.
        </p>
        <div className="mt-6 text-sm text-white/55">
          (MVP) Luego agregamos detalle del pago y referencia.
        </div>
      </div>
    </main>
  );
}
