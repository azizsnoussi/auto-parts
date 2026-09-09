const ALLOWED_SEGMENTS = new Set(['NEW', 'REGULAR', 'VIP', 'INACTIVE', 'FLEET'])

export function normalizeCustomerSegment(value?: string | null): string {
  if (!value) return 'NEW'

  const normalized = String(value).trim().toUpperCase()
  if (ALLOWED_SEGMENTS.has(normalized)) return normalized

  return 'NEW'
}

export function sanitizeCustomerPayload<T extends Record<string, any>>(payload: T): T {
  const clone = structuredClone(payload)

  const visit = (node: any): any => {
    if (Array.isArray(node)) {
      return node.map(visit)
    }

    if (node && typeof node === 'object') {
      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(node)) {
        if (key.toLowerCase().includes('segment')) {
          result[key] = normalizeCustomerSegment(typeof value === 'string' ? value : undefined)
        } else {
          result[key] = visit(value)
        }
      }
      return result
    }

    return node
  }

  return visit(clone) as T
}
