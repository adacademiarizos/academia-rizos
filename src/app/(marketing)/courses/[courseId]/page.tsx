"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Course } from "@/types/academy";
import { LikeButton } from "@/app/components/LikeButton";
import { CommentsSection } from "@/app/components/CommentsSection";

interface CourseDetail extends Course {
  moduleCount: number;
  totalHours: number;
}

export default function CourseLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const sessionId = searchParams.get("session_id");
  const canceled = searchParams.get("canceled");

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "cancelled" | null>(null);

  // Function to check course access
  const checkCourseAccess = async () => {
    try {
      const accessResponse = await fetch(`/api/course-access/${courseId}`);
      if (accessResponse.ok) {
        const accessData = await accessResponse.json();
        setHasAccess(accessData.data.hasAccess);
        return accessData.data.hasAccess;
      }
    } catch (err) {
      console.error("Error checking access:", err);
    }
    return false;
  };

  // Initial fetch of course and access
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}`);
        if (!response.ok) throw new Error("Course not found");
        const data = await response.json();
        setCourse(data.data);
        await checkCourseAccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  // Check for payment status after Stripe redirect
  useEffect(() => {
    if (sessionId) {
      setPaymentStatus("success");
      // Wait for webhook to process (2 seconds should be enough)
      const timer = setTimeout(async () => {
        const hasAccess = await checkCourseAccess();
        if (hasAccess) {
          // Clean up URL
          router.replace(`/courses/${courseId}`);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (canceled) {
      setPaymentStatus("cancelled");
    }
  }, [sessionId, canceled, courseId, router]);

  const handleBuyCourse = async () => {
    // Check if user is authenticated
    try {
      const session = await fetch("/api/auth/session").then((r) => r.json());
      if (!session?.user) {
        // Redirect to login
        window.location.href =
          "/api/auth/signin?callbackUrl=" + window.location.href;
        return;
      }

      setIsCheckingOut(true);
      const res = await fetch(`/api/courses/${courseId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Error: ${data.error || "Checkout failed"}`);
        return;
      }

      // Redirect to Stripe checkout
      window.location.href = data.data.checkoutUrl;
    } catch (error) {
      alert(
        "Error starting checkout: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-ap-bg px-6 py-16">
        <div className="text-center text-zinc-600">Cargando curso...</div>
      </main>
    );
  }

  if (error || !course) {
    return (
      <main className="min-h-screen bg-ap-bg px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-ap-ink mb-4">Curso no encontrado</h1>
          <p className="text-zinc-600 mb-8">{error}</p>
          <Link href="/courses" className="text-ap-copper hover:underline">
            ← Volver al catálogo
          </Link>
        </div>
      </main>
    );
  }

  const totalPriceCents = course.totalPriceCents ?? course.priceCents
  const feeCents = course.feeCents ?? 0
  const priceFormatted = (totalPriceCents / 100).toFixed(2)
  const basePriceFormatted = (course.priceCents / 100).toFixed(2)
  const feeFormatted = (feeCents / 100).toFixed(2)
  const isLifetime = !course.rentalDays
  const accessLabel = isLifetime ? "Acceso de por vida" : `${course.rentalDays} días de acceso`;

  return (
    <main className="min-h-screen bg-ap-bg">
      {/* Hero Section */}
      <section className="px-6 py-12 md:py-20 bg-gradient-to-br from-ap-bg to-ap-bg/50">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6 text-sm text-zinc-600">
            <Link href="/courses" className="hover:text-ap-copper">Cursos</Link>
            <span className="mx-2">/</span>
            <span className="text-ap-ink font-medium">{course.title}</span>
          </div>

          {/* Hero Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Content */}
            <div className="space-y-6">
              <h1 className="font-main text-4xl md:text-5xl font-bold text-ap-ink">
                {course.title}
              </h1>

              <p className="text-lg text-zinc-700">
                {course.description}
              </p>

              {/* Course Stats */}
              <div className="grid grid-cols-3 gap-4 py-6 border-y border-zinc-200">
                <div>
                  <div className="text-2xl font-bold text-ap-copper">
                    {course.moduleCount}
                  </div>
                  <div className="text-sm text-zinc-600">Módulos</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ap-copper">
                    {Math.floor(course.totalHours || 5)}h
                  </div>
                  <div className="text-sm text-zinc-600">De contenido</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ap-copper">
                    {isLifetime ? "∞" : course.rentalDays}
                  </div>
                  <div className="text-sm text-zinc-600">
                    {isLifetime ? "Acceso" : "Días"}
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-4 flex-col sm:flex-row">
                {hasAccess ? (
                  <Link
                    href={`/learn/${courseId}`}
                    className="px-8 py-3 rounded-full bg-ap-copper text-ap-ivory font-medium text-center hover:bg-ap-copper/90 transition shadow-md"
                  >
                    Continuar Aprendiendo
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={handleBuyCourse}
                      disabled={isCheckingOut}
                      className="px-8 py-3 rounded-full bg-ap-copper text-ap-ivory font-medium hover:bg-ap-copper/90 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCheckingOut ? "Cargando..." : `Comprar Curso - €${priceFormatted}`}
                    </button>
                    <button className="px-8 py-3 rounded-full border-2 border-ap-copper text-ap-copper font-medium hover:bg-ap-copper/10 transition">
                      Más Información
                    </button>
                  </>
                )}
              </div>

              {/* Access Info */}
              <div className="text-sm text-zinc-600 space-y-1">
                <p>✓ {accessLabel}</p>
                <p>✓ Acceso en dispositivos múltiples</p>
                <p>✓ Descarga certificado al completar</p>
                
              </div>
            </div>

            {/* Right: Image Placeholder */}
            <div className="hidden md:flex items-center justify-center">
              <div className="w-full aspect-square rounded-3xl bg-gradient-to-br from-ap-copper/30 to-ap-olive/30 flex items-center justify-center">
                <div className="text-6xl text-ap-copper/50">{course.title.charAt(0)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="px-6">
        <div className="max-w-3xl mx-auto h-px bg-zinc-200"></div>
      </div>

      {/* Payment Status Messages */}
      {paymentStatus === "success" && hasAccess && (
        <div className="px-6 py-6 bg-green-50 border-t border-green-200">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <h3 className="font-bold text-green-900">¡Pago Exitoso!</h3>
              <p className="text-sm text-green-800">Ya tienes acceso al curso. ¡Comienza a aprender ahora!</p>
            </div>
          </div>
        </div>
      )}

      {paymentStatus === "cancelled" && (
        <div className="px-6 py-6 bg-yellow-50 border-t border-yellow-200">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-900">Pago Cancelado</h3>
              <p className="text-sm text-yellow-800">Si lo deseas, puedes intentar de nuevo cuando estés listo.</p>
            </div>
          </div>
        </div>
      )}

      {/* What You'll Learn */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-ap-ink mb-8">
            Lo que aprenderás
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Técnicas fundamentales de cuidado de rizos",
              "Productos adecuados para tu tipo de rizo",
              "Métodos de secado sin daño",
              "Styling profesional paso a paso",
              "Nutrición y salud del cabello rizado",
              "Solución de problemas comunes",
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="text-ap-copper text-xl flex-shrink-0">✓</span>
                <span className="text-zinc-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Preview */}
      <section className="px-6 py-16 bg-white/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-ap-ink mb-8">
            Contenido del Curso
          </h2>

          <div className="space-y-3">
            {Array.from({ length: Math.min(course.moduleCount, 6) }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/60 border border-zinc-200 hover:border-ap-copper transition"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-ap-copper/20 text-ap-copper font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-ap-ink">
                    Módulo {idx + 1}: Contenido del módulo
                  </div>
                  <div className="text-sm text-zinc-600">
                    5-15 minutos de video + materiales
                  </div>
                </div>
                <div className="text-ap-copper text-sm font-medium">
                  Acceso {hasAccess ? "✓" : "Bloqueado"}
                </div>
              </div>
            ))}
            {course.moduleCount > 6 && (
              <div className="text-center text-sm text-zinc-600 py-4">
                + {course.moduleCount - 6} módulos más
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reviews/Testimonials */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-ap-ink mb-8">
            Lo que dicen nuestras estudiantes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                name: "María",
                text: "Excelente curso, muy práctico y fácil de seguir. Mis rizos nunca se vieron mejor.",
                rating: 5,
              },
              {
                name: "Lucas",
                text: "Las técnicas son increíbles y los materiales están muy bien organizados.",
                rating: 5,
              },
            ].map((review, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white/55 border border-zinc-200 backdrop-blur-md"
              >
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <span key={i} className="text-ap-copper text-lg">★</span>
                  ))}
                </div>
                <p className="text-zinc-700 mb-4">{review.text}</p>
                <p className="font-medium text-ap-ink">{review.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      {!hasAccess && (
        <section className="px-6 py-16 bg-gradient-to-r from-ap-copper/10 to-ap-olive/10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold text-ap-ink">
              ¿Listo para comenzar?
            </h2>
            <p className="text-lg text-zinc-700">
              Acceso completo, de por vida, con certificado de finalización
            </p>
            <button
              onClick={handleBuyCourse}
              disabled={isCheckingOut}
              className="px-12 py-4 rounded-full bg-ap-copper text-ap-ivory font-bold text-lg hover:bg-ap-copper/90 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? "Cargando..." : `Comprar ahora - €${priceFormatted}`}
            </button>
          </div>
        </section>
      )}

      {/* Community Section */}
      <section className="px-6 py-16 border-t border-zinc-200">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Like Section */}
          <div>
            <h3 className="text-2xl font-bold text-ap-ink mb-4">¿Qué te pareció este curso?</h3>
            <LikeButton targetType="COURSE" courseId={courseId} />
          </div>

          {/* Comments Section */}
          <div>
            <CommentsSection targetType="COURSE" courseId={courseId} />
          </div>
        </div>
      </section>
    </main>
  );
}
