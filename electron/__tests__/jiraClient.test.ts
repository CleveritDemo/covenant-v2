import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearJiraCache, JiraApiError, jiraCreateIssue, jiraGetIssue, jiraIssueTypes, jiraMyself, jiraSearch, textToAdf } from '../jiraClient'

const cred = { site: 'https://x.atlassian.net', email: 'a@b.c', apiToken: 'tok' }

const issuePayload = {
  key: 'GRAV-412',
  fields: {
    summary: 'Loop chain colgada',
    status: { name: 'In Progress' },
    issuetype: { name: 'Bug' },
    assignee: { displayName: 'Rodrigo' },
    priority: { name: 'High' },
    updated: '2026-08-12T09:40:00.000Z',
    description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'El FIFO no libera.' }] }] },
    comment: {
      comments: [
        { author: { displayName: 'Ana' }, created: '2026-08-11T10:00:00.000Z', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'reproducido' }] }] } },
      ],
    },
    subtasks: [],
    issuelinks: [],
  },
}

/** Un comentario en la forma que devuelve la API v3 (cuerpo en ADF). */
function adfComment(author: string, created: string, text: string): unknown {
  return {
    author: { displayName: author },
    created,
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
  }
}

/**
 * `jiraGetIssue` hace DOS peticiones (la issue y, aparte, los comentarios más
 * recientes), así que el stub enruta por URL. Sin `commentPage`, el endpoint de
 * comentarios responde vacío: los tests que no hablan de comentarios no tienen
 * que enterarse de que existe.
 */
function stubFetch(
  handler: (url: string, init: RequestInit) => unknown,
  commentPage?: unknown,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = url.includes('/comment?') ? (commentPage ?? { comments: [] }) : handler(url, init)
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Peticiones al endpoint de issue (no al de comentarios). */
function issueCalls(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls.filter(call => !String(call[0]).includes('/comment?'))
}

beforeEach(() => {
  clearJiraCache()
  // Algunos tests provocan fallos a propósito; el aviso del cliente es
  // comportamiento deseado, pero no tiene por qué ensuciar la salida.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('jiraMyself', () => {
  it('manda Basic auth con email:token en base64', async () => {
    const fetchMock = stubFetch(() => ({ displayName: 'Rodrigo' }))
    const result = await jiraMyself(cred)
    expect(result).toEqual({ ok: true, displayName: 'Rodrigo' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const auth = (init.headers as Record<string, string>).Authorization
    expect(auth).toBe(`Basic ${Buffer.from('a@b.c:tok').toString('base64')}`)
  })

  it('un 401 devuelve un error legible, no una excepción', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) } as unknown as Response)))
    const result = await jiraMyself(cred)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })

  it('una red caída devuelve error, no rechaza la promesa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ENOTFOUND') }))
    await expect(jiraMyself(cred)).resolves.toMatchObject({ ok: false })
  })
})

describe('JiraApiError', () => {
  const guide403 =
    'la credencial se aceptó pero el acceso está denegado. Causas típicas: el API token tiene scopes y no cubre este endpoint, la cuenta no tiene acceso al producto Jira en este sitio, o el sitio tiene allowlist de IP.'

  it('un 403 con errorMessages lanza JiraApiError con status, guía y detalle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({
          ok: false,
          status: 403,
          text: async () => '{"errorMessages":["You do not have the permission to see the specified issue."]}',
          headers: new Headers(),
        }) as unknown as Response,
      ),
    )
    const err = await jiraSearch(cred, 'key = GRAV-1', 1).catch(e => e)
    expect(err).toBeInstanceOf(JiraApiError)
    expect(err.status).toBe(403)
    expect(err.message).toContain(guide403)
    expect(err.message).toContain('You do not have the permission to see the specified issue.')
  })

  it('un 403 con body no-JSON lanza JiraApiError con status 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({
          ok: false,
          status: 403,
          text: async () => '<html>forbidden</html>',
          headers: new Headers(),
        }) as unknown as Response,
      ),
    )
    const err = await jiraSearch(cred, 'key = GRAV-1', 1).catch(e => e)
    expect(err).toBeInstanceOf(JiraApiError)
    expect(err.status).toBe(403)
    expect(err.message).toContain(guide403)
    expect(err.message).toContain('<html>forbidden</html>')
  })
})

describe('jiraSearch', () => {
  it('mapea la respuesta a JiraIssueRef', async () => {
    stubFetch(() => ({ issues: [issuePayload] }))
    const refs = await jiraSearch(cred, 'project = GRAV', 8)
    expect(refs).toEqual([{
      key: 'GRAV-412',
      summary: 'Loop chain colgada',
      status: 'In Progress',
      issueType: 'Bug',
      assignee: 'Rodrigo',
      updated: '2026-08-12T09:40:00.000Z',
    }])
  })

  it('escapa el JQL en la query string', async () => {
    const fetchMock = stubFetch(() => ({ issues: [] }))
    await jiraSearch(cred, 'summary ~ "a b"', 8)
    expect(fetchMock.mock.calls[0][0]).toContain('jql=summary+%7E+%22a+b%22')
  })

  it('una respuesta sin issues devuelve lista vacía', async () => {
    stubFetch(() => ({}))
    await expect(jiraSearch(cred, 'x', 8)).resolves.toEqual([])
  })
})

describe('jiraGetIssue', () => {
  it('aplana el ADF de descripción y comentarios', async () => {
    stubFetch(() => issuePayload, {
      comments: [adfComment('Ana', '2026-08-11T10:00:00.000Z', 'reproducido')],
    })
    const issue = await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(issue.description).toBe('El FIFO no libera.')
    expect(issue.comments[0]).toEqual({
      author: 'Ana',
      created: '2026-08-11T10:00:00.000Z',
      body: 'reproducido',
    })
    expect(issue.url).toBe('https://x.atlassian.net/browse/GRAV-412')
  })

  it('sin asignado no inventa un nombre', async () => {
    stubFetch(() => ({ ...issuePayload, fields: { ...issuePayload.fields, assignee: null } }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).assignee).toBeNull()
  })

  it('la segunda llamada dentro del TTL no vuelve a la red', async () => {
    const fetchMock = stubFetch(() => issuePayload)
    await jiraGetIssue(cred, 'GRAV-412', 10)
    await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(issueCalls(fetchMock)).toHaveLength(1)
  })

  it('un 404 lanza un error con la clave, para que el refresco lo registre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as unknown as Response)))
    await expect(jiraGetIssue(cred, 'GRAV-999', 10)).rejects.toThrow(/GRAV-999/)
  })

  it('sin prioridad no inventa una', async () => {
    stubFetch(() => ({ ...issuePayload, fields: { ...issuePayload.fields, priority: null } }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).priority).toBeNull()
  })

  it('mapea subtasks e issuelinks poblados', async () => {
    stubFetch(() => ({
      ...issuePayload,
      fields: {
        ...issuePayload.fields,
        subtasks: [{
          key: 'GRAV-413',
          fields: { summary: 'Subtarea', status: { name: 'To Do' }, issuetype: { name: 'Task' }, assignee: null },
        }],
        issuelinks: [{
          type: { name: 'blocks' },
          outwardIssue: { key: 'GRAV-500', fields: { summary: 'Bloqueada' } },
        }],
      },
    }))
    const issue = await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(issue.subtasks).toEqual([{
      key: 'GRAV-413',
      summary: 'Subtarea',
      status: 'To Do',
      issueType: 'Task',
      assignee: null,
      // Las subtareas del payload de la issue no traen `updated`; el mapeo cae
      // a cadena vacía y el picker esconde la columna en vez de pintar basura.
      updated: '',
    }])
    expect(issue.links).toEqual([{ type: 'blocks', key: 'GRAV-500', summary: 'Bloqueada' }])
  })

  it('los comentarios vienen del endpoint dedicado, ordenados y acotados por maxComments', async () => {
    const fetchMock = stubFetch(() => issuePayload, {
      // `orderBy=-created`: del más nuevo al más viejo.
      comments: [
        adfComment('Cami', '2026-08-11T10:00:00.000Z', 'tres'),
        adfComment('Beto', '2026-08-10T10:00:00.000Z', 'dos'),
      ],
    })

    const issue = await jiraGetIssue(cred, 'GRAV-412', 2)

    // Cronológico en el documento, aunque la API los diera al revés.
    expect(issue.comments.map(c => c.body)).toEqual(['dos', 'tres'])
    const commentUrl = String(fetchMock.mock.calls.find(call => String(call[0]).includes('/comment?'))?.[0])
    expect(commentUrl).toContain('/rest/api/3/issue/GRAV-412/comment?')
    expect(commentUrl).toContain('orderBy=-created')
    expect(commentUrl).toContain('maxResults=2')
  })

  it('con la página embebida NO siendo la más nueva, el .md se queda con los recientes', async () => {
    // El caso que nadie podía ver: el campo `comment` del GET de la issue está
    // paginado desde `startAt: 0`, así que en un hilo largo trae los MÁS
    // VIEJOS. Recortarle la cola daba justo lo contrario de lo prometido
    // («Comentarios (últimos 10)»). Aquí la página embebida son los tres
    // primeros y el endpoint dedicado devuelve los dos últimos.
    const fetchMock = stubFetch(
      () => ({
        ...issuePayload,
        fields: {
          ...issuePayload.fields,
          comment: {
            comments: [
              adfComment('Ana', '2026-01-01T10:00:00.000Z', 'primer comentario de todos'),
              adfComment('Beto', '2026-01-02T10:00:00.000Z', 'segundo'),
              adfComment('Cami', '2026-01-03T10:00:00.000Z', 'tercero'),
            ],
          },
        },
      }),
      {
        comments: [
          adfComment('Zoe', '2026-08-12T10:00:00.000Z', 'el último de todos'),
          adfComment('Yago', '2026-08-11T10:00:00.000Z', 'el penúltimo'),
        ],
      },
    )

    const issue = await jiraGetIssue(cred, 'GRAV-412', 2)

    expect(issue.comments.map(c => c.body)).toEqual(['el penúltimo', 'el último de todos'])
    expect(issue.comments.map(c => c.body)).not.toContain('primer comentario de todos')
    expect(issueCalls(fetchMock)).toHaveLength(1)
  })

  it('maxComments 0 es CERO comentarios y ni siquiera pide la página', async () => {
    // Mismo criterio que `refreshSeconds: 0` en el campo de al lado: 0 apaga.
    const fetchMock = stubFetch(() => issuePayload, {
      comments: [adfComment('Ana', '2026-08-11T10:00:00.000Z', 'no debería salir')],
    })

    const issue = await jiraGetIssue(cred, 'GRAV-412', 0)

    expect(issue.comments).toEqual([])
    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/comment?'))).toBe(false)
  })

  it('si el endpoint de comentarios falla, la issue sigue sirviendo con los embebidos', async () => {
    // Mejor esfuerzo: perder el ticket entero porque falló su hilo de
    // comentarios sería peor que servir la página embebida.
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/comment?')) {
        return { ok: false, status: 500, json: async () => ({}) } as unknown as Response
      }
      return { ok: true, status: 200, json: async () => issuePayload } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const issue = await jiraGetIssue(cred, 'GRAV-412', 10)

    expect(issue.summary).toBe('Loop chain colgada')
    expect(issue.comments.map(c => c.body)).toEqual(['reproducido'])
  })

  it('la caché no puede servir MÁS comentarios de los que se pidieron al poblarla', async () => {
    const fetchMock = stubFetch(() => issuePayload, {
      comments: [adfComment('Cami', '2026-08-11T10:00:00.000Z', 'tres')],
    })

    await jiraGetIssue(cred, 'GRAV-412', 1)
    // Menos o igual: se sirve de caché.
    await jiraGetIssue(cred, 'GRAV-412', 1)
    expect(issueCalls(fetchMock)).toHaveLength(1)

    // Más: la entrada cacheada no cubre la petición, así que vuelve a la red.
    await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(issueCalls(fetchMock)).toHaveLength(2)
  })
})

describe('jiraGetIssue sprint', () => {
  it('reconoce un campo de sprint agile real por su forma (state/boardId)', async () => {
    stubFetch(() => ({
      ...issuePayload,
      fields: {
        ...issuePayload.fields,
        customfield_10020: [{ id: 1, name: 'Sprint 5', state: 'active', boardId: 3 }],
      },
    }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).sprint).toBe('Sprint 5')
  })

  it('fixVersions y components sin campo de sprint no devuelven una versión como sprint', async () => {
    stubFetch(() => ({
      ...issuePayload,
      fields: {
        ...issuePayload.fields,
        fixVersions: [{ id: '1', name: 'v1.0' }],
        components: [{ id: '2', name: 'Backend' }],
      },
    }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).sprint).toBeNull()
  })

  it('con fixVersions/components y sprint presentes, el sprint gana sin importar el orden de los campos', async () => {
    stubFetch(() => ({
      ...issuePayload,
      fields: {
        ...issuePayload.fields,
        fixVersions: [{ id: '1', name: 'v1.0' }],
        customfield_10020: [{ id: 1, name: 'Sprint 5', state: 'active', boardId: 3 }],
        components: [{ id: '2', name: 'Backend' }],
      },
    }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).sprint).toBe('Sprint 5')

    clearJiraCache()
    stubFetch(() => ({
      ...issuePayload,
      fields: {
        ...issuePayload.fields,
        customfield_10020: [{ id: 1, name: 'Sprint 5', state: 'active', boardId: 3 }],
        fixVersions: [{ id: '1', name: 'v1.0' }],
        components: [{ id: '2', name: 'Backend' }],
      },
    }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).sprint).toBe('Sprint 5')
  })
})

describe('textToAdf', () => {
  it('un párrafo por línea no vacía', () => {
    expect(textToAdf('uno\ndos\n\n')).toEqual({
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'uno' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'dos' }] },
      ],
    })
  })

  it('texto vacío o solo espacios devuelve content vacío', () => {
    expect(textToAdf('')).toEqual({ type: 'doc', version: 1, content: [] })
    expect(textToAdf('   \n  ')).toEqual({ type: 'doc', version: 1, content: [] })
  })
})

describe('jiraIssueTypes', () => {
  it('normaliza id, name y subtask del createmeta', async () => {
    stubFetch(() => ({
      issueTypes: [
        { id: '10', name: 'Epic', subtask: false },
        { id: '11', name: 'Sub-task', subtask: true },
      ],
    }))
    await expect(jiraIssueTypes(cred, 'GRAV')).resolves.toEqual([
      { id: '10', name: 'Epic', subtask: false },
      { id: '11', name: 'Sub-task', subtask: true },
    ])
  })
})

describe('jiraCreateIssue', () => {
  it('POST con fields, ADF en description y parent opcional', async () => {
    let posted: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        posted = JSON.parse(String(init.body))
        return {
          ok: true,
          status: 201,
          json: async () => ({ key: 'GRAV-99' }),
        } as unknown as Response
      }),
    )

    const result = await jiraCreateIssue(cred, {
      projectKey: 'GRAV',
      issueTypeId: '1',
      summary: 'Padre',
      description: 'línea uno',
      parentKey: 'GRAV-1',
    })

    expect(result).toEqual({ key: 'GRAV-99' })
    const body = posted as { fields: Record<string, unknown> }
    expect(body.fields.project).toEqual({ key: 'GRAV' })
    expect(body.fields.parent).toEqual({ key: 'GRAV-1' })
    expect(body.fields.description).toEqual(textToAdf('línea uno'))
  })
})
