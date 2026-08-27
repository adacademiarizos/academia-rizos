'use client'

import { useEffect, useState } from 'react'

type Scope = 'COURSE' | 'MODULE' | 'STYLE' | 'LESSON'
type Resource = { id: string; title: string; fileUrl: string; fileType: string; fileSize: number }

export function LearningResourcesPanel({ scope, scopeId, title = 'Recursos' }: { scope: Scope; scopeId: string; title?: string }) {
  const [resources, setResources] = useState<Resource[]>([])

  useEffect(() => {
    let active = true
    fetch(`/api/student/learning/${scope}/${scopeId}/resources`).then(async (response) => {
      if (response.ok && active) setResources((await response.json()).data ?? [])
    }).catch(() => undefined)
    return () => { active = false }
  }, [scope, scopeId])

  if (resources.length === 0) return null
  return <section className="rounded-2xl border border-zinc-700 bg-white/5 p-4 space-y-2">
    <h3 className="text-sm font-semibold text-ap-ivory">{title}</h3>
    <div className="space-y-1">{resources.map((resource) => <a key={resource.id} href={resource.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-ap-copper transition"><span>📎</span><span className="truncate">{resource.title}</span><span className="ml-auto text-xs text-zinc-500 uppercase">{resource.fileType}</span></a>)}</div>
  </section>
}
