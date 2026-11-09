// rules.json의 법령 줄임말 → 국가법령정보센터 정식 이름 (AI 상담 근거 링크·법령 변경 감지가 같이 쓴다)
export const LAW_NAMES: Record<string, string> = {
  퇴직급여법: '근로자퇴직급여 보장법',
  징수법: '고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률',
  '징수법 시행령': '고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률 시행령',
  기간제법: '기간제 및 단시간근로자 보호 등에 관한 법률',
  '기간제법 시행령': '기간제 및 단시간근로자 보호 등에 관한 법률 시행령',
  외국인고용법: '외국인근로자의 고용 등에 관한 법률',
  '남녀고용평등법 시행령': '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 시행령',
  건강진단규칙: '식품위생 분야 종사자의 건강진단 규칙',
  공휴일규정: '관공서의 공휴일에 관한 규정',
};

export const lawFullName = (law: string) => LAW_NAMES[law] ?? law;

/** 국가법령정보센터 조문 주소 (예: https://www.law.go.kr/법령/근로기준법/제56조) */
export function lawUrl(law: string, article?: string | null): string {
  const name = encodeURIComponent(lawFullName(law).replace(/\s+/g, ''));
  return `https://www.law.go.kr/법령/${name}${article ? `/${encodeURIComponent(article)}` : ''}`;
}
