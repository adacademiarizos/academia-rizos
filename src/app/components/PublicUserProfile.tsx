'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ActivityFeed } from './ActivityFeed'

interface UserProfile {
  id: string
  name: string
  image: string | null
  createdAt: string
  stats: {
    coursesEnrolled: number
    modulesCompleted: number
    testsPassed: number
  }
  courseProgress: Array<{
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

interface PublicUserProfileProps {
  userId: string
}

export function PublicUserProfile({ userId }: PublicUserProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [userId])

  const fetchProfile = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/users/${userId}/profile`)
      if (response.ok) {
        const result = await response.json()
        setProfile(result.data)
      } else if (response.status === 404) {
        setError('Usuario no encontrado')
      } else {
        setError('Error loading profile')
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Error loading profile')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Cargando perfil...</div>
  }

  if (error || !profile) {
    return <div className="text-center py-12 text-red-600">{error}</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-start space-x-6">
          {profile.image ? (
            <Image
              src={profile.image}
              alt={profile.name || 'User'}
              width={120}
              height={120}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{profile.name}</h1>
            <p className="text-gray-600 mt-1">
              Miembro desde{' '}
              {new Date(profile.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
              })}
            </p>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-ap-copper">
                  {profile.stats.coursesEnrolled}
                </p>
                <p className="text-sm text-gray-600">Cursos inscritos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ap-copper">
                  {profile.stats.modulesCompleted}
                </p>
                <p className="text-sm text-gray-600">Módulos completados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ap-copper">
                  {profile.achievements.length}
                </p>
                <p className="text-sm text-gray-600">Logros obtenidos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {profile.achievements.length > 0 && (
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Logros</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="border-2 border-ap-copper rounded-lg p-4 text-center bg-gradient-to-b from-orange-50 to-white"
              >
                <div className="text-4xl mb-2">⭐</div>
                <h3 className="font-semibold text-gray-900">{achievement.name}</h3>
                <p className="text-sm text-gray-600 mt-2">{achievement.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Progress */}
      {profile.courseProgress.length > 0 && (
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Cursos en progreso</h2>
          <div className="space-y-4">
            {profile.courseProgress.map((course) => (
              <div key={course.courseId} className="border-b pb-4 last:border-b-0">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900">{course.courseTitle}</h3>
                  <span className="text-sm font-medium text-ap-copper">
                    {course.percentComplete}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-ap-copper h-2 rounded-full transition-all"
                    style={{ width: `${course.percentComplete}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Actividad reciente</h2>
        <ActivityFeed userId={userId} limit={15} />
      </div>
    </div>
  )
}
