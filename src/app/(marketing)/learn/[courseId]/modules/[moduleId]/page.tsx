"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LikeButton } from "@/app/components/LikeButton";
import { CommentsSection } from "@/app/components/CommentsSection";
import ModuleTestSubmission from "@/app/components/ModuleTestSubmission";
import { ChatWidget } from "@/app/components/ChatWidget";
import { CourseAIAssistant } from "@/app/components/CourseAIAssistant";

interface Module {
  id: string;
  title: string;
  description?: string;
  order: number;
  videoUrl?: string;
  videoFileUrl?: string;
  transcript?: string;
  completed: boolean;
}

interface ModulePageData {
  module: Module;
  courseId: string;
  courseName: string;
  nextModuleId?: string;
  previousModuleId?: string;
}

interface ModuleResource {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  order: number;
}

interface Lesson {
  id: string;
  order: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  videoFileUrl: string | null;
  transcript: string | null;
}

export default function ModulePlayer() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const moduleId = params.moduleId as string;

  const [data, setData] = useState<ModulePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "transcript">("description");
  const [tests, setTests] = useState<any[]>([]);
  const [resources, setResources] = useState<ModuleResource[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const modulesResponse = await fetch(`/api/courses/${courseId}/modules`);
        if (!modulesResponse.ok) throw new Error("Failed to fetch modules");
        const modulesData = await modulesResponse.json();

        const currentModule = modulesData.data.modules.find(
          (m: any) => m.id === moduleId
        );

        if (!currentModule) throw new Error("Module not found");

        const courseResponse = await fetch(`/api/courses/${courseId}`);
        const courseData = await courseResponse.json();

        const allModules = modulesData.data.modules;
        const currentIndex = allModules.findIndex((m: any) => m.id === moduleId);
        const nextModule = allModules[currentIndex + 1];
        const previousModule = allModules[currentIndex - 1];

        setData({
          module: currentModule,
          courseId,
          courseName: courseData.data.title,
          nextModuleId: nextModule?.id,
          previousModuleId: previousModule?.id,
        });

        // Fetch lessons for this module
        const lessonsRes = await fetch(`/api/student/modules/${moduleId}/lessons`);
        if (lessonsRes.ok) {
          const lessonsData = await lessonsRes.json();
          const fetchedLessons: Lesson[] = lessonsData.data || [];
          setLessons(fetchedLessons);
          if (fetchedLessons.length > 0) setActiveLessonId(fetchedLessons[0].id);
        }

        // Fetch tests for this module
        const testsResponse = await fetch(`/api/student/modules/${moduleId}/tests`);
        if (testsResponse.ok) {
          const testsData = await testsResponse.json();
          setTests(testsData.data || []);
        }

        // Fetch resources for this module
        const resourcesResponse = await fetch(`/api/student/modules/${moduleId}/resources`);
        if (resourcesResponse.ok) {
          const resourcesData = await resourcesResponse.json();
          setResources(resourcesData.data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [courseId, moduleId]);

  const handleMarkComplete = async () => {
    if (!data) return;

    setCompleting(true);
    try {
      const response = await fetch(`/api/modules/${moduleId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      if (!response.ok) throw new Error("Failed to mark module complete");

      setData((prev) =>
        prev ? { ...prev, module: { ...prev.module, completed: true } } : null
      );

      setTimeout(() => {
        router.push(`/learn/${courseId}`);
      }, 1000);
    } catch (err) {
      console.error("Error:", err);
      alert("Error marking module complete");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="text-center text-ap-ivory">Cargando módulo...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-ap-ivory mb-4">Error</h1>
          <p className="text-zinc-300 mb-8">{error}</p>
          <Link href={`/learn/${courseId}`} className="text-ap-copper hover:underline">
            ← Volver al curso
          </Link>
        </div>
      </main>
    );
  }

  const { module, courseId: cId, courseName } = data;
  const hasLessons = lessons.length > 0;
  const activeLesson = lessons.find((l) => l.id === activeLessonId);

  const videoSrc = hasLessons
    ? (activeLesson?.videoFileUrl || activeLesson?.videoUrl || "")
    : (module.videoFileUrl || module.videoUrl || "");

  const contentTitle = hasLessons ? (activeLesson?.title || "") : module.title;
  const contentDescription = hasLessons
    ? (activeLesson?.description || null)
    : (module.description || null);
  const contentTranscript = hasLessons
    ? (activeLesson?.transcript || null)
    : (module.transcript || null);

  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black">
      {/* Sticky Header */}
      <div className="sticky top-16 z-10 border-b border-zinc-800 bg-ap-ink/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/learn/${cId}`}
                className="text-zinc-400 hover:text-ap-copper transition text-sm"
              >
                ← {courseName}
              </Link>
              <h1 className="font-main text-xl font-bold text-ap-ivory mt-1">
                Módulo {module.order}: {module.title}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row min-h-0">
        {/* Left Sidebar */}
        <aside className="lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-700 bg-ap-ink/60 overflow-y-auto">
          <div className="p-4 space-y-6">

            {/* Lesson List */}
            {hasLessons && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Lecciones
                </h3>
                <div className="space-y-1">
                  {lessons.map((lesson) => {
                    const isActive = lesson.id === activeLessonId;
                    const hasVideo = !!(lesson.videoFileUrl || lesson.videoUrl);
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setActiveLessonId(lesson.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-start gap-3 ${
                          isActive
                            ? "bg-ap-copper/15 border border-ap-copper/30 text-ap-ivory"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <span className={`mt-0.5 text-xs font-bold shrink-0 w-5 text-center ${isActive ? "text-ap-copper" : "text-zinc-600"}`}>
                          {lesson.order + 1}
                        </span>
                        <span className="flex-1 text-sm leading-snug">{lesson.title}</span>
                        {hasVideo && (
                          <span className="shrink-0 mt-0.5 text-xs text-zinc-600">▶</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resources */}
            {resources.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Recursos
                </h3>
                <div className="space-y-1">
                  {resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full py-2 px-3 rounded-lg text-zinc-400 hover:text-ap-ivory hover:bg-white/5 transition text-sm"
                    >
                      <span className="text-base shrink-0">
                        {resource.fileType === "pdf" ? "📄" : resource.fileType === "image" ? "🖼️" : resource.fileType === "document" ? "📝" : "📎"}
                      </span>
                      <span className="flex-1 truncate">{resource.title}</span>
                      <span className="text-xs text-zinc-600 shrink-0">
                        {resource.fileSize < 1024 * 1024
                          ? `${Math.round(resource.fileSize / 1024)} KB`
                          : `${(resource.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="p-4 rounded-2xl bg-white/5 border border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Estado</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    module.completed
                      ? "bg-ap-copper/20 text-ap-copper"
                      : "bg-zinc-700/50 text-zinc-300"
                  }`}
                >
                  {module.completed ? "✓ Completado" : "En progreso"}
                </span>
              </div>

              {!module.completed && (
                <button
                  onClick={handleMarkComplete}
                  disabled={completing}
                  className="w-full py-2.5 rounded-lg bg-ap-copper text-ap-ink font-semibold hover:bg-ap-copper/90 transition disabled:opacity-50 text-sm"
                >
                  {completing ? "Guardando..." : "Marcar como completado"}
                </button>
              )}
            </div>

            {/* Navigation */}
            <div className="space-y-2">
              {data.previousModuleId && (
                <Link href={`/learn/${cId}/modules/${data.previousModuleId}`}>
                  <button className="w-full py-2.5 rounded-lg bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 transition font-medium text-sm">
                    ← Módulo anterior
                  </button>
                </Link>
              )}
              {data.nextModuleId && (
                <Link href={`/learn/${cId}/modules/${data.nextModuleId}`}>
                  <button className="w-full py-2.5 rounded-lg bg-ap-copper/20 text-ap-copper hover:bg-ap-copper/30 transition font-medium text-sm">
                    Siguiente módulo →
                  </button>
                </Link>
              )}
              <Link href={`/learn/${cId}`}>
                <button className="w-full py-2.5 rounded-lg bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 transition font-medium text-sm">
                  Volver al curso
                </button>
              </Link>
            </div>

          </div>
        </aside>

        {/* Right Main Area */}
        <div className="flex-1 min-w-0 px-6 py-6 space-y-6">
          {/* Video Player */}
          <div className="rounded-3xl overflow-hidden border border-zinc-700 shadow-2xl">
            <div className="aspect-video bg-black flex items-center justify-center">
              {videoSrc ? (
                <video
                  key={videoSrc}
                  src={videoSrc}
                  controls
                  className="w-full h-full"
                  style={{ background: "#000" }}
                >
                  <p className="text-zinc-300">
                    Tu navegador no soporta reproducción de video
                  </p>
                </video>
              ) : (
                <div className="text-zinc-500 text-sm">Sin video disponible</div>
              )}
            </div>
          </div>

          {/* Content title + tabs */}
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-zinc-700">
              <button
                onClick={() => setActiveTab("description")}
                className={`px-6 py-3 font-medium transition text-sm ${
                  activeTab === "description"
                    ? "border-b-2 border-ap-copper text-ap-copper"
                    : "text-zinc-400 hover:text-ap-ivory"
                }`}
              >
                {hasLessons ? "Sobre esta lección" : "Sobre este módulo"}
              </button>
              {contentTranscript && (
                <button
                  onClick={() => setActiveTab("transcript")}
                  className={`px-6 py-3 font-medium transition text-sm ${
                    activeTab === "transcript"
                      ? "border-b-2 border-ap-copper text-ap-copper"
                      : "text-zinc-400 hover:text-ap-ivory"
                  }`}
                >
                  Transcripción
                </button>
              )}
            </div>

            {/* Tab Content */}
            {activeTab === "description" ? (
              <div className="pb-4">
                <h2 className="text-xl font-bold text-ap-ivory mb-2">
                  {contentTitle}
                </h2>
                {contentDescription ? (
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">
                    {contentDescription}
                  </p>
                ) : (
                  <p className="text-zinc-500 italic text-sm">Sin descripción.</p>
                )}
              </div>
            ) : (
              <div className="pb-4 text-zinc-300 whitespace-pre-wrap text-sm">
                {contentTranscript || "No hay transcripción disponible"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Module Tests Section */}
      {tests.length > 0 && (
        <section className="px-6 py-8 border-t border-zinc-700">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-ap-ivory">Tests del módulo</h2>
            {tests.map((test) => (
              <div key={test.id} className="bg-white/5 border border-zinc-700 rounded-2xl p-6">
                <ModuleTestSubmission
                  moduleId={moduleId}
                  testId={test.id}
                  testTitle={test.title}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Community Section */}
      <section className="px-6 py-16 border-t border-zinc-700 bg-white/5">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h3 className="text-2xl font-bold text-ap-ivory mb-4">¿Te fue útil este módulo?</h3>
            <LikeButton targetType="MODULE" moduleId={moduleId} />
          </div>

          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <CommentsSection targetType="MODULE" moduleId={moduleId} />
          </div>
        </div>
      </section>

      {/* Course chat widget — only visible to enrolled students */}
      <CourseAIAssistant courseId={courseId} moduleId={moduleId} courseName={courseName} />
      <ChatWidget courseId={courseId} />
    </main>
  );
}
