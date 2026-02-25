"use client";

import Link from "next/link";
import { Course } from "@/types/academy";

interface CourseCardProps {
  course: Course;
}

export default function CourseCard({ course }: CourseCardProps) {
  const totalPriceCents = course.totalPriceCents ?? course.priceCents
  const priceFormatted = (totalPriceCents / 100).toFixed(2)
  const isLifetime = !course.rentalDays

  const accessLabel = isLifetime ? "Acceso de por vida" : `${course.rentalDays} días`;

  return (
    <Link href={`/courses/${course.id}`}>
      <div className="group h-full rounded-3xl border border-zinc-700 bg-white/5 p-6 shadow-sm transition hover:shadow-md hover:bg-white/75 backdrop-blur-md overflow-hidden">
        {/* Course Image */}
        <div className="relative w-full h-48 mb-4 rounded-2xl overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-ap-copper/20 to-ap-olive/20 flex items-center justify-center">
              <div className="text-4xl text-center text-ap-copper opacity-50">
                {course.title.charAt(0)}
              </div>
            </div>
          )}
        </div>

        {/* Course Info */}
        <div className="space-y-3">
          {/* Title */}
          <h3 className="font-main text-lg font-semibold text-ap-ink line-clamp-2 group-hover:text-ap-copper transition">
            {course.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-zinc-600 line-clamp-2">
            {course.description}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>📚 {course.moduleCount} módulos</span>
          </div>

          {/* Access Type */}
          <div className="text-xs font-medium text-ap-olive bg-ap-olive/10 px-2.5 py-1 rounded-full w-fit">
            {accessLabel}
          </div>

          {/* Divider */}
          <div className="h-px bg-zinc-200"></div>

          {/* Price */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-ap-copper">
              €{priceFormatted}
            </span>
          </div>

          {/* CTA Button */}
          <button className="w-full mt-4 rounded-full bg-ap-copper text-ap-ivory py-2.5 font-medium text-sm transition hover:bg-ap-copper/90 hover:shadow-md">
            Ver Curso
          </button>
        </div>
      </div>
    </Link>
  );
}
