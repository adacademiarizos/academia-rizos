"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Course } from "@/types/academy";
import { ChatWidget } from "@/app/components/ChatWidget";
import { CourseAIAssistant } from "@/app/components/CourseAIAssistant";

interface Module {
  id: string;
  title: string;
  order: number;
  duration?: number;
  completed?: boolean;
}

interface CourseTestItem {
  id: string;
  title: string;
  description: string | null;
  order: number;
  isRequired: boolean;
  isFinalExam: boolean;
  maxAttempts: number;
  passingScore: number;
  _count: { questions: number };
}

interface DashboardData {
  course: Course;
  modules: Module[];
  progress: number;
  allModulesCompleted: boolean;
  courseTests: CourseTestItem[];
}

export default function LearningDashboard() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        // Fetch course details
        const courseResponse = await fetch(`/api/courses/${courseId}`);
        if (!courseResponse.ok) throw new Error("Course not found");
        const courseData = await courseResponse.json();

        // Fetch modules with progress
        const modulesResponse = await fetch(`/api/courses/${courseId}/modules`);
        if (!modulesResponse.ok) throw new Error("Failed to fetch modules");
        const modulesData = await modulesResponse.json();

        // Fetch course tests
        let courseTests: CourseTestItem[] = [];
        try {
          const testsResponse = await fetch(`/api/student/courses/${courseId}/tests`);
          if (testsResponse.ok) {
            const testsData = await testsResponse.json();
            courseTests = testsData.data || [];
          }
        } catch {
          // Course tests are optional — don't fail the whole page
        }

        setData({
          course: courseData.data,
          modules: modulesData.data.modules,
          progress: modulesData.data.progress,
          allModulesCompleted: modulesData.data.progress === 100,
          courseTests,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [courseId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="text-center text-ap-ivory">Cargando dashboard...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-ap-ivory mb-4">Error</h1>
          <p className="text-zinc-300 mb-8">{error}</p>
          <Link href="/courses" className="text-ap-copper hover:underline">
            ← Volver al catálogo
          </Link>
        </div>
      </main>
    );
  }

  const priceUSD = (data.course.priceCents / 100).toFixed(2);

  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black">
      {/* Header */}
      <div className="sticky top-16 z-10 border-b border-zinc-800 bg-ap-ink/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/courses" className="text-zinc-400 hover:text-ap-copper transition text-sm">
                ← Volver a cursos
              </Link>
              <h1 className="font-main text-2xl font-bold text-ap-ivory mt-1">
                {data.course.title}
              </h1>
            </div>

            {/* Progress Summary */}
            <div className="text-right">
              <div className="text-3xl font-bold text-ap-copper">
                {Math.round(data.progress)}%
              </div>
              <div className="text-sm text-zinc-400">completado</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ap-copper to-ap-olive transition-all duration-500"
              style={{ width: `${data.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column - Modules */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-ap-ivory mb-6">
              Contenido ({data.modules.length} módulos)
            </h2>

            {data.modules.map((module) => (
              <Link
                key={module.id}
                href={`/learn/${courseId}/modules/${module.id}`}
              >
                <div className="group p-6 rounded-2xl bg-white/5 border border-zinc-700 hover:border-ap-copper hover:bg-white/10 transition cursor-pointer">
                  <div className="flex items-start gap-4">
                    {/* Module Number */}
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-ap-copper/20 text-ap-copper font-bold flex-shrink-0 group-hover:bg-ap-copper/30 transition">
                      {module.order}
                    </div>

                    {/* Module Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-ap-ivory group-hover:text-ap-copper transition">
                        {module.title}
                      </h3>
                      <p className="text-sm text-zinc-400 mt-1">
                        {module.duration ? `${module.duration} minutos` : "Contenido multimedia"}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {module.completed ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-ap-copper flex items-center justify-center">
                            <span className="text-sm font-bold text-ap-ink">✓</span>
                          </div>
                          <span className="text-sm text-ap-copper font-medium">Completado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-zinc-600"></div>
                          <span className="text-sm text-zinc-400">Pendiente</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Course Tests or Legacy Final Exam */}
            <div className="mt-8 pt-8 border-t border-zinc-700">
              {data.courseTests.length > 0 ? (
                <>
                  <h2 className="text-xl font-bold text-ap-ivory mb-6">Tests y Evaluaciones</h2>
                  <div className="space-y-3">
                    {data.courseTests
                      .sort((a, b) => {
                        // Final exam always last
                        if (a.isFinalExam && !b.isFinalExam) return 1;
                        if (!a.isFinalExam && b.isFinalExam) return -1;
                        return a.order - b.order;
                      })
                      .map((test) => (
                        <Link key={test.id} href={`/learn/${courseId}/tests/${test.id}`}>
                          <div className={`p-5 rounded-2xl border transition cursor-pointer group ${
                            test.isFinalExam
                              ? "bg-gradient-to-r from-ap-copper/20 to-ap-olive/20 border-ap-copper hover:border-ap-copper/80 hover:from-ap-copper/30 hover:to-ap-olive/30"
                              : "bg-white/5 border-zinc-700 hover:border-ap-copper hover:bg-white/10"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-bold text-ap-ivory group-hover:text-ap-copper transition">
                                    {test.title}
                                  </h3>
                                  {test.isFinalExam && (
                                    <span className="text-xs bg-ap-copper text-white rounded-full px-2 py-0.5 font-medium">
                                      Examen Final
                                    </span>
                                  )}
                                  {test.isRequired && !test.isFinalExam && (
                                    <span className="text-xs bg-white/10 text-white/60 rounded-full px-2 py-0.5">
                                      Requerido
                                    </span>
                                  )}
                                </div>
                                {test.description && (
                                  <p className="text-sm text-zinc-400">{test.description}</p>
                                )}
                                <p className="text-xs text-zinc-500 mt-1">
                                  {test._count.questions} pregunta{test._count.questions !== 1 ? "s" : ""}
                                  {test.maxAttempts > 0 ? ` · ${test.maxAttempts} intento${test.maxAttempts !== 1 ? "s" : ""}` : " · intentos ilimitados"}
                                </p>
                              </div>
                              <div className="text-2xl flex-shrink-0 ml-4">
                                {test.isFinalExam ? "📋" : "📝"}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-ap-ivory mb-6">Evaluación</h2>
                  {data.allModulesCompleted ? (
                    <Link href={`/learn/${courseId}/test`}>
                      <div className="p-6 rounded-2xl bg-gradient-to-r from-ap-copper/20 to-ap-olive/20 border-2 border-ap-copper cursor-pointer hover:border-ap-copper/80 hover:from-ap-copper/30 hover:to-ap-olive/30 transition">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-ap-ivory">Examen Final</h3>
                            <p className="text-sm text-zinc-300 mt-1">
                              ¡Todos los módulos completados! Realiza el examen y obtén tu certificado
                            </p>
                          </div>
                          <div className="text-3xl">📋</div>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white/5 border border-zinc-700 opacity-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-zinc-400">Examen Final</h3>
                          <p className="text-sm text-zinc-500 mt-1">
                            Completa todos los módulos para acceder al examen
                          </p>
                        </div>
                        <div className="text-3xl opacity-50">🔒</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Course Overview Card */}
            <div className="p-6 rounded-2xl bg-white/5 border border-zinc-700 space-y-4">
              <h3 className="font-bold text-ap-ivory">Descripción del Curso</h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {data.course.description}
              </p>

              <div className="space-y-3 pt-4 border-t border-zinc-700 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Módulos</span>
                  <span className="font-semibold text-ap-copper">{data.modules.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Completados</span>
                  <span className="font-semibold text-ap-copper">
                    {data.modules.filter((m) => m.completed).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Progreso</span>
                  <span className="font-semibold text-ap-copper">
                    {Math.round(data.progress)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Resources Card */}
            <div className="p-6 rounded-2xl bg-white/5 border border-zinc-700 space-y-4">
              <h3 className="font-bold text-ap-ivory">Recursos</h3>
              <button className="w-full py-2 rounded-lg bg-ap-copper/20 text-ap-copper hover:bg-ap-copper/30 transition text-sm font-medium">
                Descargar Materiales
              </button>
              <button className="w-full py-2 rounded-lg bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 transition text-sm font-medium">
                Ver Certificado
              </button>
            </div>

            {/* Tips Card */}
            <div className="p-6 rounded-2xl bg-white/5 border border-zinc-700 space-y-3">
              <h3 className="font-bold text-ap-ivory">💡 Consejos</h3>
              <ul className="text-sm text-zinc-300 space-y-2">
                <li>✓ Toma notas mientras aprendes</li>
                <li>✓ Repite los módulos si lo necesitas</li>
                <li>✓ Completa todos antes del examen</li>
              </ul>
            </div>

            {/* Course Chat Card */}
            <Link href={`/learn/${courseId}/chat`}>
              <div className="p-6 rounded-2xl bg-ap-copper/10 border border-ap-copper/30 hover:bg-ap-copper/15 hover:border-ap-copper/50 transition cursor-pointer space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-ap-copper/20 flex items-center justify-center text-lg flex-shrink-0">
                    💬
                  </div>
                  <div>
                    <h3 className="font-bold text-ap-ivory text-sm">Chat del Curso</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Conversa con otros alumnos</p>
                  </div>
                </div>
                <div className="w-full py-2 rounded-lg bg-ap-copper text-white text-sm font-medium text-center">
                  Abrir chat
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Widget */}
      <CourseAIAssistant courseId={courseId} courseName={data.course.title} />
      <ChatWidget courseId={courseId} />
    </main>
  );
}
