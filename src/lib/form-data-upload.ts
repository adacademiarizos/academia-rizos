export interface FormDataUploadProgress {
  loaded: number
  total: number
}

export interface FormDataUploadTask<T> {
  promise: Promise<T>
  abort: () => void
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const error = 'error' in payload ? payload.error : undefined
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

export function startFormDataUpload<T>({
  url,
  formData,
  onProgress,
}: {
  url: string
  formData: FormData
  onProgress: (progress: FormDataUploadProgress) => void
}): FormDataUploadTask<T> {
  const request = new XMLHttpRequest()
  const promise = new Promise<T>((resolve, reject) => {
    request.open('POST', url)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total })
    }
    request.onerror = () => reject(new Error('No se pudo conectar para subir el archivo. Revisá tu conexión e intentá de nuevo.'))
    request.onabort = () => reject(new DOMException('Carga cancelada', 'AbortError'))
    request.onload = () => {
      let payload: unknown = null
      try { payload = request.responseText ? JSON.parse(request.responseText) : null } catch { /* The status below provides the fallback. */ }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload as T)
        return
      }
      reject(new Error(getErrorMessage(payload, `No se pudo subir el archivo (${request.status}). Intentá de nuevo.`)))
    }
    request.send(formData)
  })

  return { promise, abort: () => request.abort() }
}
