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
      <div className="group h-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm transition-all duration-300 hover:bg-white/[0.09] hover:border-ap-copper/30 hover:shadow-ap-copper/10 hover:shadow-lg backdrop-blur-md overflow-hidden">
        {/* Course Image */}
        <div className="relative w-full h-48 mb-4 rounded-2xl overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-ap-copper/20 to-ap-olive/20 flex items-center justify-center">
              <div className="text-4xl text-center text-ap-copper opacity-50">
                {course.title.charAt(0)}
              </div>
            </div>
          )}
        </div>

        {/* Course Info */}
        <div className="space-y-3">
          {/* Title */}
          <h3 className="font-main text-lg font-semibold text-ap-ivory line-clamp-2 group-hover:text-ap-copper transition-colors duration-200">
            {course.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-white/55 line-clamp-2">
            {course.description}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span>📚 {course.moduleCount} módulos</span>
          </div>

          {/* Access Type */}
          <div className="text-xs font-medium text-ap-copper/80 bg-ap-copper/10 border border-ap-copper/20 px-2.5 py-1 rounded-full w-fit">
            {accessLabel}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10"></div>

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
