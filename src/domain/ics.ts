// 캘린더 파일(.ics) — 내려받기는 그 시점의 사본, 구독(구글 캘린더 연결, 2026-11-14)은 캘린더 앱이 주기적으로 다시 읽어 감.
// 30·7·3일 전 + 당일 알람(반복 기한은 3일 전·당일).
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

export interface IcsOptions {
  /** 구독 주소로 내보낼 때 — 갱신 간격을 알리고 설명 문구를 바꾼다 */
  subscription?: boolean;
  /** 캘린더 이름 (기본 '사람샘각 노무 기한') */
  calName?: string;
}

export function buildIcs(deadlines: Deadline[], generatedAt: Date = new Date(), opts: IcsOptions = {}): string {
  const stamp = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//saram-saemgak//KO', 'CALSCALE:GREGORIAN', fold(`X-WR-CALNAME:${esc(opts.calName ?? '사람샘각 노무 기한')}`)];
  // 구독: 캘린더 앱에 6시간마다 다시 읽으라고 알린다 (구글은 자체 주기로 읽어서 몇 시간 늦을 수 있다)
  if (opts.subscription) lines.push('X-WR-TIMEZONE:Asia/Seoul', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H');
  const note = opts.subscription ? '사람샘각과 연결된 일정이에요. 기한이 바뀌면 캘린더가 다시 읽어 올 때 함께 바뀌어요.' : '내려받은 시점의 사본이에요. 기한이 바뀌면 다시 내려받으세요.';
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
    lines.push(fold(`DESCRIPTION:${esc(`${d.secondaryLabel ? d.secondaryLabel + '\n' : ''}계산 근거: ${d.origin}\n근거: ${d.basis}\n${note}`)}`));
    const offsets = d.recurring ? [3, 0] : [30, 7, 3, 0];
    for (const o of offsets) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(d.title)}`), o === 0 ? 'TRIGGER:PT9H' : `TRIGGER:-P${o}D`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

