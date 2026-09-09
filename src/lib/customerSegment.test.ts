import { describe, expect, it } from 'vitest'
import { normalizeCustomerSegment, sanitizeCustomerPayload } from './customerSegment'

describe('normalizeCustomerSegment', () => {
  it('normalizes supported values to the backend enum', () => {
    expect(normalizeCustomerSegment('vip')).toBe('VIP')
    expect(normalizeCustomerSegment('REGULAR')).toBe('REGULAR')
    expect(normalizeCustomerSegment('fleet')).toBe('FLEET')
    expect(normalizeCustomerSegment('inactive')).toBe('INACTIVE')
  })

  it('defaults unsupported values to NEW', () => {
    expect(normalizeCustomerSegment('premium')).toBe('NEW')
    expect(normalizeCustomerSegment('')).toBe('NEW')
    expect(normalizeCustomerSegment(undefined)).toBe('NEW')
  })
})

describe('sanitizeCustomerPayload', () => {
  it('sanitizes nested segment fields before sending them to the backend', () => {
    const payload = {
      segment: 'vip',
      customer: {
        customerSegment: 'premium',
      },
      items: [{ segment: 'regular' }],
    }

    expect(sanitizeCustomerPayload(payload)).toEqual({
      segment: 'VIP',
      customer: {
        customerSegment: 'NEW',
      },
      items: [{ segment: 'REGULAR' }],
    })
  })
})
