'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Course {
  id: string
  title: string
  description: string | null
  priceCents: number
  isActive: boolean
  createdAt: string
  moduleCount: number
  enrolledCount: number
}

export default function AdminCoursesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isActive, setIsActive] = useState<boolean | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [feeSettings, setFeeSettings] = useState({ feePercent: 2.5, feeFixedCents: 25 })
  const [newCourse, setNewCourse] = useState<{
    title: string
    description: string
    rentalDays: number | undefined
    isActive: boolean
    thumbnailUrl: string
  }>({
    title: '',
    description: '',
    rentalDays: undefined,
    isActive: true,
    thumbnailUrl: '',
  })
  const [priceInput, setPriceInput] = useState('')
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/signin')
    }
  }, [status])

  useEffect(() => {
    fetchCourses()
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => { if (d.success) setFeeSettings({ feePercent: d.data.feePercent, feeFixedCents: d.data.feeFixedCents }) })
      .catch(() => {})
  }, [isActive])

  const fetchCourses = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (isActive !== 'all') {
        params.set('isActive', String(isActive))
      }

      const response = await fetch(`/api/admin/courses?${params.toString()}`)
      if (response.status === 403) {
        setError('Solo administradores pueden acceder a esta página')
        setTimeout(() => router.push('/'), 2000)
        return
      }

      if (response.ok) {
        const data = await response.json()
        setCourses(data.data || [])
      } else {
        setError('Error loading courses')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error loading courses')
    } finally {
      setIsLoading(false)
    }
  }

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setThumbnailError(null)
    setThumbnailUploading(true)

    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/admin/uploads/image', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error?.message ?? 'Error al subir imagen')
      setNewCourse((prev) => ({ ...prev, thumbnailUrl: data.data.url }))
    } catch (err: any) {
      setThumbnailError(err.message)
    } finally {
      setThumbnailUploading(false)
    }
  }

  const handleCreateCourse = async () => {
    try {
      if (!newCourse.title.trim()) {
        alert('El título del curso es requerido')
        return
      }

      if (!newCourse.thumbnailUrl) {
        alert('La miniatura del curso es requerida')
        return
      }

      const baseVal = parseFloat(priceInput)
      if (!priceInput || isNaN(baseVal) || baseVal <= 0) {
        alert('Ingresá un precio válido mayor a 0')
        return
      }

      const baseCents = Math.round(baseVal * 100)

      const response = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCourse,
          priceCents: baseCents,
          rentalDays: newCourse.rentalDays || undefined,
        }),
      })

      if (response.ok) {
        setShowModal(false)
        setNewCourse({
          title: '',
          description: '',
          rentalDays: undefined,
          isActive: true,
          thumbnailUrl: '',
        })
        setPriceInput('')
        fetchCourses()
        alert('Curso creado exitosamente')
      } else {
        alert('Error creating course')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error creating course')
    }
  }

  const handleNotifyStudents = async (courseId: string, courseTitle: string) => {
    if (!confirm(`¿Enviar notificaciones y emails a todos los estudiantes sobre "${courseTitle}"?`)) return;
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/notify`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        alert(data.data.message);
      } else {
        alert('Error al enviar notificaciones');
      }
    } catch {
      alert('Error al enviar notificaciones');
    }
  };

  const handleDeleteCourse = async (courseId: string, courseTitle: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${courseTitle}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchCourses()
        alert('Curso eliminado exitosamente')
      } else {
        alert('Error deleting course')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error deleting course')
    }
  }

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (status === 'loading' || isLoading) {
    return <div className="text-center py-12 text-white/60">Cargando...</div>
  }

  if (error) {
    return <div className="text-center py-12 text-red-400">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white">Administración de Cursos</h1>
          <p className="text-white/60 mt-1 text-sm">Gestiona todos los cursos de la plataforma</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-ap-copper hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-medium transition"
        >
          + Nuevo Curso
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-4 flex gap-3">
        <input
          type="text"
          placeholder="Buscar cursos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-4 py-2 outline-none focus:border-ap-copper/50 transition"
        />
        <select
          value={isActive === 'all' ? 'all' : String(isActive)}
          onChange={(e) =>
            setIsActive(e.target.value === 'all' ? 'all' : e.target.value === 'true')
          }
          className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 outline-none focus:border-ap-copper/50 transition"
        >
          <option value="all" className="bg-[#1a1a2e]">Todos</option>
          <option value="true" className="bg-[#1a1a2e]">Activos</option>
          <option value="false" className="bg-[#1a1a2e]">Inactivos</option>
        </select>
      </div>

      {/* Courses Table */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] overflow-hidden">
        {filteredCourses.length === 0 ? (
          <div className="p-8 text-center text-white/50">
            No hay cursos disponibles
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-white/60">
                  Título
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-white/60">
                  Módulos
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-white/60">
                  Estudiantes
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-white/60">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-white/60">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-white/60">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredCourses.map((course) => (
                <tr key={course.id} className="hover:bg-white/5 transition">
                  <td className="px-6 py-4 text-sm font-medium">
                    <Link
                      href={`/admin/courses/${course.id}/edit`}
                      className="text-ap-copper hover:text-orange-400 hover:underline transition"
                    >
                      {course.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    {course.moduleCount} módulos
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    {course.enrolledCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    <span className="text-white">€{(course.priceCents / 100).toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        course.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {course.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-3">
                    <Link
                      href={`/admin/courses/${course.id}/edit`}
                      className="text-ap-copper hover:text-orange-400 font-medium transition"
                    >
                      Ver módulos
                    </Link>
                    {course.isActive && (
                      <button
                        onClick={() => handleNotifyStudents(course.id, course.title)}
                        className="text-blue-400 hover:text-blue-300 font-medium transition"
                      >
                        Notificar
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCourse(course.id, course.title)}
                      className="text-red-400 hover:text-red-300 font-medium transition"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal - Create Course */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#181716] border border-white/10 rounded-3xl p-7 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2
              className="text-xl text-white mb-6"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Nuevo curso
            </h2>

            <div className="flex flex-col gap-4">
              {/* Thumbnail upload */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">
                  Miniatura <span className="text-red-400">*</span>
                </label>
                {newCourse.thumbnailUrl ? (
                  <div className="relative w-full h-36 rounded-2xl overflow-hidden">
                    <img src={newCourse.thumbnailUrl} alt="Miniatura" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewCourse((prev) => ({ ...prev, thumbnailUrl: '' }))}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-xl hover:bg-black/80 transition"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 cursor-pointer rounded-2xl border border-dashed border-white/20 hover:border-white/40 transition">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleThumbnailUpload}
                      disabled={thumbnailUploading}
                    />
                    <span className="text-sm text-white/40">
                      {thumbnailUploading ? 'Subiendo…' : 'Seleccionar imagen'}
                    </span>
                    <span className="text-xs text-white/25 mt-1">JPG, PNG, WebP · máx 5 MB</span>
                  </label>
                )}
                {thumbnailError && <p className="text-xs text-red-400 mt-1.5">{thumbnailError}</p>}
              </div>

              <input
                type="text"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                placeholder="Título del curso"
                className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition"
              />

              <textarea
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                placeholder="Descripción (opcional)"
                rows={3}
                className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition resize-none"
              />

              <div>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Precio base (€)"
                  min="0"
                  step="0.01"
                  className="h-11 w-full rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition"
                />
                {priceInput && !isNaN(parseFloat(priceInput)) && parseFloat(priceInput) > 0 && (() => {
                  const baseCents = Math.round(parseFloat(priceInput) * 100)
                  const feeCents = Math.round(baseCents * feeSettings.feePercent / 100) + feeSettings.feeFixedCents
                  const totalCents = baseCents + feeCents
                  return (
                    <p className="text-xs text-white/40 mt-1.5">
                      El cliente paga{' '}
                      <span className="text-[#c8cf94] font-medium">€{(totalCents / 100).toFixed(2)}</span>
                      {' '}(base €{(baseCents / 100).toFixed(2)} + Stripe €{(feeCents / 100).toFixed(2)})
                    </p>
                  )
                })()}
              </div>

              <input
                type="number"
                value={newCourse.rentalDays ?? ''}
                onChange={(e) =>
                  setNewCourse({
                    ...newCourse,
                    rentalDays: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="Días de acceso (vacío = vitalicio)"
                min="1"
                className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition"
              />

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCourse.isActive}
                  onChange={(e) => setNewCourse({ ...newCourse, isActive: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-white/60">Activar curso al crear</span>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowModal(false); setPriceInput('') }}
                className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCourse}
                disabled={!newCourse.thumbnailUrl || thumbnailUploading}
                className="flex-1 h-11 rounded-2xl bg-[#646a40] text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Crear curso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
