// 캘린더 파일(.ics) 내보내기 — 내려받은 시점의 사본. 30·7·3일 전 + 당일 알람(반복 기한은 3일 전·당일).
import type { Deadline } from './deadlines';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function fold(line: string): string {
  // 75 옥텟 접기 — 한글은 3바이트라 보수적으로 문자 수 기준 60자
  const out: string[] = [];
  let rest = line;
  while (rest.length > 60) {
    out.push(rest.slice(0, 60));
    rest = ' ' + rest.slice(60);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(deadlines: Deadline[], generatedAt: Date = new Date()): string {
  const stamp = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//saram-saemgak//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:사람샘각 노무 기한'];
  for (const d of deadlines) {
    const ymd = d.date.replace(/-/g, '');
    const next = new Date(Date.UTC(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7)) - 1, Number(d.date.slice(8, 10)) + 1));
    const ymd2 = next.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${esc(d.key)}@ai-labor-service.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${ymd}`);
    lines.push(`DTEND;VALUE=DATE:${ymd2}`);
    lines.push(fold(`SUMMARY:${esc(d.title)}`));
    lines.push(fold(`DESCRIPTION:${esc(`${d.secondaryLabel ? d.secondaryLabel + '\n' : ''}계산 근거: ${d.origin}\n근거: ${d.basis}\n내려받은 시점의 사본이에요. 기한이 바뀌면 다시 내려받으세요.`)}`));
    const offsets = d.recurring ? [3, 0] : [30, 7, 3, 0];
    for (const o of offsets) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(d.title)}`), o === 0 ? 'TRIGGER:PT9H' : `TRIGGER:-P${o}D`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

