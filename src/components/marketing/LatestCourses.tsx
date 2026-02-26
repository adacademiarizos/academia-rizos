"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  priceCents: number;
  currency: string;
  rentalDays: number | null;
  isActive: boolean;
}

export default function LatestCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setCourses(data.data.slice(0, 6));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-72 h-80 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (courses.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold tracking-wider text-ap-copper uppercase mb-2">
              Academia
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-ap-ivory">
              Lo último de la academia
            </h2>
          </div>
          <Link
            href="/courses"
            className="text-sm text-ap-copper hover:text-ap-copper/80 transition font-medium hidden sm:block"
          >
            Ver todos →
          </Link>
        </div>

        {/* Horizontal Scroll Grid */}
        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="group flex-shrink-0 w-64 md:w-72 cursor-pointer"
            >
              <div className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 transition-all duration-300 group-hover:border-ap-copper/40 group-hover:shadow-lg group-hover:shadow-ap-copper/10 group-hover:-translate-y-1">
                {/* Thumbnail */}
                <div className="relative w-full aspect-video bg-gradient-to-br from-ap-copper/20 to-ap-olive/20 overflow-hidden">
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl text-ap-copper/40 font-bold">
                        {course.title.charAt(0)}
                      </span>
                    </div>
                  )}
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Price badge */}
                  <div className="absolute top-3 right-3 bg-ap-copper text-ap-ivory text-xs font-bold px-2.5 py-1 rounded-full">
                    €{(course.priceCents / 100).toFixed(0)}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-ap-ivory text-sm leading-snug line-clamp-2 mb-2 group-hover:text-ap-copper transition-colors duration-200">
                    {course.title}
                  </h3>
                  <p className="text-xs text-white/50 line-clamp-2">
                    {course.description || "Aprende a tu ritmo con acceso online"}
                  </p>
                  <div className="mt-3 text-xs text-white/30">
                    {course.rentalDays ? `${course.rentalDays} días de acceso` : "Acceso de por vida"}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/courses"
            className="text-sm text-ap-copper hover:text-ap-copper/80 transition font-medium"
          >
            Ver todos los cursos →
          </Link>
        </div>
      </div>
    </section>
  );
}
