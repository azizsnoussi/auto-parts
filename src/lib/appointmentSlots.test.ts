import { describe, it, expect } from 'vitest'
import { buildBranchSlots, getBusinessDates, getInitialBookingDate, normalizeSlotList } from './appointmentSlots'

describe('appointment booking dates', () => {
  it('skips Sundays and starts on the first available business day', () => {
    const result = getBusinessDates(new Date('2026-08-16'))
    expect(result[0].toISOString().slice(0, 10)).toBe('2026-08-17')
    expect(result.some(date => date.getDay() === 0)).toBe(false)
  })

  it('returns a valid initial date even if tomorrow is Sunday', () => {
    const result = getInitialBookingDate(new Date('2026-08-15'))
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-17')
  })
})

describe('appointment slot normalization', () => {
  it('normalizes common backend slot payloads into HH:mm strings', () => {
    expect(normalizeSlotList(['09:00:00', '10:30'])).toEqual(['09:00', '10:30'])
    expect(normalizeSlotList({ data: [{ hour: 11, minute: 15 }, '12:45:00'] })).toEqual(['11:15', '12:45'])
  })

  it('respects admin-defined branch opening and closing times', () => {
    const slots = ['08:00', '09:00', '16:00', '17:00', '18:00']
    const result = buildBranchSlots(slots, { openingTime: '08:30:00', closingTime: '17:30:00' }, 60)
    expect(result).toEqual(['09:00', '16:00'])
  })
})
