import { parseCommunityText } from '@/lib/community-mentions'

/** Renders mention labels safely without exposing their internal user ids. */
export function CommunityText({ body }: { body: string }) {
  return (
    <>
      {parseCommunityText(body).map((token, index) =>
        token.kind === 'mention' ? (
          <span key={`${token.userId}-${index}`} className="font-medium text-ap-copper">
            @{token.label}
          </span>
        ) : (
          <span key={`text-${index}`}>{token.value}</span>
        )
      )}
    </>
  )
}
