"use client";

import { useEffect, useState } from "react";
import CourseCard from "@/components/academy/CourseCard";
import { Course } from "@/types/academy";
import SectionHead from "@/components/marketing/SectionHead";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch("/api/courses");
        if (!response.ok) throw new Error("Failed to fetch courses");
        const data = await response.json();
        setCourses(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-ap-bg px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <p className="text-zinc-600">Cargando cursos...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ap-bg px-6 py-16">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <SectionHead
            kicker="Academia"
            title="Catálogo de Cursos"
            subtitle="Aprende todo lo que necesitas saber sobre cuidado y estilismo de rizos"
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <p>Error cargando cursos: {error}</p>
          </div>
        )}

        {/* Courses Grid */}
        {courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-600">No hay cursos disponibles en este momento.</p>
          </div>
        )}
      </div>
    </main>
  );
}
