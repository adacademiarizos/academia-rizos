'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  INVALID_RESET_PASSWORD_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from '@/lib/password-reset'

export default function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError(INVALID_RESET_PASSWORD_MESSAGE)
      return
    }

    if (password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || INVALID_RESET_PASSWORD_MESSAGE)
        return
      }

      setSuccess(data.message || PASSWORD_RESET_SUCCESS_MESSAGE)
      setPassword('')
      setConfirmPassword('')

      window.setTimeout(() => {
        router.push('/signin')
      }, 1500)
    } catch (err) {
      console.error(err)
      setError('No pudimos actualizar tu contrasena.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#181716] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-5">
            <img src="/logo.png" alt="Apoteosicas" className="h-12 mx-auto" />
          </Link>
          <h1
            className="text-2xl text-white mb-1"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Nueva contrasena
          </h1>
          <p className="text-sm text-white/40">
            Elige una clave nueva para volver a entrar a tu cuenta.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-7">
          {!token && (
            <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {INVALID_RESET_PASSWORD_MESSAGE}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-2xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nueva contrasena"
              required
              disabled={isLoading || !token}
              className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition disabled:opacity-50"
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirmar contrasena"
              required
              disabled={isLoading || !token}
              className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isLoading || !token || !password || !confirmPassword}
              className="mt-1 h-11 w-full rounded-2xl bg-[#646a40] text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Actualizando...' : 'Guardar nueva contrasena'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/40">
            <Link href="/forgot-password" className="text-[#c8cf94] hover:text-white transition font-medium">
              Solicitar otro enlace
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-white/25">
          <Link href="/signin" className="hover:text-white/50 transition">Volver a iniciar sesion</Link>
        </p>
      </div>
    </div>
  )
}
