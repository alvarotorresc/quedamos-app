import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Event } from '../services/events';

const TIMEZONE = 'Europe/Madrid';

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = (h + hours) * 60 + m;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${padTwo(newH)}:${padTwo(newM)}`;
}

function formatDateICS(date: string): string {
  return date.replace(/-/g, '');
}

function formatTimeICS(time: string): string {
  const [h, m] = time.split(':');
  return `${padTwo(Number(h))}${padTwo(Number(m))}00`;
}

export function generateICS(event: Event): string {
  const dateStr = formatDateICS(event.date);
  const hasTime = !!event.time;

  let dtStart: string;
  let dtEnd: string;

  if (hasTime) {
    const startTime = event.time!.slice(0, 5);
    const endTime = event.endTime ? event.endTime.slice(0, 5) : addHours(startTime, 1);
    dtStart = `DTSTART;TZID=${TIMEZONE}:${dateStr}T${formatTimeICS(startTime)}`;
    dtEnd = `DTEND;TZID=${TIMEZONE}:${dateStr}T${formatTimeICS(endTime)}`;
  } else {
    // All-day event: DTEND is the next day (exclusive)
    const nextDay = new Date(event.date + 'T00:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = `${nextDay.getFullYear()}${padTwo(nextDay.getMonth() + 1)}${padTwo(nextDay.getDate())}`;
    dtStart = `DTSTART;VALUE=DATE:${dateStr}`;
    dtEnd = `DTEND;VALUE=DATE:${nextDayStr}`;
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quedamos//Quedamos App//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    dtStart,
    dtEnd,
    `SUMMARY:${escapeICS(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  if (event.isOnline && event.meetingUrl) {
    lines.push(`LOCATION:${escapeICS(event.meetingUrl)}`);
    lines.push(`URL:${escapeICS(event.meetingUrl)}`);
  } else if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }

  const statusMap: Record<string, string> = {
    confirmed: 'CONFIRMED',
    cancelled: 'CANCELLED',
    pending: 'TENTATIVE',
  };
  lines.push(`STATUS:${statusMap[event.status] ?? 'TENTATIVE'}`);

  lines.push(`UID:${event.id}@quedamos.app`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function downloadICS(event: Event): Promise<void> {
  const icsContent = generateICS(event);
  const filename = `quedamos-${slugify(event.title)}.ics`;

  if (Capacitor.isNativePlatform()) {
    // Write to cache directory first — Share requires a real file URI, not a data URL
    const base64Content = btoa(unescape(encodeURIComponent(icsContent)));
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Content,
      directory: Directory.Cache,
    });

    await Share.share({
      title: event.title,
      url: result.uri,
      dialogTitle: filename,
    });
  } else {
    // On web, trigger download via Blob
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
