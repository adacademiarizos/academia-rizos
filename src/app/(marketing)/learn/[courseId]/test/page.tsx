"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface TestQuestion {
  id: string;
  type: "multiple-choice" | "text" | "file-upload";
  question: string;
  options?: string[];
  required?: boolean;
}

interface TestData {
  id: string;
  courseId: string;
  courseName: string;
  questions: TestQuestion[];
  passingScore: number;
}

interface SubmissionData {
  [questionId: string]: string | string[] | File | undefined;
}

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [testData, setTestData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionData>({});
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}/test`);
        if (!response.ok) throw new Error("Failed to fetch test");
        const data = await response.json();
        setTestData(data.data);

        // Initialize submissions object
        const initialSubmissions: SubmissionData = {};
        data.data.questions.forEach((q: TestQuestion) => {
          initialSubmissions[q.id] = undefined;
        });
        setSubmissions(initialSubmissions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [courseId]);

  const handleInputChange = (
    questionId: string,
    value: string | File | undefined
  ) => {
    setSubmissions((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!testData) return;

    // Validate required fields
    const unanswered = testData.questions.filter(
      (q) => q.required && !submissions[q.id]
    );

    if (unanswered.length > 0) {
      alert(
        `Por favor completa todas las preguntas requeridas. Faltan ${unanswered.length}.`
      );
      return;
    }

    setSubmitting(true);

    try {
      // Prepare submission data
      const answers: Record<string, any> = {};
      const evidence: Record<string, any> = {};

      testData.questions.forEach((question) => {
        const answer = submissions[question.id];
        if (question.type === "file-upload" && answer) {
          // Store file info
          evidence[question.id] = {
            fileName: (answer as any).name,
            fileSize: (answer as any).size,
          };
        } else if (answer) {
          answers[question.id] = answer;
        }
      });

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: testData.id,
          courseId,
          answers,
          evidence: Object.keys(evidence).length > 0 ? evidence : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit test");
      }

      // Show success and redirect
      setShowSuccess(true);
      setTimeout(() => {
        router.push(`/learn/${courseId}`);
      }, 2000);
    } catch (err) {
      alert(
        `Error al enviar el examen: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="text-center text-ap-ivory">Cargando examen...</div>
      </main>
    );
  }

  if (error || !testData) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-ap-ivory mb-4">Error</h1>
          <p className="text-zinc-300 mb-8">
            {error || "El examen no está disponible aún"}
          </p>
          <Link href={`/learn/${courseId}`} className="text-ap-copper hover:underline">
            ← Volver al curso
          </Link>
        </div>
      </main>
    );
  }

  if (showSuccess) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black flex items-center justify-center px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-6">✓</div>
          <h1 className="text-3xl font-bold text-ap-copper mb-4">
            ¡Examen Enviado!
          </h1>
          <p className="text-xl text-zinc-300 mb-8">
            Gracias por completar el examen. Tu respuesta ha sido recibida y será
            evaluada por nuestro equipo en breve.
          </p>
          <p className="text-zinc-400">
            Recibirás un email con los resultados y tu certificado una vez aprobado.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <Link href={`/learn/${courseId}`} className="text-ap-copper hover:underline text-sm">
          ← Volver al curso
        </Link>
        <h1 className="font-main text-3xl font-bold text-ap-ivory mt-4">
          Examen Final
        </h1>
        <p className="text-zinc-400 mt-2">
          Demuestra lo que aprendiste completando este examen
        </p>
      </div>

      {/* Test Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8 pb-12">
        {/* Info Box */}
        <div className="p-6 rounded-2xl bg-ap-copper/10 border border-ap-copper">
          <h3 className="text-ap-copper font-semibold mb-2">Instrucciones</h3>
          <ul className="text-sm text-zinc-300 space-y-1">
            <li>• Responde todas las preguntas con honestidad</li>
            <li>• Puedes descargar los materiales de referencia si es necesario</li>
            <li>• Tu respuesta será evaluada en 24-48 horas</li>
            <li>• Puntuación mínima requerida: {testData.passingScore}%</li>
          </ul>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {testData.questions.map((question, idx) => (
            <div
              key={question.id}
              className="p-6 rounded-2xl bg-white/5 border border-zinc-700 space-y-4"
            >
              {/* Question Header */}
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-ap-copper/20 text-ap-copper font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <label className="text-lg font-semibold text-ap-ivory block">
                    {question.question}
                    {question.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                </div>
              </div>

              {/* Question Input */}
              {question.type === "multiple-choice" && question.options && (
                <div className="space-y-2 mt-4">
                  {question.options.map((option, optIdx) => (
                    <label
                      key={optIdx}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={submissions[question.id] === option}
                        onChange={(e) =>
                          handleInputChange(question.id, e.target.value)
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-zinc-300">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === "text" && (
                <textarea
                  value={(submissions[question.id] as string) || ""}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  className="w-full mt-4 p-4 rounded-lg bg-white/5 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-ap-copper focus:outline-none transition min-h-32"
                />
              )}

              {question.type === "file-upload" && (
                <div className="mt-4">
                  <label className="block">
                    <div className="border-2 border-dashed border-zinc-600 rounded-lg p-8 text-center cursor-pointer hover:border-ap-copper hover:bg-white/5 transition">
                      <input
                        type="file"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleInputChange(question.id, e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="text-zinc-300">
                        {submissions[question.id] ? (
                          <>
                            <p className="font-medium text-ap-copper">
                              ✓{" "}
                              {(submissions[question.id] as File).name}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg mb-1">📎</p>
                            <p>Haz clic para seleccionar archivo</p>
                            <p className="text-sm text-zinc-500 mt-2">
                              Máximo 50MB
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-4 rounded-lg bg-ap-copper text-ap-ink font-bold text-lg hover:bg-ap-copper/90 transition disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Enviar Examen"}
          </button>
          <Link href={`/learn/${courseId}`} className="flex-1">
            <button
              type="button"
              className="w-full py-4 rounded-lg bg-zinc-700/50 text-zinc-300 font-medium hover:bg-zinc-700 transition"
            >
              Cancelar
            </button>
          </Link>
        </div>

        {/* Warning */}
        <p className="text-sm text-zinc-400 text-center">
          ⚠️ Una vez enviado el examen, no podrás cambiar tus respuestas. Revisa
          todo antes de enviar.
        </p>
      </form>
    </main>
  );
}
