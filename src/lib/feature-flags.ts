/**
 * Authoring features that are built but intentionally not exposed yet.
 *
 * AI_AUTHORING_ENABLED covers the AI helpers in the course editors: the
 * "Generar con IA" synopsis button and the video transcription field and its
 * "Transcribir" button, in both the current lesson editor and the legacy
 * course editor.
 *
 * Hiding is deliberate: the API routes (/api/ai/synopsis, /api/ai/transcribe,
 * /api/admin/transcribe) and the `transcript` column stay in place, and the
 * editors keep round-tripping any transcript a lesson or module already has,
 * so nothing is lost while the buttons are out of sight. Flip this to true to
 * bring the whole set back.
 */
export const AI_AUTHORING_ENABLED = false

/**
 * The floating "Asistente IA" button students see inside a course.
 *
 * Hidden, not deleted: the component and its /api/ai chat route stay in place,
 * so flipping this back to true brings the whole thing back.
 */
export const AI_ASSISTANT_ENABLED = false
