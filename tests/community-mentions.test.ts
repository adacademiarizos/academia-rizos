import {
  createCommunityMentionToken,
  extractCommunityMentionUserIds,
  parseCommunityText,
} from '@/lib/community-mentions'

describe('community mention tokens', () => {
  it('stores a stable user id in a visible, parseable token', () => {
    const token = createCommunityMentionToken({
      id: 'user-ana',
      name: 'Ana [Rizos]',
      email: 'ana@example.com',
    })

    expect(token).toBe('@[Ana Rizos](user-ana)')
    expect(extractCommunityMentionUserIds(`Hola ${token} y ${token}`)).toEqual(['user-ana'])
  })

  it('renders the human label while retaining unrelated text', () => {
    expect(parseCommunityText('Hola @[Ana](user-ana), bienvenida')).toEqual([
      { kind: 'text', value: 'Hola ' },
      { kind: 'mention', label: 'Ana', userId: 'user-ana' },
      { kind: 'text', value: ', bienvenida' },
    ])
  })

  it('does not treat free-form @names as recipients', () => {
    expect(extractCommunityMentionUserIds('Hola @ana, ¿puedes mirar esto?')).toEqual([])
  })
})
