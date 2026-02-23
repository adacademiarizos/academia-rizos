'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardData {
  stats: {
    coursesEnrolled: number
    modulesCompleted: number
    testsPassed: number
    lastActivityAt: string | null
  }
  engagementStats: {
    commentsCount: number
    likesCount: number
    followersCount: number
  }
  coursesProgress: Array<{
    courseId: string
    courseTitle: string
    percentComplete: number
    status: string
  }>
  achievements: Array<{
    id: string
    type: string
    name: string
    description: string
    earnedAt: string
  }>
}

export function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/me/stats')
        if (response.ok) {
          const result = await response.json()
          setData(result.data)
        } else {
          setError('Error al cargar el dashboard')
        }
      } catch {
        setError('Error al cargar el dashboard')
      } finally {
        setIsLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  if (isLoading) {
    return <div className="text-center py-16 text-white/40">Cargando dashboard...</div>
  }

  if (error || !data) {
    return <div className="text-center py-16 text-red-400">{error}</div>
  }

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { value: data.stats.coursesEnrolled, label: 'Cursos inscritos' },
          { value: data.stats.modulesCompleted, label: 'Módulos completados' },
          { value: data.stats.testsPassed, label: 'Tests aprobados' },
          { value: data.engagementStats.commentsCount, label: 'Comentarios' },
        ].map(({ value, label }) => (
          <div key={label} className="p-6 rounded-2xl bg-white/5 border border-zinc-800">
            <div className="text-3xl font-bold text-ap-copper">{value}</div>
            <p className="text-sm text-white/50 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Active courses */}
      <div className="rounded-2xl bg-white/5 border border-zinc-800 p-6">
        <h2 className="text-lg font-bold text-white mb-5">Cursos activos</h2>
        {data.coursesProgress.length === 0 ? (
          <p className="text-white/40 text-sm">
            No tienes cursos en progreso.{' '}
            <Link href="/courses" className="text-ap-copper hover:text-orange-400 transition">
              Explorar cursos
            </Link>
          </p>
        ) : (
          <div className="space-y-5">
            {data.coursesProgress.map((course) => (
              <div key={course.courseId}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-white text-sm">{course.courseTitle}</h3>
                  <span className="text-xs text-white/50">{course.percentComplete}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-ap-copper h-1.5 rounded-full transition-all"
                    style={{ width: `${course.percentComplete}%` }}
                  />
                </div>
                <div className="mt-2">
                  <Link
                    href={`/learn/${course.courseId}`}
                    className="text-xs text-ap-copper hover:text-orange-400 transition"
                  >
                    Continuar aprendiendo →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achievements */}
      <div className="rounded-2xl bg-white/5 border border-zinc-800 p-6">
        <h2 className="text-lg font-bold text-white mb-5">Logros</h2>
        {data.achievements.length === 0 ? (
          <p className="text-white/40 text-sm">
            Completa cursos y participa en la comunidad para ganar logros.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="rounded-2xl border border-ap-copper/30 bg-ap-copper/10 p-4 text-center"
              >
                <div className="text-4xl mb-2">⭐</div>
                <h3 className="font-semibold text-white text-sm">{achievement.name}</h3>
                <p className="text-xs text-white/50 mt-1">{achievement.description}</p>
                <p className="text-xs text-white/30 mt-2">
                  {new Date(achievement.earnedAt).toLocaleDateString('es-ES')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Community stats */}
      <div className="rounded-2xl bg-ap-copper/10 border border-ap-copper/30 p-6">
        <h2 className="text-lg font-bold text-white mb-5">Tu impacto en la comunidad</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: data.engagementStats.likesCount, label: 'Likes dados' },
            { value: data.engagementStats.commentsCount, label: 'Comentarios' },
            { value: data.engagementStats.followersCount, label: 'Seguidores' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-bold text-ap-copper">{value}</div>
              <p className="text-sm text-white/60 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
