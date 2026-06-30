import type { Contest, Task } from '../types'

const escapeText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')

const compactDate = (value: string) => value.replace(/-/g, '')

const formatLocalDateTime = (date: Date) => {
  const part = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}T${part(date.getHours())}${part(date.getMinutes())}00`
}

const nextDay = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const foldLine = (line: string) => {
  const lines: string[] = []
  let current = ''
  let bytes = 0
  for (const character of line) {
    const characterBytes = new TextEncoder().encode(character).length
    const limit = lines.length ? 74 : 75
    if (bytes + characterBytes > limit && current) {
      lines.push(current)
      current = ` ${character}`
      bytes = 1 + characterBytes
    } else {
      current += character
      bytes += characterBytes
    }
  }
  lines.push(current)
  return lines.join('\r\n')
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function downloadTaskCalendar(task: Task, contest: Contest, categoryName?: string) {
  const timing = task.dueTime
    ? (() => {
        const start = new Date(`${task.dueDate}T${task.dueTime}:00`)
        const end = new Date(start.getTime() + 60 * 60 * 1000)
        return [`DTSTART:${formatLocalDateTime(start)}`, `DTEND:${formatLocalDateTime(end)}`]
      })()
    : [
        `DTSTART;VALUE=DATE:${compactDate(task.dueDate)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDay(task.dueDate))}`,
      ]
  const description = [
    task.description,
    categoryName ? `Catégorie : ${categoryName}` : '',
    `Concours : ${contest.name}`,
  ].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Attelage Pilot//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeText(`${task.id}@attelage-pilot`)}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    ...timing,
    `SUMMARY:${escapeText(task.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(contest.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const content = `${lines.map(foldLine).join('\r\n')}\r\n`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${slugify(task.title) || 'tache'}.ics`
  link.click()
  URL.revokeObjectURL(url)
}
