// W04 관리자 — 조회 전용. 규칙 값과 원문 대조 상태, 법령 변경 감지(연결 대기), 서식 링크 점검, 서비스 현황(집계만). 개인 데이터 없음.
import { useState } from 'react';
import { useStore } from '../../state/store';
import { adminScope } from '../../domain/scopes';
import { allRules } from '../../domain/rules';
import { FORMS } from '../../data/forms';
import { INTEGRATIONS } from '../../adapters/integrations';
import { Badge, Button, Card, ConnBadge, KV, Notice, Tabs } from '../../ui/kit';
import { RulesTable } from '../owner/Rules';

type Tab = 'status' | 'rules' | 'forms';

export default function Admin() {
  const { state, base } = useStore();
  const a = adminScope(state);
  const [tab, setTab] = useState<Tab>('status');
  const counts = allRules().flatMap((r) => r.values).reduce<Record<string, number>>((m, v) => ({ ...m, [v.status]: (m[v.status] ?? 0) + 1 }), {});
  return (
    <div>
      <Notice tone="warn" className="mb-4" title="조회 전용 · 2단계 인증 연결 대기">
        법령 수치 변경은 저장소 파일(src/data/rules.json)과 git 이력으로 해요. 이 화면에는 개인 데이터가 없어요.
      </Notice>
      <Tabs<Tab>
        tabs={[
          { value: 'status', label: '서비스 현황' },
          { value: 'rules', label: '규칙·원문 대조' },
          { value: 'forms', label: '서식 링크 점검' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'status' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="집계 (이 브라우저)">
            <KV k="사업장" v={a.workplaces} />
            <KV k="직원 수" v={a.employees} />
            <KV k="확정 급여" v={a.payrollsConfirmed} />
            <KV k="회원 상담 요청" v={a.consults} />
            <KV k="비회원 신청 (시연)" v={a.guestConsults} />
            <KV k="앱 안 알림" v={a.notificationsInApp} />
            <KV k="카톡 발송 성공률" v={<Badge tone="warn">연결 대기 · 발송 0건</Badge>} />
          </Card>
          <Card title="규칙 값 상태 (값 구간 기준)">
            {Object.entries(counts).map(([k, n]) => (
              <KV key={k} k={k} v={n} />
            ))}
            <p className="mt-2 text-xs text-muted">원본 Notion 대조표(전부 미확인)와 rules.json(원문 확인 기록)의 상태가 달라요. 자동으로 합치지 않았어요.</p>
          </Card>
          <Card title="연동·예약 실행">
            <ul className="space-y-1 text-sm">
              {INTEGRATIONS.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  {i.name} <ConnBadge status={i.status} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="법령 변경 감지">
            <p className="text-sm text-muted">법제처 Open API로 조문 해시를 비교해 바뀐 조문을 쓰는 규칙만 다시 확인하는 구조예요. 값은 자동으로 바꾸지 않아요.</p>
            <Button className="mt-2" reason="연결 대기 — LAW_API_OC 인증키와 서버 작업이 필요해요">
              변경 감지 실행
            </Button>
          </Card>
        </div>
      )}
      {tab === 'rules' && <RulesTable date={base} />}
      {tab === 'forms' && (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {FORMS.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{f.name}</b> <span className="text-xs text-muted">{f.provider}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {f.url ? <Badge tone="info">기관 홈페이지 링크</Badge> : <Badge tone="warn">링크 미확보</Badge>}
                  <Badge tone="muted">마지막 확인 {f.lastChecked ?? '확인 전'}</Badge>
                </span>
              </li>
            ))}
          </ul>
          <Button className="mt-3" reason="연결 대기 — 링크 점검 예약 실행 미구현 (서버 필요)">
            링크 점검 실행
          </Button>
        </Card>
      )}
    </div>
  );
}
