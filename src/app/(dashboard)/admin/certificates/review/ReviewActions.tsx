"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

type Answer = {
  questionId: string;
  questionTitle: string;
  questionType: string;
  answer: string;
  isCorrect: boolean | null;
};

type CourseTestPending = {
  id: string;
  submissionId: string;
  courseId: string;
  testId: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  testTitle: string;
  score: number | null;
  submittedAt: string;
  answers: Answer[];
};

type ExamPending = {
  id: string;
  submissionId: string;
  courseId: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  score: number;
  submittedAt: string;
};

export function CourseTestReviewCard({ item }: { item: CourseTestPending }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function handleAction(status: "APPROVED" | "REVISION_REQUESTED") {
    setLoading(status === "APPROVED" ? "approve" : "reject");
    try {
      const res = await fetch(
        `/api/admin/courses/${item.courseId}/tests/${item.testId}/submissions/${item.submissionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert("Error: " + (data.error ?? "Error desconocido"));
        return;
      }
      router.refresh();
    } catch {
      alert("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{item.studentName || item.studentEmail}</span>
            <span className="text-xs text-white/40">{item.studentEmail}</span>
          </div>
          <div className="mt-1 text-xs text-white/60">
            <span className="text-ap-copper font-medium">{item.courseName}</span>
            {" · "}
            <span>{item.testTitle}</span>
            {item.score !== null && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                {Math.round(item.score)}%
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-white/30">
            {new Date(item.submittedAt).toLocaleString("es-ES")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "Ocultar" : "Ver respuestas"}
          </button>
          <button
            onClick={() => handleAction("REVISION_REQUESTED")}
            disabled={loading !== null}
            className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Solicitar revisión
          </button>
          <button
            onClick={() => handleAction("APPROVED")}
            disabled={loading !== null}
            className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition disabled:opacity-50"
          >
            {loading === "approve" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            Aprobar
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-5 py-4 space-y-3">
          {item.answers.map((a) => (
            <div key={a.questionId} className="rounded-xl bg-white/5 p-4">
              <div className="text-xs font-medium text-white/60 mb-1">
                [{a.questionType}] {a.questionTitle}
              </div>
              {a.answer.startsWith("http") ? (
                <a
                  href={a.answer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ap-copper hover:underline break-all"
                >
                  Ver archivo adjunto →
                </a>
              ) : (
                <p className="text-sm text-white/80 whitespace-pre-wrap">{a.answer || "—"}</p>
              )}
              {a.isCorrect !== null && (
                <span
                  className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${
                    a.isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {a.isCorrect ? "Correcto" : "Incorrecto"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExamReviewCard({ item }: { item: ExamPending }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  async function handleAction(status: "APPROVED" | "REVISION_REQUESTED") {
    setLoading(status === "APPROVED" ? "approve" : "reject");
    try {
      const res = await fetch(`/api/admin/courses/${item.courseId}/exam/submissions/${item.submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert("Error: " + (data.error ?? "Error desconocido"));
        return;
      }
      router.refresh();
    } catch {
      alert("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{item.studentName || item.studentEmail}</span>
            <span className="text-xs text-white/40">{item.studentEmail}</span>
          </div>
          <div className="mt-1 text-xs text-white/60">
            <span className="text-ap-copper font-medium">{item.courseName}</span>
            {" · "}
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70">
              {Math.round(item.score)}%
            </span>
            <span className="ml-2 text-xs text-amber-400/70 bg-amber-400/10 px-2 py-0.5 rounded-full">
              Examen Legacy
            </span>
          </div>
          <div className="mt-1 text-xs text-white/30">
            {new Date(item.submittedAt).toLocaleString("es-ES")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowNote((v) => !v)}
            className="text-xs text-white/40 hover:text-white/70 transition"
          >
            + Nota
          </button>
          <button
            onClick={() => handleAction("REVISION_REQUESTED")}
            disabled={loading !== null}
            className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Solicitar revisión
          </button>
          <button
            onClick={() => handleAction("APPROVED")}
            disabled={loading !== null}
            className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition disabled:opacity-50"
          >
            {loading === "approve" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            Aprobar
          </button>
        </div>
      </div>
      {showNote && (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota para el estudiante (opcional)..."
            rows={2}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-ap-copper/50"
          />
        </div>
      )}
    </div>
  );
}
