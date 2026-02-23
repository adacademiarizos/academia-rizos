'use client'

import Link from 'next/link'

interface CourseProgressCardProps {
  courseId: string
  courseTitle: string
  progress: number
}

export function CourseProgressCard({
  courseId,
  courseTitle,
  progress,
}: CourseProgressCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">{courseTitle}</h3>
          <p className="text-sm text-gray-600 mt-1">{progress}% completado</p>
        </div>
        <Link
          href={`/courses/${courseId}`}
          className="text-ap-copper hover:text-orange-700 text-sm font-medium"
        >
          Ver →
        </Link>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-ap-copper to-orange-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* CTA Button */}
      <Link
        href={`/courses/${courseId}`}
        className="block w-full bg-ap-copper hover:bg-orange-700 text-white text-center py-2 rounded font-medium transition"
      >
        {progress === 100 ? 'Ir al certificado' : 'Continuar aprendiendo'}
      </Link>
    </div>
  )
}
