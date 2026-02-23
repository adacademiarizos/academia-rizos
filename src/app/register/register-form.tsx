'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, Chrome, UserPlus } from 'lucide-react'

export default function RegisterForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validations
    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setIsLoading(true)

    try {
      // Call registration API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Error al registrarse. Por favor, intenta nuevamente.')
        return
      }

      setSuccess('Cuenta creada exitosamente. Redirigiendo...')

      // Auto sign in after registration
      setTimeout(() => {
        signIn('credentials', {
          email: email.toLowerCase(),
          password,
          redirect: true,
          callbackUrl: '/student',
        })
      }, 1500)
    } catch (err) {
      setError('Error desconocido. Por favor, intenta nuevamente.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSign = async () => {
    setIsLoading(true)
    try {
      await signIn('google', {
        callbackUrl: '/student',
      })
    } catch (err) {
      setError('Error al registrarse con Google.')
      console.error(err)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ap-bg via-ap-bg to-black/20 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <img src="/logo.png" alt="Logo" className="h-12 mx-auto" />
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Crear Cuenta</h1>
          <p className="text-ap-ink/60">Únete a nuestra comunidad de aprendizaje</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                Nombre Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-ap-ink/40" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-ap-ink/40 focus:outline-none focus:border-ap-copper/50 focus:bg-white/10 transition"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-ap-ink/40" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-ap-ink/40 focus:outline-none focus:border-ap-copper/50 focus:bg-white/10 transition"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-ap-ink/40" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-ap-ink/40 focus:outline-none focus:border-ap-copper/50 focus:bg-white/10 transition"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-ap-ink/40 hover:text-ap-ink/60 transition"
                  disabled={isLoading}
                >
                  {showPassword ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-ap-ink/40" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-ap-ink/40 focus:outline-none focus:border-ap-copper/50 focus:bg-white/10 transition"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !name || !email || !password || !confirmPassword}
              className="w-full bg-ap-copper hover:bg-ap-copper/90 disabled:bg-ap-copper/50 disabled:cursor-not-allowed text-ap-ivory font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 mt-6"
            >
              <UserPlus className="w-5 h-5" />
              {isLoading ? 'Registrando...' : 'Crear Cuenta'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-ap-bg text-ap-ink/60">O regístrate con</span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSign}
            disabled={isLoading}
            className="w-full bg-white/5 hover:bg-white/10 disabled:bg-white/5 disabled:cursor-not-allowed border border-white/10 hover:border-white/20 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Chrome className="w-5 h-5" />
            Google
          </button>

          {/* Footer Links */}
          <div className="mt-6 text-center text-sm text-ap-ink/60">
            <p>
              ¿Ya tienes cuenta?{' '}
              <Link href="/signin" className="text-ap-copper hover:text-ap-copper/80 font-semibold transition">
                Inicia sesión aquí
              </Link>
            </p>
          </div>

          {/* Back to Home */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <Link href="/" className="text-ap-ink/60 hover:text-ap-ink/80 text-sm transition">
              ← Volver a inicio
            </Link>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-300 text-sm">
            <strong>Tu privacidad importante:</strong> Usamos tus datos solo para tu cuenta. Nunca compartimos información con terceros.
          </p>
        </div>
      </div>
    </div>
  )
}
