"use client";

type DeleteButtonProps = {
    id: string
}

function DeleteButton ({id}:DeleteButtonProps) {
    return (
        <form
            action="/api/admin/payment-links/delete"
            method="post"
            onSubmit={(e) => {
                // confirm client-side (si no querés confirm, borralo)
                if (!confirm("¿Seguro que querés eliminar este link de pago?")) e.preventDefault();
            }}
            >
            <input type="hidden" name="id" value={id} />
            <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition">
                Eliminar
            </button>
        </form>
  )
}

export default DeleteButton