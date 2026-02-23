'use client'

import { Suspense } from 'react'
import SignInForm from './signin-form'

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInForm />
    </Suspense>
  )
}

function SignInLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ap-bg via-ap-bg to-black/20 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded-lg"></div>
            <div className="h-10 bg-white/10 rounded-lg"></div>
            <div className="h-10 bg-white/10 rounded-lg"></div>
            <div className="h-10 bg-white/10 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

