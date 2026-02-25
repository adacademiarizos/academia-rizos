'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email o contraseña incorrectos')
      } else if (result?.ok) {
        router.push(callbackUrl)
      }
    } catch (err) {
      setError('Error al iniciar sesión. Por favor, intenta nuevamente.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSign = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl })
    } catch (err) {
      setError('Error al iniciar sesión con Google.')
      console.error(err)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#181716] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-5">
            <img src="/logo.png" alt="Apoteósicas" className="h-12 mx-auto" />
          </Link>
          <h1
            className="text-2xl text-white mb-1"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Iniciar sesión
          </h1>
          <p className="text-sm text-white/40">Accedé a tu cuenta para continuar</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-7">
          {error && (
            <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              disabled={isLoading}
              className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition disabled:opacity-50"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
                disabled={isLoading}
                className="h-11 w-full rounded-2xl bg-white/5 px-4 pr-10 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                disabled={isLoading}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="mt-1 h-11 w-full rounded-2xl bg-[#646a40] text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Iniciando…' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-xs text-white/30">o continuá con</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSign}
            disabled={isLoading}
            className="h-11 w-full flex items-center justify-center gap-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
              <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
              <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
              <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
            </svg>
            Google
          </button>

          <p className="mt-5 text-center text-sm text-white/40">
            ¿No tenés cuenta?{' '}
            <Link href="/register" className="text-[#c8cf94] hover:text-white transition font-medium">
              Registrate
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-white/25">
          <Link href="/" className="hover:text-white/50 transition">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}
