'use client'

import { Suspense } from 'react'
import RegisterForm from './register-form'

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ap-bg via-ap-bg to-black/20 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded-lg"></div>
            <div className="h-10 bg-white/10 rounded-lg"></div>
            <div className="h-10 bg-white/10 rounded-lg"></div>
            <div className="h-10 bg-white/10 rounded-lg"></div>
            <div className="h-10 bg-white/10 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

