import { addDays } from 'date-fns'

export function getBusinessDates(startDate: Date, days = 14) {
  const dates: Date[] = []
  let cursor = new Date(startDate)

  while (dates.length < days) {
    if (cursor.getDay() !== 0) {
      dates.push(new Date(cursor))
    }
    cursor = addDays(cursor, 1)
  }

  return dates
}

export function getInitialBookingDate(baseDate = new Date()) {
  const tomorrow = addDays(baseDate, 1)
  if (tomorrow.getDay() === 0) {
    return addDays(tomorrow, 1)
  }

  return tomorrow
}

export function getMinutesFromTime(value: string | null | undefined) {
  if (!value) return Number.NaN

  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return Number.NaN

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.NaN

  return hours * 60 + minutes
}

export function normalizeSlotList(value: any): string[] {
  const payload = Array.isArray(value) ? value : value?.data ?? value
  if (!Array.isArray(payload)) return []

  return payload.reduce<string[]>((acc, slot) => {
    let time = ''

    if (typeof slot === 'string') {
      time = slot.slice(0, 5)
    } else if (Array.isArray(slot)) {
      const [hour, minute] = slot
      time = `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`
    } else if (slot && typeof slot === 'object') {
      if (slot.hour !== undefined) {
        time = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute ?? 0).padStart(2, '0')}`
      } else if (typeof slot.startTime === 'string') {
        time = slot.startTime.slice(0, 5)
      }
    }

    if (time && /^\d{2}:\d{2}$/.test(time)) {
      acc.push(time)
    }

    return acc
  }, [])
}

export function getBranchHours(branch?: any | null) {
  if (!branch) return { openingTime: null as string | null, closingTime: null as string | null }

  return {
    openingTime:
      branch.openingTime ??
      branch.openTime ??
      branch.startTime ??
      branch.workStartTime ??
      branch.opening_hour ??
      branch.openAt ??
      null,
    closingTime:
      branch.closingTime ??
      branch.closeTime ??
      branch.endTime ??
      branch.workEndTime ??
      branch.closing_hour ??
      branch.closeAt ??
      null,
  }
}

export function buildBranchSlots(
  rawSlots: any,
  branch?: any | null,
  durationMinutes = 60,
): string[] {
  const slots = normalizeSlotList(rawSlots)
  const { openingTime, closingTime } = getBranchHours(branch)
  if (!openingTime || !closingTime) return slots

  const openMinutes = getMinutesFromTime(openingTime)
  const closeMinutes = getMinutesFromTime(closingTime)
  if (Number.isNaN(openMinutes) || Number.isNaN(closeMinutes)) return slots

  return slots.filter((time) => {
    const slotMinutes = getMinutesFromTime(time)
    if (Number.isNaN(slotMinutes)) return false

    return slotMinutes >= openMinutes && slotMinutes + durationMinutes <= closeMinutes
  })
}
