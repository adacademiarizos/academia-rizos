"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  type: "MULTIPLE_CHOICE" | "WRITTEN" | "FILE_UPLOAD";
  title: string;
  description: string | null;
  order: number;
  config: Record<string, any>;
}

interface TestStatus {
  attemptsUsed: number;
  maxAttempts: number;
  attemptsRemaining: number | null;
  bestScore: number | null;
  alreadyPassed: boolean;
  passingScore: number;
}

interface TestInfo {
  id: string;
  title: string;
  description: string | null;
  isFinalExam: boolean;
  maxAttempts: number;
  passingScore: number;
  _count: { questions: number };
}

export default function CourseTestPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const testId = params.testId as string;

  const [test, setTest] = useState<TestInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadAll();
  }, [courseId, testId]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [testsRes, questionsRes, statusRes] = await Promise.all([
        fetch(`/api/student/courses/${courseId}/tests`),
        fetch(`/api/student/courses/${courseId}/tests/${testId}/questions`),
        fetch(`/api/student/courses/${courseId}/tests/${testId}/status`),
      ]);

      if (!testsRes.ok || !questionsRes.ok) {
        setError("No tienes acceso a este test.");
        return;
      }

      const testsData = await testsRes.json();
      const testInfo = (testsData.data || []).find((t: TestInfo) => t.id === testId);
      if (!testInfo) {
        setError("Test no encontrado.");
        return;
      }
      setTest(testInfo);

      const questionsData = await questionsRes.json();
      setQuestions(questionsData.data || []);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData.data);
      }
    } catch {
      setError("Error cargando el test.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    setUploadingFor(questionId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/student/uploads", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Error al subir el archivo");
        return;
      }
      const data = await res.json();
      setAnswers((prev) => ({ ...prev, [questionId]: data.data.fileUrl }));
    } catch {
      alert("Error al subir el archivo");
    } finally {
      setUploadingFor(null);
    }
  };

  const handleSubmit = async () => {
    // Validate all questions answered
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      alert(`Por favor responde todas las preguntas (${unanswered.length} sin responder)`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/courses/${courseId}/tests/${testId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.data);
        // Refresh status
        const statusRes = await fetch(`/api/student/courses/${courseId}/tests/${testId}/status`);
        if (statusRes.ok) {
          const s = await statusRes.json();
          setStatus(s.data);
        }
      } else {
        alert(data.error || "Error al enviar el test");
      }
    } catch {
      alert("Error al enviar el test");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="text-center text-ap-ivory">Cargando...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href={`/learn/${courseId}`} className="text-zinc-400 hover:text-ap-copper text-sm">
            ← Volver al curso
          </Link>
          <p className="text-red-400 mt-4">{error}</p>
        </div>
      </main>
    );
  }

  // === Result Screen ===
  if (result) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href={`/learn/${courseId}`} className="text-zinc-400 hover:text-ap-copper text-sm">
            ← Volver al curso
          </Link>

          <div className="mt-8 p-8 rounded-2xl bg-white/5 border border-zinc-700 text-center space-y-4">
            <div className="text-5xl">
              {(result.hasManualReview || result.isFinalExam) ? "⏳" : result.isPassed ? "🎉" : "😕"}
            </div>
            <h2 className="text-2xl font-bold text-ap-ivory">
              {(result.hasManualReview || result.isFinalExam)
                ? "Entrega recibida"
                : result.isPassed
                ? "¡Aprobado!"
                : "No aprobado"}
            </h2>

            {(result.hasManualReview || result.isFinalExam) ? (
              <div className="space-y-2">
                {result.score !== null && (
                  <div>
                    <span className="text-4xl font-bold text-ap-copper">{Math.round(result.score)}%</span>
                    <p className="text-sm text-zinc-400 mt-1">Puntaje obtenido</p>
                  </div>
                )}
                <p className="text-zinc-400">
                  Tu respuesta fue recibida y está pendiente de revisión. El administrador la revisará pronto.
                </p>
              </div>
            ) : (
              <>
                {result.score !== null && (
                  <div>
                    <span className="text-4xl font-bold text-ap-copper">{Math.round(result.score)}%</span>
                    <p className="text-sm text-zinc-400 mt-1">Puntaje mínimo: {result.passingScore}%</p>
                  </div>
                )}
                <p className="text-zinc-400">
                  Intento {result.attemptNumber}
                  {result.maxAttempts > 0 ? ` de ${result.maxAttempts}` : ""}
                  {result.attemptsRemaining !== null && result.attemptsRemaining > 0
                    ? ` · ${result.attemptsRemaining} intento${result.attemptsRemaining !== 1 ? "s" : ""} restante${result.attemptsRemaining !== 1 ? "s" : ""}`
                    : ""}
                </p>
              </>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <Link
                href={`/learn/${courseId}`}
                className="px-5 py-2 rounded-xl bg-white/10 text-white/80 hover:bg-white/15 transition text-sm font-medium"
              >
                Volver al curso
              </Link>
              {!result.isPassed && !result.hasManualReview && !result.isFinalExam && (result.attemptsRemaining === null || result.attemptsRemaining > 0) && (
                <button
                  onClick={() => { setResult(null); setAnswers({}); }}
                  className="px-5 py-2 rounded-xl bg-ap-copper hover:bg-orange-700 text-white transition text-sm font-medium"
                >
                  Intentar de nuevo
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Can't take test (attempts exhausted / already passed)
  const canTake = !status?.alreadyPassed &&
    (status === null || status.maxAttempts === 0 || status.attemptsRemaining === null || status.attemptsRemaining > 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-ap-ink/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <Link href={`/learn/${courseId}`} className="text-zinc-400 hover:text-ap-copper transition text-sm">
              ← Volver al curso
            </Link>
            <h1 className="font-main text-xl font-bold text-ap-ivory mt-1">
              {test?.title}
              {test?.isFinalExam && (
                <span className="ml-2 text-sm font-normal bg-ap-copper text-white rounded-full px-2 py-0.5">
                  Examen Final
                </span>
              )}
            </h1>
          </div>

          {/* Attempt info */}
          {status && (
            <div className="text-right text-sm">
              {status.alreadyPassed ? (
                <span className="text-green-400 font-medium">✓ Aprobado</span>
              ) : status.maxAttempts > 0 ? (
                <span className="text-zinc-400">
                  Intento {status.attemptsUsed + 1} de {status.maxAttempts}
                </span>
              ) : (
                <span className="text-zinc-400">Intentos ilimitados</span>
              )}
              {status.bestScore !== null && (
                <div className="text-ap-copper font-bold">Mejor: {Math.round(status.bestScore)}%</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Test Content */}
      <div className="px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {test?.description && (
            <p className="text-zinc-400">{test.description}</p>
          )}

          {/* Already passed */}
          {status?.alreadyPassed && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              ✓ Ya aprobaste este test con {Math.round(status.bestScore ?? 0)}%. Puedes volver a tomarlo si quieres.
            </div>
          )}

          {/* No attempts left */}
          {!canTake && !status?.alreadyPassed && (
            <div className="p-4 rounded-xl bg-white/5 border border-zinc-700 text-zinc-400 text-sm">
              Sin intentos restantes. Contacta al administrador si necesitas más intentos.
            </div>
          )}

          {/* Questions */}
          {canTake && questions.map((q, idx) => (
            <div key={q.id} className="p-6 rounded-2xl bg-white/5 border border-zinc-700">
              <div className="flex items-start gap-3 mb-4">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-ap-copper/20 text-ap-copper text-sm font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-ap-ivory font-medium">{q.title}</p>
                  {q.description && <p className="text-sm text-zinc-400 mt-1">{q.description}</p>}
                  <span className="text-xs text-zinc-500 mt-1 inline-block">
                    {q.type === "MULTIPLE_CHOICE" ? "Selección múltiple" : q.type === "WRITTEN" ? "Respuesta escrita" : "Subir archivo"}
                  </span>
                </div>
              </div>

              {/* MULTIPLE_CHOICE */}
              {q.type === "MULTIPLE_CHOICE" && (
                <div className="space-y-2 ml-10">
                  {(q.config.options || []).map((opt: string) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        answers[q.id] === opt
                          ? "border-ap-copper bg-ap-copper/10 text-ap-ivory"
                          : "border-zinc-700 hover:border-zinc-600 text-zinc-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        className="accent-ap-copper"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {/* WRITTEN */}
              {q.type === "WRITTEN" && (
                <div className="ml-10">
                  <textarea
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Escribe tu respuesta aquí..."
                    className="w-full bg-white/10 border border-zinc-700 text-ap-ivory placeholder:text-zinc-500 rounded-xl px-4 py-3 outline-none focus:border-ap-copper/50 transition text-sm min-h-[120px]"
                  />
                </div>
              )}

              {/* FILE_UPLOAD */}
              {q.type === "FILE_UPLOAD" && (
                <div className="ml-10">
                  {answers[q.id] ? (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                      <p className="text-sm text-green-400">✓ Archivo subido</p>
                      <p className="text-xs text-zinc-400 truncate mt-1">{answers[q.id]}</p>
                      <button
                        onClick={() => setAnswers((prev) => { const n = {...prev}; delete n[q.id]; return n; })}
                        className="text-xs text-red-400 hover:text-red-300 mt-2 transition"
                      >
                        Cambiar archivo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        ref={(el) => { fileInputRefs.current[q.id] = el; }}
                        className="hidden"
                        accept="image/*,video/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(q.id, file);
                        }}
                      />
                      <button
                        onClick={() => fileInputRefs.current[q.id]?.click()}
                        disabled={uploadingFor === q.id}
                        className="w-full py-3 border-2 border-dashed border-zinc-600 rounded-xl text-zinc-400 hover:border-ap-copper hover:text-ap-copper transition text-sm font-medium disabled:opacity-50"
                      >
                        {uploadingFor === q.id ? "Subiendo..." : "📎 Seleccionar foto, video o PDF"}
                      </button>
                      <p className="text-xs text-zinc-500 mt-1">Imágenes, videos y PDFs. Máximo 100 MB.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Submit Button */}
          {canTake && questions.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 bg-ap-copper hover:bg-orange-700 text-white rounded-2xl font-semibold text-base transition disabled:opacity-50"
            >
              {submitting ? "Enviando..." : "Enviar respuestas"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
