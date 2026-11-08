// 자동 생성 파일 — 직접 고치지 마세요. 원본: supabase/functions/public-api/handler.ts (npm run build:functions)
// sha256:47b4f6b6115d
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// supabase/functions/_shared/domain.js
var domain_exports = {};
__export(domain_exports, {
  CHECKLIST_ITEMS: () => CHECKLIST_ITEMS,
  EMPTY_DIAG: () => EMPTY_DIAG,
  FAQS: () => FAQS,
  HOLIDAYS: () => HOLIDAYS,
  HOLIDAY_SOURCE: () => HOLIDAY_SOURCE,
  INSURANCE_LABEL: () => INSURANCE_LABEL,
  RISK_QUESTIONS: () => RISK_QUESTIONS,
  RULES_FILE: () => RULES_FILE,
  STATUS_LABEL: () => STATUS_LABEL,
  TYPE_LABEL: () => TYPE_LABEL,
  VERDICT_LABEL: () => VERDICT_LABEL,
  WEEKEND_HOLIDAYS: () => WEEKEND_HOLIDAYS,
  addDays: () => addDays,
  addMonthsYM: () => addMonthsYM,
  alertDates: () => alertDates,
  allRules: () => allRules,
  areaCounts: () => areaCounts,
  buildIcs: () => buildIcs,
  buildMemo: () => buildMemo,
  checkMinimumWage: () => checkMinimumWage,
  classifyClock: () => classifyClock,
  computeChecklist: () => computeChecklist,
  computeDeadlines: () => computeDeadlines,
  computePayrollLine: () => computePayrollLine,
  computeTodos: () => computeTodos,
  conditionAt: () => conditionAt,
  createEmptyState: () => createEmptyState,
  createSeed: () => createSeed,
  currentTimes: () => currentTimes,
  dailyWorkerIncomeTax: () => dailyWorkerIncomeTax,
  dayPlan: () => dayPlan,
  detectPII: () => detectPII,
  diagnose: () => diagnose,
  diagnosisSteps: () => diagnosisSteps,
  diffDays: () => diffDays,
  draftLines: () => draftLines,
  employeeInsurance: () => employeeInsurance,
  estimateSeverance: () => estimateSeverance,
  evaluateRisk: () => evaluateRisk,
  fmtMD: () => fmtMD,
  foreignSignal: () => foreignSignal,
  isHHMM: () => isHHMM,
  isISODate: () => isISODate,
  isUnder5: () => isUnder5,
  judgeInsurance: () => judgeInsurance,
  leaveAccrual: () => leaveAccrual,
  monthOf: () => monthOf,
  payrollLines: () => payrollLines,
  payrollPeriodFor: () => payrollPeriodFor,
  pendingAttendanceIn: () => pendingAttendanceIn,
  premiumTotals: () => premiumTotals,
  premiums: () => premiums,
  quickWage: () => quickWage,
  registerHolidays: () => registerHolidays,
  resolveRule: () => resolveRule,
  searchFaq: () => searchFaq,
  severanceAmount: () => severanceAmount,
  weekday: () => weekday,
  weeklyHours: () => weeklyHours
});
var rules_default = {
  schema: "bix-rules/1",
  generatedAt: "2026-11-04",
  basis: "2026-11-04 기준 국가법령정보센터 현행·시행예정 조문(data/laws), 고용노동부·보건복지부 고시와 보도자료",
  howToRead: {
    values: "시행 구간(effectiveFrom~effectiveTo)별 값. 계산기는 기준일이 들어가는 값을 고른다.",
    status: {
      verified: "1차 출처 원문에서 확인",
      partial: "일부만 확인 (note 참고)",
      announced: "정부 의결·발표만 있고 법령 개정 전",
      pending: "법률은 바뀌었지만 금액·범위를 정할 시행령이 없음",
      needsExpert: "노무사 확인 필요 (22번)"
    },
    "sources.check": "build_rules.py가 data/laws 조문에서 quote를 찾은 결과와 조문 해시. 해시가 바뀌면 원문이 바뀐 것이므로 다시 확인한다.",
    "appliesTo.minEmployees": "이 인원 이상 사업장에만 적용"
  },
  rules: [
    {
      id: "minimumWage.hourly",
      label: "최저임금 시간급",
      category: "wage",
      unit: "원",
      check: "A1",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: 10320,
          effectiveFrom: "2026-01-01",
          effectiveTo: "2026-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "notice",
              ref: "고용노동부고시 제2025-47호",
              quote: "10,320원",
              file: "2026년 적용 최저임금 고시(고용노동부 고시 제2025-47호).pdf",
              url: "https://www.moel.go.kr/info/lawinfo/instruction/view.do?bbs_seq=20250800121",
              check: {
                ok: true
              }
            },
            {
              type: "law",
              law: "최저임금법",
              article: "제10조",
              quote: "고시",
              paragraph: 1,
              ref: "최저임금법#제10조①",
              check: {
                ok: true,
                versionFrom: "2020-05-26",
                versionStatus: "current",
                hash: "48920df0c0c8",
                lawEffective: "2020-05-26",
                lawNumber: "법률 제17326호"
              }
            }
          ]
        },
        {
          value: 10700,
          effectiveFrom: "2027-01-01",
          effectiveTo: "2027-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "notice",
              ref: "고용노동부고시 제2026-60호",
              quote: "10,700원",
              file: "2027년 적용 최저임금 고시(고용노동부 고시 제2026-60호).pdf",
              url: "https://www.moel.go.kr/info/lawinfo/instruction/view.do?bbs_seq=20260800150",
              check: {
                ok: true
              }
            }
          ]
        }
      ]
    },
    {
      id: "minimumWage.monthly209h",
      label: "최저임금 월 환산액(주 40시간, 209시간)",
      category: "wage",
      unit: "원",
      check: "A1",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: 2156880,
          effectiveFrom: "2026-01-01",
          effectiveTo: "2026-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "notice",
              ref: "고용노동부고시 제2025-47호",
              quote: "2,156,880원",
              file: "2026년 적용 최저임금 고시(고용노동부 고시 제2025-47호).pdf",
              check: {
                ok: true
              }
            }
          ]
        },
        {
          value: 2236300,
          effectiveFrom: "2027-01-01",
          effectiveTo: "2027-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "notice",
              ref: "고용노동부고시 제2026-60호",
              quote: "2,236,300원",
              file: "2027년 적용 최저임금 고시(고용노동부 고시 제2026-60호).pdf",
              check: {
                ok: true
              }
            }
          ]
        }
      ],
      note: "참고 표시용. 판정은 시간급 환산으로 한다."
    },
    {
      id: "minimumWage.probation",
      label: "수습 중 최저임금 감액",
      category: "wage",
      unit: "비율",
      check: "C1",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: {
            reduction: 0.1,
            maxMonths: 3,
            minContractYears: 1,
            excludeSimpleLabor: true
          },
          effectiveFrom: "2019-01-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "최저임금법",
              article: "제5조",
              quote: "1년 이상의 기간을 정하여 근로계약을 체결하고 수습 중에 있는 근로자로서 수습을 시작한 날부터 3개월 이내인 사람",
              paragraph: 2,
              ref: "최저임금법#제5조②",
              check: {
                ok: true,
                versionFrom: "2020-05-26",
                versionStatus: "current",
                hash: "08488bfd2a04",
                lawEffective: "2020-05-26",
                lawNumber: "법률 제17326호"
              }
            },
            {
              type: "law",
              law: "최저임금법 시행령",
              article: "제3조",
              quote: "100분의 10을 뺀 금액",
              ref: "최저임금법 시행령#제3조",
              check: {
                ok: true,
                versionFrom: "2019-01-01",
                versionStatus: "current",
                hash: "97910993c56b",
                lawEffective: "2019-01-01",
                lawNumber: "대통령령 제29469호"
              }
            },
            {
              type: "notice",
              ref: "고용노동부고시 제2018-23호 (단순노무직종)",
              quote: "단순노무종사자",
              file: "최저임금법 제5조에 따른 단순노무직종 근로자 지정 고시문.pdf",
              check: {
                ok: true
              }
            }
          ]
        }
      ],
      note: "음식점·카페 직무가 단순노무(대분류 9)에 드는지는 22번 C1. 화면은 자동 감액하지 않는다."
    },
    {
      id: "minimumWage.inclusion.excludedShare",
      label: "최저임금 산입 제외 비율 (정기상여금·현금 복리후생비)",
      category: "wage",
      unit: "비율",
      check: "A10",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: {
            bonus: 0,
            welfareCash: 0
          },
          effectiveFrom: "2024-01-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "최저임금법",
              article: "제2조",
              quote: "2024년부터는 100분의 0",
              addendum: "15666",
              ref: "최저임금법#부칙(제15666호)제2조",
              check: {
                ok: true,
                versionFrom: null,
                versionStatus: "current",
                hash: "5bec96672f5d",
                lawEffective: "2020-05-26",
                lawNumber: "법률 제17326호"
              }
            }
          ]
        }
      ],
      note: "매월 1회 이상 정기 지급분은 전액 산입. 소정근로 외 임금은 제외(최저임금법 제6조④1)."
    },
    {
      id: "weeklyHoliday.minWeeklyHours",
      label: "주휴·연차 적용 최소 주 소정근로시간",
      category: "wage",
      unit: "시간",
      check: "A9",
      usedIn: [
        "08",
        "13"
      ],
      values: [
        {
          value: 15,
          effectiveFrom: "2008-03-21",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제18조",
              quote: "15시간 미만인 근로자에 대하여는 제55조와 제60조를 적용하지 아니한다",
              paragraph: 3,
              ref: "근로기준법#제18조③",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "db1390520c94",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      note: "4주 평균으로 판단"
    },
    {
      id: "weeklyHoliday.paidHours",
      label: "주휴 시간 계산",
      category: "wage",
      unit: "식",
      check: "A9",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: {
            formula: "min(weeklyHours,40) / 40 * 8",
            condition: "1주 소정근로일 개근"
          },
          effectiveFrom: "2018-06-29",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법 시행령",
              article: "제30조",
              quote: "1주 동안의 소정근로일을 개근한 자에게 주어야 한다",
              paragraph: 1,
              ref: "근로기준법 시행령#제30조①",
              check: {
                ok: true,
                versionFrom: "2025-10-23",
                versionStatus: "current",
                hash: "9cfcc3a721fa",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            },
            {
              type: "law",
              law: "근로기준법 시행령",
              quote: "4주 동안의 소정근로시간을 그 기간의 통상 근로자의 총 소정근로일 수로 나눈 시간 수",
              appendix: "[별표 2]",
              ref: "근로기준법 시행령#별표2",
              check: {
                ok: true,
                appendixHash: "c05ee3619967",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            }
          ]
        }
      ],
      note: "통상 근로자 주 5일 기준일 때 별표 2 식과 같다. 퇴사 주 주휴는 22번 C2."
    },
    {
      id: "premium.overtime",
      label: "연장근로 가산율",
      category: "wage",
      unit: "비율",
      check: "A12",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: 0.5,
          effectiveFrom: "2018-03-20",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제56조",
              quote: "통상임금의 100분의 50 이상을 가산",
              paragraph: 1,
              ref: "근로기준법#제56조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "61610c620b7d",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "premium.night",
      label: "야간근로 가산율 (22:00~06:00)",
      category: "wage",
      unit: "비율",
      check: "A12",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: {
            rate: 0.5,
            start: "22:00",
            end: "06:00"
          },
          effectiveFrom: "2018-03-20",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제56조",
              quote: "오후 10시부터 다음 날 오전 6시 사이의 근로",
              paragraph: 3,
              ref: "근로기준법#제56조③",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "61610c620b7d",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "premium.holiday",
      label: "휴일근로 가산율",
      category: "wage",
      unit: "비율",
      check: "A12",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: {
            within8h: 0.5,
            over8h: 1
          },
          effectiveFrom: "2018-03-20",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제56조",
              quote: "8시간을 초과한 휴일근로: 통상임금의 100분의 100",
              paragraph: 2,
              ref: "근로기준법#제56조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "61610c620b7d",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "workHours.limits",
      label: "법정 근로시간과 연장 한도",
      category: "work",
      unit: "시간",
      check: "C7",
      usedIn: [
        "12",
        "13"
      ],
      values: [
        {
          value: {
            weekly: 40,
            daily: 8,
            overtimeWeeklyMax: 12
          },
          effectiveFrom: "2012-02-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제50조",
              quote: "40시간을 초과할 수 없다",
              paragraph: 1,
              ref: "근로기준법#제50조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "9ec6972a140f",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제50조",
              quote: "8시간을 초과할 수 없다",
              paragraph: 2,
              ref: "근로기준법#제50조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "9ec6972a140f",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제53조",
              quote: "1주 간에 12시간을 한도로",
              paragraph: 1,
              ref: "근로기준법#제53조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "1ec8442d743f",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      },
      note: "1~4명은 제50·53조 미적용(시행령 별표 1). 위험 점검에서 '법적 의무 아님·권장'."
    },
    {
      id: "break.minimum",
      label: "휴게시간",
      category: "work",
      unit: "분",
      check: "B18",
      usedIn: [
        "12",
        "13"
      ],
      values: [
        {
          value: {
            per4h: 30,
            per8h: 60,
            waiver4hOnRequest: false
          },
          effectiveFrom: "2026-10-08",
          effectiveTo: "2026-12-09",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제54조",
              quote: "4시간인 경우에는 30분 이상, 8시간인 경우에는 1시간 이상",
              paragraph: 1,
              ref: "근로기준법#제54조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "f6370c40748f",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        },
        {
          value: {
            per4h: 30,
            per8h: 60,
            waiver4hOnRequest: true
          },
          effectiveFrom: "2026-12-10",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제54조",
              quote: "근로자가 휴게시간을 이용하지 아니할 것을 명시적으로 요청한 때에는 그러하지 아니하다",
              paragraph: 1,
              ref: "근로기준법#제54조①",
              check: {
                ok: true,
                versionFrom: "2026-12-10",
                versionStatus: "scheduled",
                hash: "1d67cbf4cb29",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      note: "1~4명에도 적용(별표 1 제4장 제54조)."
    },
    {
      id: "minor.limits",
      label: "18세 미만 근로시간·취직인허증",
      category: "work",
      unit: "시간",
      check: "B19",
      usedIn: [
        "08",
        "12",
        "13"
      ],
      values: [
        {
          value: {
            daily: 7,
            weekly: 35,
            extraDaily: 1,
            extraWeekly: 5,
            permitUnderAge: 15
          },
          effectiveFrom: "2020-05-26",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제69조",
              quote: "1일에 7시간, 1주에 35시간을 초과하지 못한다",
              ref: "근로기준법#제69조",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "59851fb000a3",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제64조",
              quote: "15세 미만인 사람",
              paragraph: 1,
              ref: "근로기준법#제64조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "2db246b664d2",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "annualLeave.accrual",
      label: "연차 발생",
      category: "leave",
      unit: "일",
      check: "B16",
      usedIn: [
        "13"
      ],
      values: [
        {
          value: {
            firstYearPerMonth: 1,
            base: 15,
            attendanceRate: 0.8,
            plusEvery2Years: 1,
            max: 25,
            splitHourly: false
          },
          effectiveFrom: "2018-05-29",
          effectiveTo: "2027-06-09",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제60조",
              quote: "80퍼센트 이상 출근한 근로자에게 15일의 유급휴가",
              paragraph: 1,
              ref: "근로기준법#제60조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "07f737d62a35",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제60조",
              quote: "1개월 개근 시 1일의 유급휴가",
              paragraph: 2,
              ref: "근로기준법#제60조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "07f737d62a35",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제60조",
              quote: "25일을 한도로",
              paragraph: 4,
              ref: "근로기준법#제60조④",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "07f737d62a35",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        },
        {
          value: {
            firstYearPerMonth: 1,
            base: 15,
            attendanceRate: 0.8,
            plusEvery2Years: 1,
            max: 25,
            splitHourly: true,
            hourlyUnit: null
          },
          effectiveFrom: "2027-06-10",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제60조",
              quote: "대통령령으로 정하는 시간단위 및 일수의 범위에서 분할하여 청구한 때에는 이를 부여하여야 한다",
              paragraph: 5,
              ref: "근로기준법#제60조⑤",
              check: {
                ok: true,
                versionFrom: "2027-06-10",
                versionStatus: "scheduled",
                hash: "80c6ce914e7a",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ],
          note: "시간 단위 범위는 시행령 미정 (hourlyUnit=null)"
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "annualLeave.partTime",
      label: "단시간근로자 연차 계산",
      category: "leave",
      unit: "식",
      check: "B16",
      usedIn: [
        "13"
      ],
      values: [
        {
          value: {
            formula: "fullTimeDays * partTimeHours / fullTimeHours * 8",
            roundUpHour: true
          },
          effectiveFrom: "2021-10-14",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법 시행령",
              quote: "1시간 미만은 1시간으로 본다",
              appendix: "[별표 2]",
              ref: "근로기준법 시행령#별표2",
              check: {
                ok: true,
                appendixHash: "c05ee3619967",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "annualLeave.changeTiming",
      label: "연차 시기 변경 조건",
      category: "leave",
      unit: "문구",
      check: "C5",
      usedIn: [
        "13"
      ],
      values: [
        {
          value: "사업 운영에 막대한 지장이 있는 경우",
          effectiveFrom: "2012-02-01",
          effectiveTo: "2027-06-09",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제60조",
              quote: "사업 운영에 막대한 지장이 있는 경우",
              paragraph: 5,
              ref: "근로기준법#제60조⑤",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "07f737d62a35",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        },
        {
          value: "사업 운영에 막대한 지장이 있는 경우",
          effectiveFrom: "2027-06-10",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제60조",
              quote: "사업 운영에 막대한 지장이 있는 경우",
              paragraph: 6,
              ref: "근로기준법#제60조⑥",
              check: {
                ok: true,
                versionFrom: "2027-06-10",
                versionStatus: "scheduled",
                hash: "80c6ce914e7a",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "annualLeave.promotion",
      label: "연차 사용 촉진 시점",
      category: "leave",
      unit: "개월·일",
      check: "B17",
      usedIn: [
        "11",
        "13"
      ],
      values: [
        {
          value: {
            overOneYear: {
              notifyMonthsBefore: 6,
              notifyWindowDays: 10,
              designateMonthsBefore: 2
            },
            underOneYear: {
              notifyMonthsBefore: 3,
              notifyWindowDays: 10,
              designateMonthsBefore: 1,
              lateNotifyMonthsBefore: 1,
              lateNotifyWindowDays: 5,
              lateDesignateDaysBefore: 10
            }
          },
          effectiveFrom: "2020-03-31",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제61조",
              quote: "끝나기 6개월 전을 기준으로 10일 이내에",
              paragraph: 1,
              ref: "근로기준법#제61조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "6267269a45c0",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제61조",
              quote: "끝나기 2개월 전까지",
              paragraph: 1,
              ref: "근로기준법#제61조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "6267269a45c0",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제61조",
              quote: "최초 1년의 근로기간이 끝나기 3개월 전을 기준으로 10일 이내에",
              paragraph: 2,
              ref: "근로기준법#제61조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "6267269a45c0",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "scope.under5.appliedArticles",
      label: "1~4명 사업장에 적용되는 근로기준법 조문",
      category: "scope",
      unit: "목록",
      check: "B6",
      usedIn: [
        "07",
        "08",
        "12",
        "13"
      ],
      values: [
        {
          value: {
            ch1: "제1조~제13조",
            ch2: [
              "제15조",
              "제17조",
              "제18조",
              "제19조①",
              "제20조~제22조",
              "제23조②",
              "제26조",
              "제35조~제42조"
            ],
            ch3: [
              "제43조~제45조",
              "제47조~제49조"
            ],
            ch4: [
              "제54조",
              "제55조①",
              "제63조"
            ],
            ch5: [
              "제64조",
              "제65조①③",
              "제66조~제69조",
              "제70조②③",
              "제71조",
              "제72조",
              "제74조"
            ],
            ch6: [
              "제76조"
            ],
            ch8: [
              "제78조~제92조"
            ],
            ch11: [
              "제101조~제106조"
            ],
            ch12: [
              "제107조~제116조"
            ]
          },
          effectiveFrom: "2018-06-29",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법 시행령",
              quote: "제54조, 제55조제1항, 제63조",
              appendix: "[별표 1]",
              ref: "근로기준법 시행령#별표1",
              check: {
                ok: true,
                appendixHash: "3e3e47856ffa",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            },
            {
              type: "law",
              law: "근로기준법 시행령",
              quote: "제15조, 제17조, 제18조, 제19조제1항, 제20조부터 제22조까지의 규정, 제23조제2항, 제26조, 제35조부터 제42조까지의 규정",
              appendix: "[별표 1]",
              ref: "근로기준법 시행령#별표1",
              check: {
                ok: true,
                appendixHash: "3e3e47856ffa",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            }
          ]
        }
      ],
      note: "연장·야간·휴일 가산(제56조), 공휴일 유급(제55조②), 연차(제60조), 해고 서면통지(제27조), 괴롭힘(제76조의2·3), 법령 게시(제14조)는 미적용."
    },
    {
      id: "scope.headcount",
      label: "상시근로자 수 산정",
      category: "scope",
      unit: "식",
      check: "B5",
      usedIn: [
        "06"
      ],
      values: [
        {
          value: {
            formula: "1개월 연인원 / 가동일수",
            underHalfRule: true,
            annualLeaveBasis: "1년간 월 단위",
            familyOnlyExempt: "동거하는 친족만"
          },
          effectiveFrom: "2018-06-29",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법 시행령",
              article: "제7조의2",
              quote: "2분의 1 미만인 경우",
              paragraph: 2,
              ref: "근로기준법 시행령#제7조의2②",
              check: {
                ok: true,
                versionFrom: "2025-10-23",
                versionStatus: "current",
                hash: "455457c5fe2f",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제11조",
              quote: "동거하는 친족만을 사용하는 사업 또는 사업장",
              paragraph: 1,
              ref: "근로기준법#제11조①",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "c91c047cde08",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "dismissal.notice",
      label: "해고 예고",
      category: "end",
      unit: "일",
      check: "C11",
      usedIn: [
        "11"
      ],
      values: [
        {
          value: {
            daysBefore: 30,
            payInLieuDays: 30,
            exemptUnderMonths: 3
          },
          effectiveFrom: "2019-01-15",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제26조",
              quote: "적어도 30일 전에 예고를 하여야 하고",
              ref: "근로기준법#제26조",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "6e4f7e5de31f",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제26조",
              quote: "계속 근로한 기간이 3개월 미만인 경우",
              ref: "근로기준법#제26조",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "6e4f7e5de31f",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ],
      note: "1~4명에도 적용, 서면 통지(제27조)는 5명 이상"
    },
    {
      id: "records.retentionYears",
      label: "근로계약 관련 서류 보존",
      category: "docs",
      unit: "년",
      check: "B12",
      usedIn: [
        "07"
      ],
      values: [
        {
          value: {
            years: 3,
            items: [
              "근로자 명부",
              "근로계약서",
              "임금대장",
              "임금 결정·지급 서류",
              "고용·해고·퇴직 서류",
              "승급·감급 서류",
              "휴가 서류",
              "서면 합의 서류",
              "연소자 증명 서류"
            ],
            wageStatement: "권장"
          },
          effectiveFrom: "2021-03-30",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제42조",
              quote: "3년간 보존하여야 한다",
              ref: "근로기준법#제42조",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "608eabddd7d5",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            },
            {
              type: "law",
              law: "근로기준법 시행령",
              article: "제22조",
              quote: "임금대장",
              paragraph: 1,
              ref: "근로기준법 시행령#제22조①",
              check: {
                ok: true,
                versionFrom: "2025-10-23",
                versionStatus: "current",
                hash: "f3273bbc6d7f",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "records.rosterException",
      label: "근로자 명부 작성 예외",
      category: "docs",
      unit: "일",
      check: "B7",
      usedIn: [
        "07",
        "11"
      ],
      values: [
        {
          value: {
            dailyWorkerUnderDays: 30
          },
          effectiveFrom: "2007-06-29",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법 시행령",
              article: "제21조",
              quote: "사용기간이 30일 미만인 일용근로자",
              ref: "근로기준법 시행령#제21조",
              check: {
                ok: true,
                versionFrom: "2025-10-23",
                versionStatus: "current",
                hash: "506821458085",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "wageStatement.electronic",
      label: "임금명세서 전자 교부",
      category: "docs",
      unit: "문구",
      check: "B22",
      usedIn: [
        "08",
        "17"
      ],
      values: [
        {
          value: "서면(전자문서를 포함한다)",
          effectiveFrom: "2021-11-19",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법",
              article: "제48조",
              quote: "전자문서",
              paragraph: 2,
              ref: "근로기준법#제48조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "29f6eefca711",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "severance.basic",
      label: "퇴직금",
      category: "end",
      unit: "식",
      check: "A11",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: {
            daysPerYear: 30,
            minServiceYears: 1,
            minWeeklyHours: 15,
            paymentDays: 14,
            averageWage: "3개월 임금 총액 / 총일수, 통상임금보다 적으면 통상임금"
          },
          effectiveFrom: "2021-04-13",
          effectiveTo: null,
          status: "partial",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "퇴직급여법",
              article: "제8조",
              quote: "계속근로기간 1년에 대하여 30일분 이상의 평균임금",
              paragraph: 1,
              ref: "퇴직급여법#제8조①",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "e8f3fbb26645",
                lawEffective: "2026-09-18",
                lawNumber: "법률 제21475호"
              }
            },
            {
              type: "law",
              law: "퇴직급여법",
              article: "제4조",
              quote: "계속근로기간이 1년 미만인 근로자",
              paragraph: 1,
              ref: "퇴직급여법#제4조①",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "524a9f6944c0",
                lawEffective: "2026-09-18",
                lawNumber: "법률 제21475호"
              }
            },
            {
              type: "law",
              law: "퇴직급여법",
              article: "제9조",
              quote: "14일 이내에 퇴직금을 지급하여야 한다",
              paragraph: 1,
              ref: "퇴직급여법#제9조①",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "583f5b317f58",
                lawEffective: "2026-09-18",
                lawNumber: "법률 제21475호"
              }
            },
            {
              type: "law",
              law: "근로기준법",
              article: "제2조",
              quote: "통상임금액을 평균임금으로 한다",
              paragraph: 2,
              ref: "근로기준법#제2조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "4967494b65cf",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21533호"
              }
            }
          ],
          note: "상여·연차수당 3/12 가산과 일할 계산은 법령에 없음 → 22번"
        }
      ]
    },
    {
      id: "insurance.pension.rate",
      label: "국민연금 보험료율 (근로자·사용자 각각)",
      category: "insurance",
      unit: "비율",
      check: "A2",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: 0.0475,
          effectiveFrom: "2026-01-01",
          effectiveTo: "2026-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "국민연금법",
              article: "제4조",
              quote: "2026년은 1만분의 475",
              paragraph: 1,
              addendum: "20903",
              ref: "국민연금법#부칙(제20903호)제4조①",
              check: {
                ok: true,
                versionFrom: null,
                versionStatus: "current",
                hash: "a1fe03bf6c1b",
                lawEffective: "2026-10-20",
                lawNumber: "법률 제22096호"
              }
            }
          ]
        },
        {
          value: 0.05,
          effectiveFrom: "2027-01-01",
          effectiveTo: "2027-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "국민연금법",
              article: "제4조",
              quote: "2027년은 1만분의 500",
              paragraph: 1,
              addendum: "20903",
              ref: "국민연금법#부칙(제20903호)제4조①",
              check: {
                ok: true,
                versionFrom: null,
                versionStatus: "current",
                hash: "a1fe03bf6c1b",
                lawEffective: "2026-10-20",
                lawNumber: "법률 제22096호"
              }
            }
          ]
        },
        {
          value: 0.0525,
          effectiveFrom: "2028-01-01",
          effectiveTo: "2028-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "국민연금법",
              article: "제4조",
              quote: "2028년은 1만분의 525",
              paragraph: 1,
              addendum: "20903",
              ref: "국민연금법#부칙(제20903호)제4조①",
              check: {
                ok: true,
                versionFrom: null,
                versionStatus: "current",
                hash: "a1fe03bf6c1b",
                lawEffective: "2026-10-20",
                lawNumber: "법률 제22096호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "insurance.pension.baseIncome",
      label: "국민연금 기준소득월액 하한·상한",
      category: "insurance",
      unit: "원",
      check: "A2",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: {
            min: 41e4,
            max: 659e4,
            truncateUnder: 1e3
          },
          effectiveFrom: "2026-07-01",
          effectiveTo: "2027-06-30",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "notice",
              ref: "보건복지부고시 제2026-31호",
              quote: "410천원",
              url: "https://www.law.go.kr/행정규칙/국민연금기준소득월액하한액과상한액",
              check: {
                ok: null,
                reason: "원본 파일 없음 (화면 확인)"
              }
            },
            {
              type: "law",
              law: "국민연금법 시행령",
              article: "제5조",
              quote: "천원 미만을 버린 금액",
              paragraph: 1,
              ref: "국민연금법 시행령#제5조①",
              check: {
                ok: true,
                versionFrom: "2026-01-01",
                versionStatus: "current",
                hash: "bcf9e0fc953d",
                lawEffective: "2026-01-01",
                lawNumber: "대통령령 제35602호"
              }
            },
            {
              type: "law",
              law: "국민연금법 시행령",
              article: "제5조",
              quote: "해당 연도 7월부터 다음 연도 6월까지",
              paragraph: 4,
              ref: "국민연금법 시행령#제5조④",
              check: {
                ok: true,
                versionFrom: "2026-01-01",
                versionStatus: "current",
                hash: "bcf9e0fc953d",
                lawEffective: "2026-01-01",
                lawNumber: "대통령령 제35602호"
              }
            }
          ],
          note: "고시 본문은 국가법령정보센터 행정규칙 화면에서 확인(파일 미보관)"
        }
      ]
    },
    {
      id: "insurance.pension.age",
      label: "국민연금 사업장가입자 나이",
      category: "insurance",
      unit: "세",
      check: "B1",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: {
            min: 18,
            maxExclusive: 60
          },
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "국민연금법",
              article: "제8조",
              quote: "18세 이상 60세 미만",
              paragraph: 1,
              ref: "국민연금법#제8조①",
              check: {
                ok: true,
                versionFrom: "2026-10-20",
                versionStatus: "current",
                hash: "73357ad482a9",
                lawEffective: "2026-10-20",
                lawNumber: "법률 제22096호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "insurance.health.rate",
      label: "건강보험료율 (합계, 근로자·사용자 반씩)",
      category: "insurance",
      unit: "비율",
      check: "A3",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: 0.0719,
          effectiveFrom: "2026-01-01",
          effectiveTo: "2026-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "국민건강보험법 시행령",
              article: "제44조",
              quote: "1만분의 719",
              paragraph: 1,
              ref: "국민건강보험법 시행령#제44조①",
              check: {
                ok: true,
                versionFrom: "2026-10-01",
                versionStatus: "current",
                hash: "dd6b160fdef9",
                lawEffective: "2026-10-01",
                lawNumber: "대통령령 제36675호"
              }
            }
          ]
        },
        {
          value: 0.0719,
          effectiveFrom: "2027-01-01",
          effectiveTo: "2027-12-31",
          status: "announced",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "press",
              ref: "보건복지부 보도자료 2026.9.8",
              url: "https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&act=view&list_no=1491824",
              note: "건강보험정책심의위원회 2027년 7.19% 유지 의결",
              check: {
                ok: null,
                reason: "보도자료 (법령 개정 전)"
              }
            }
          ],
          note: "시행령 개정 전"
        }
      ]
    },
    {
      id: "insurance.ltc.rate",
      label: "장기요양보험료율 (소득 대비 합계)",
      category: "insurance",
      unit: "비율",
      check: "A3",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: 9448e-6,
          effectiveFrom: "2026-01-01",
          effectiveTo: "2026-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "노인장기요양보험법 시행령",
              article: "제4조",
              quote: "100만분의 9,448",
              ref: "노인장기요양보험법 시행령#제4조",
              check: {
                ok: true,
                versionFrom: "2026-05-12",
                versionStatus: "current",
                hash: "887b4aeebd1a",
                lawEffective: "2026-05-12",
                lawNumber: "대통령령 제36325호"
              }
            }
          ]
        },
        {
          value: 9994e-6,
          effectiveFrom: "2027-01-01",
          effectiveTo: "2027-12-31",
          status: "announced",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "press",
              ref: "보건복지부 보도자료 2026.10.30",
              url: "https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&act=view&list_no=1492396",
              note: "장기요양위원회 2027년 0.9994% 의결",
              check: {
                ok: null,
                reason: "보도자료 (법령 개정 전)"
              }
            }
          ],
          note: "시행령 개정 전"
        }
      ]
    },
    {
      id: "insurance.employment.unemploymentRate",
      label: "고용보험 실업급여 보험료율 (합계, 반씩)",
      category: "insurance",
      unit: "비율",
      check: "A4",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: 0.018,
          effectiveFrom: "2022-07-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "징수법 시행령",
              article: "제12조",
              quote: "실업급여의 보험료율: 1천분의 18",
              paragraph: 1,
              ref: "징수법 시행령#제12조①",
              check: {
                ok: true,
                versionFrom: "2025-12-23",
                versionStatus: "current",
                hash: "46cdc42f7706",
                lawEffective: "2025-12-23",
                lawNumber: "대통령령 제35935호"
              }
            }
          ]
        }
      ],
      note: "2027년 2.0%안은 시행령 개정 전이라 넣지 않음"
    },
    {
      id: "insurance.employment.stabilityRate",
      label: "고용안정·직업능력개발 보험료율 (사용자)",
      category: "insurance",
      unit: "비율",
      check: "A4",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: {
            under150: 25e-4
          },
          effectiveFrom: "2013-07-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "징수법 시행령",
              article: "제12조",
              quote: "상시근로자수가 150명 미만인 사업주의 사업: 1만분의 25",
              paragraph: 1,
              ref: "징수법 시행령#제12조①",
              check: {
                ok: true,
                versionFrom: "2025-12-23",
                versionStatus: "current",
                hash: "46cdc42f7706",
                lawEffective: "2025-12-23",
                lawNumber: "대통령령 제35935호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "insurance.industrial.rate",
      label: "산재보험료율 (음식·숙박·도소매)",
      category: "insurance",
      unit: "비율",
      check: "A5",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: {
            business: 8e-3,
            commute: 6e-4,
            total: 86e-4
          },
          effectiveFrom: "2026-01-01",
          effectiveTo: "2026-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "notice",
              ref: "고용노동부고시 제2025-91호 별지",
              quote: "8",
              file: "[별지] 2026년도 사업종류별 산재보험료율(2026년도 사업종류별 산재보험료율).pdf",
              url: "https://www.moel.go.kr/info/lawinfo/instruction/view.do?bbs_seq=20251201757",
              check: {
                ok: true
              }
            }
          ],
          note: "전액 사용자. 2027년 고시는 12월 말 예정"
        }
      ]
    },
    {
      id: "insurance.employment.eligibility",
      label: "고용보험 적용 제외 기준",
      category: "insurance",
      unit: "조건",
      check: "B1",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: {
            excludeIf: "월 60시간 미만 또는 주 15시간 미만",
            except: [
              "3개월 이상 계속 근로",
              "일용근로자"
            ]
          },
          effectiveFrom: "2023-06-27",
          effectiveTo: "2026-12-31",
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "고용보험법 시행령",
              article: "제3조",
              quote: "1개월간 소정근로시간이 60시간 미만이거나 1주간의 소정근로시간이 15시간 미만인 근로자",
              paragraph: 1,
              ref: "고용보험법 시행령#제3조①",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "bd25a2559b49",
                lawEffective: "2026-09-18",
                lawNumber: "대통령령 제36588호"
              }
            }
          ]
        },
        {
          value: {
            excludeIf: "보수가 대통령령 소득기준 미만",
            incomeThreshold: null,
            except: [
              "일용근로자",
              "3개월 이상 계속 근로",
              "둘 이상 사업 합산 신청"
            ]
          },
          effectiveFrom: "2027-01-01",
          effectiveTo: null,
          status: "pending",
          verifiedAt: null,
          verifiedBy: null,
          sources: [
            {
              type: "law",
              law: "고용보험법",
              article: "제10조",
              quote: "보수가 대통령령으로 정하는 소득 기준",
              paragraph: 1,
              ref: "고용보험법#제10조①",
              check: {
                ok: true,
                versionFrom: "2027-01-01",
                versionStatus: "scheduled",
                hash: "4817e2bf8d23",
                lawEffective: "2026-09-18",
                lawNumber: "법률 제21473호"
              }
            }
          ],
          note: "소득기준 금액은 시행령 확정 전 (입법예고 월 80만 원은 쓰지 않음)"
        }
      ]
    },
    {
      id: "insurance.employment.age65",
      label: "65세 이후 신규 고용 시 실업급여 미적용",
      category: "insurance",
      unit: "세",
      check: "B2",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: 65,
          effectiveFrom: "2019-01-15",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "고용보험법",
              article: "제10조",
              quote: "65세 이후에 고용",
              paragraph: 2,
              ref: "고용보험법#제10조②",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "3cf44b1c6bcc",
                lawEffective: "2026-09-18",
                lawNumber: "법률 제21473호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "insurance.reportDeadline",
      label: "4대보험 취득·상실 신고 기한",
      category: "deadline",
      unit: "기한",
      check: "B3",
      usedIn: [
        "10",
        "11"
      ],
      values: [
        {
          value: {
            health: {
              days: 14,
              from: "취득·상실일"
            },
            pension: {
              rule: "다음 달 15일"
            },
            employment: {
              rule: "다음 달 15일"
            },
            industrial: {
              rule: "다음 달 15일"
            }
          },
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "국민건강보험법",
              article: "제8조",
              quote: "자격을 취득한 날부터 14일 이내에",
              paragraph: 2,
              ref: "국민건강보험법#제8조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "ac1fc10e6b2c",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21522호"
              }
            },
            {
              type: "law",
              law: "국민건강보험법",
              article: "제10조",
              quote: "자격을 잃은 날부터 14일 이내에",
              paragraph: 2,
              ref: "국민건강보험법#제10조②",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "5537754c83f5",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21522호"
              }
            },
            {
              type: "law",
              law: "국민연금법 시행규칙",
              article: "제6조",
              quote: "다음 달 15일까지",
              paragraph: 1,
              ref: "국민연금법 시행규칙#제6조①",
              check: {
                ok: true,
                versionFrom: "2026-02-13",
                versionStatus: "current",
                hash: "35499c16796d",
                lawEffective: "2026-02-13",
                lawNumber: "보건복지부령 제1157호"
              }
            },
            {
              type: "law",
              law: "고용보험법 시행령",
              article: "제7조",
              quote: "다음 달 15일까지",
              paragraph: 1,
              ref: "고용보험법 시행령#제7조①",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "7697c44de3c7",
                lawEffective: "2026-09-18",
                lawNumber: "대통령령 제36588호"
              }
            },
            {
              type: "law",
              law: "징수법",
              article: "제16조의10",
              quote: "다음 달 15일까지",
              paragraph: 3,
              ref: "징수법#제16조의10③",
              check: {
                ok: true,
                versionFrom: "2026-10-08",
                versionStatus: "current",
                hash: "22e0c717c793",
                lawEffective: "2026-10-08",
                lawNumber: "법률 제21532호"
              }
            }
          ]
        }
      ],
      note: "2027.1.1부터 징수법 제16조의10이 '월 보수 등의 신고'(매월)로 바뀜. 취득·상실 기한(③④)은 같음."
    },
    {
      id: "foreignWorker.departureInsurance",
      label: "E-9 출국만기보험",
      category: "insurance",
      unit: "일",
      check: "B14",
      usedIn: [
        "10"
      ],
      values: [
        {
          value: {
            replacesSeverance: true,
            paymentDays: 14
          },
          effectiveFrom: "2025-10-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "외국인고용법",
              article: "제13조",
              quote: "퇴직금제도를 설정한 것으로 본다",
              paragraph: 2,
              ref: "외국인고용법#제13조②",
              check: {
                ok: true,
                versionFrom: "2025-10-01",
                versionStatus: "current",
                hash: "0bf17e45a274",
                lawEffective: "2025-10-01",
                lawNumber: "법률 제21065호"
              }
            },
            {
              type: "law",
              law: "외국인고용법",
              article: "제13조",
              quote: "출국한 때부터 14일",
              paragraph: 3,
              ref: "외국인고용법#제13조③",
              check: {
                ok: true,
                versionFrom: "2025-10-01",
                versionStatus: "current",
                hash: "0bf17e45a274",
                lawEffective: "2025-10-01",
                lawNumber: "법률 제21065호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "healthCertificate",
      label: "보건증(건강진단) 주기",
      category: "docs",
      unit: "년",
      check: "B4",
      usedIn: [
        "07",
        "11"
      ],
      values: [
        {
          value: {
            everyYears: 1,
            windowDaysBeforeAfter: 30
          },
          effectiveFrom: "2026-09-29",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "건강진단규칙",
              article: "제2조",
              quote: "매 1년마다 건강진단을 받아야 한다",
              paragraph: 2,
              ref: "건강진단규칙#제2조②",
              check: {
                ok: true,
                versionFrom: "2026-09-29",
                versionStatus: "current",
                hash: "457f374fa8c3",
                lawEffective: "2026-09-29",
                lawNumber: "총리령 제2156호"
              }
            },
            {
              type: "law",
              law: "건강진단규칙",
              article: "제2조",
              quote: "유효기간은 1년",
              paragraph: 3,
              ref: "건강진단규칙#제2조③",
              check: {
                ok: true,
                versionFrom: "2026-09-29",
                versionStatus: "current",
                hash: "457f374fa8c3",
                lawEffective: "2026-09-29",
                lawNumber: "총리령 제2156호"
              }
            },
            {
              type: "law",
              law: "건강진단규칙",
              article: "제2조",
              quote: "만료일 전후 각각 30일 이내",
              paragraph: 4,
              ref: "건강진단규칙#제2조④",
              check: {
                ok: true,
                versionFrom: "2026-09-29",
                versionStatus: "current",
                hash: "457f374fa8c3",
                lawEffective: "2026-09-29",
                lawNumber: "총리령 제2156호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "foodHygieneEducation",
      label: "식품위생교육 (영업자)",
      category: "docs",
      unit: "시간",
      check: "B11",
      usedIn: [
        "07"
      ],
      values: [
        {
          value: {
            hoursPerYear: 3,
            target: "영업자(종업원 아님)"
          },
          effectiveFrom: "2026-09-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "식품위생법 시행규칙",
              article: "제52조",
              quote: "영 제21조제1호부터 제9호까지의 영업자",
              paragraph: 1,
              ref: "식품위생법 시행규칙#제52조①",
              check: {
                ok: true,
                versionFrom: "2026-09-01",
                versionStatus: "current",
                hash: "1f405af85d24",
                lawEffective: "2026-09-01",
                lawNumber: "총리령 제2150호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "sexualHarassmentEducation",
      label: "직장 내 성희롱 예방교육",
      category: "docs",
      unit: "회",
      check: "B10",
      usedIn: [
        "07"
      ],
      values: [
        {
          value: {
            perYear: 1,
            under10MayPostMaterials: true
          },
          effectiveFrom: "2026-09-18",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "남녀고용평등법 시행령",
              article: "제3조",
              quote: "연 1회 이상",
              paragraph: 1,
              ref: "남녀고용평등법 시행령#제3조①",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "080589a106ee",
                lawEffective: "2026-09-18",
                lawNumber: "대통령령 제36589호"
              }
            },
            {
              type: "law",
              law: "남녀고용평등법 시행령",
              article: "제3조",
              quote: "10명 미만",
              paragraph: 4,
              ref: "남녀고용평등법 시행령#제3조④",
              check: {
                ok: true,
                versionFrom: "2026-09-18",
                versionStatus: "current",
                hash: "080589a106ee",
                lawEffective: "2026-09-18",
                lawNumber: "대통령령 제36589호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "fixedTerm.maxYears",
      label: "기간제 사용 기간",
      category: "docs",
      unit: "년",
      check: "B8",
      usedIn: [
        "07",
        "11"
      ],
      values: [
        {
          value: {
            years: 2,
            under5Applies: false
          },
          effectiveFrom: "2007-07-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "기간제법",
              article: "제4조",
              quote: "2년을 초과하지 아니하는 범위 안에서",
              paragraph: 1,
              ref: "기간제법#제4조①",
              check: {
                ok: true,
                versionFrom: "2021-05-18",
                versionStatus: "current",
                hash: "b499a2091947",
                lawEffective: "2021-05-18",
                lawNumber: "법률 제18177호"
              }
            },
            {
              type: "law",
              law: "기간제법 시행령",
              quote: "제17조",
              appendix: "[별표 1]",
              ref: "기간제법 시행령#별표1",
              check: {
                ok: true,
                appendixHash: "64bdaae00f4f",
                lawEffective: "2021-04-08",
                lawNumber: "대통령령 제31611호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "fixedTerm.writtenTerms",
      label: "기간제·단시간 서면 명시 사항",
      category: "docs",
      unit: "목록",
      check: "B8",
      usedIn: [
        "07"
      ],
      values: [
        {
          value: {
            all: [
              "계약기간",
              "근로시간·휴게",
              "임금 구성·계산·지급방법",
              "휴일·휴가",
              "장소·업무",
              "근로일·근로일별 근로시간(단시간)"
            ],
            under5: [
              "계약기간",
              "휴게",
              "임금 구성·계산·지급방법",
              "휴일",
              "장소·업무"
            ]
          },
          effectiveFrom: "2020-05-26",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "기간제법",
              article: "제17조",
              quote: "근로일 및 근로일별 근로시간",
              ref: "기간제법#제17조",
              check: {
                ok: true,
                versionFrom: "2021-05-18",
                versionStatus: "current",
                hash: "547bab94f3ff",
                lawEffective: "2021-05-18",
                lawNumber: "법률 제18177호"
              }
            },
            {
              type: "law",
              law: "기간제법 시행령",
              quote: "제17조제1호·제2호(휴게에 관한 사항에 한정한다)·제3호·제4호(휴일에 관한 사항에 한정한다)·제5호",
              appendix: "[별표 1]",
              ref: "기간제법 시행령#별표1",
              check: {
                ok: true,
                appendixHash: "64bdaae00f4f",
                lawEffective: "2021-04-08",
                lawNumber: "대통령령 제31611호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "fixedTerm.partTimeOvertime",
      label: "단시간근로자 초과근로",
      category: "wage",
      unit: "비율",
      check: "B8",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: {
            premium: 0.5,
            weeklyMax: 12,
            consentRequired: true
          },
          effectiveFrom: "2014-09-19",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "기간제법",
              article: "제6조",
              quote: "1주간에 12시간을 초과하여 근로하게 할 수 없다",
              paragraph: 1,
              ref: "기간제법#제6조①",
              check: {
                ok: true,
                versionFrom: "2021-05-18",
                versionStatus: "current",
                hash: "a78f172db55e",
                lawEffective: "2021-05-18",
                lawNumber: "법률 제18177호"
              }
            },
            {
              type: "law",
              law: "기간제법",
              article: "제6조",
              quote: "통상임금의 100분의 50 이상을 가산",
              paragraph: 3,
              ref: "기간제법#제6조③",
              check: {
                ok: true,
                versionFrom: "2021-05-18",
                versionStatus: "current",
                hash: "a78f172db55e",
                lawEffective: "2021-05-18",
                lawNumber: "법률 제18177호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      },
      note: "1~4명은 기간제법 시행령 별표 1에 제6조가 없어 미적용"
    },
    {
      id: "holidays.legal",
      label: "유급 공휴일 근거 (5명 이상)",
      category: "calendar",
      unit: "목록",
      check: "B20",
      usedIn: [
        "08",
        "20"
      ],
      values: [
        {
          value: {
            source: "관공서의 공휴일에 관한 규정 제2조(일요일 제외) + 제3조 대체공휴일",
            includesLaborDay: true
          },
          effectiveFrom: "2026-05-11",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "근로기준법 시행령",
              article: "제30조",
              quote: "제2조 각 호(제1호는 제외한다)",
              paragraph: 2,
              ref: "근로기준법 시행령#제30조②",
              check: {
                ok: true,
                versionFrom: "2025-10-23",
                versionStatus: "current",
                hash: "9cfcc3a721fa",
                lawEffective: "2025-10-23",
                lawNumber: "대통령령 제35436호"
              }
            },
            {
              type: "law",
              law: "공휴일규정",
              article: "제2조",
              quote: "노동절(5월 1일)",
              ref: "공휴일규정#제2조",
              check: {
                ok: true,
                versionFrom: "2026-05-11",
                versionStatus: "current",
                hash: "a1c0e84bd722",
                lawEffective: "2026-05-11",
                lawNumber: "대통령령 제36290호"
              }
            }
          ]
        }
      ],
      appliesTo: {
        minEmployees: 5
      }
    },
    {
      id: "tax.mealAllowanceNonTaxable",
      label: "식대 비과세 한도",
      category: "tax",
      unit: "원/월",
      check: "A7",
      usedIn: [
        "08",
        "10"
      ],
      values: [
        {
          value: 2e5,
          effectiveFrom: "2023-01-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "소득세법",
              article: "제12조",
              quote: "20만원",
              ref: "소득세법#제12조",
              check: {
                ok: true,
                versionFrom: "2026-07-01",
                versionStatus: "current",
                hash: "138d36346761",
                lawEffective: "2026-07-01",
                lawNumber: "법률 제21221호"
              }
            }
          ]
        }
      ]
    },
    {
      id: "tax.dailyWorker",
      label: "일용근로자 원천징수",
      category: "tax",
      unit: "식",
      check: "A8",
      usedIn: [
        "08"
      ],
      values: [
        {
          value: {
            deductionPerDay: 15e4,
            rate: 0.06,
            taxCredit: 0.55
          },
          effectiveFrom: "2019-01-01",
          effectiveTo: null,
          status: "verified",
          verifiedAt: "2026-11-04",
          verifiedBy: "지원",
          sources: [
            {
              type: "law",
              law: "소득세법",
              article: "제47조",
              quote: "15만원",
              paragraph: 2,
              ref: "소득세법#제47조②",
              check: {
                ok: true,
                versionFrom: "2026-07-01",
                versionStatus: "current",
                hash: "01071484c8b1",
                lawEffective: "2026-07-01",
                lawNumber: "법률 제21221호"
              }
            },
            {
              type: "law",
              law: "소득세법",
              article: "제59조",
              quote: "100분의 55",
              paragraph: 3,
              ref: "소득세법#제59조③",
              check: {
                ok: true,
                versionFrom: "2026-07-01",
                versionStatus: "current",
                hash: "ad861c6bb9f6",
                lawEffective: "2026-07-01",
                lawNumber: "법률 제21221호"
              }
            },
            {
              type: "law",
              law: "소득세법",
              article: "제129조",
              quote: "일용근로자의 근로소득에 대해서는 100분의 6",
              paragraph: 1,
              ref: "소득세법#제129조①",
              check: {
                ok: true,
                versionFrom: "2026-07-01",
                versionStatus: "current",
                hash: "ff9559b35268",
                lawEffective: "2026-07-01",
                lawNumber: "법률 제21221호"
              }
            }
          ]
        }
      ]
    }
  ]
};
var RULES_FILE = rules_default;
var BY_ID = new Map(RULES_FILE.rules.map((r) => [r.id, r]));
function allRules() {
  return RULES_FILE.rules;
}
function resolveRule(id, date) {
  const rule = BY_ID.get(id);
  if (!rule) return { ok: false, id, label: id, reason: "unknownRule", sources: [] };
  const hit = rule.values.find(
    (v) => (!v.effectiveFrom || date >= v.effectiveFrom) && (!v.effectiveTo || date <= v.effectiveTo)
  );
  if (!hit) return { ok: false, id, label: rule.label, reason: "noValueForDate", sources: [], note: rule.note };
  if (hit.status === "pending" || hit.value === null || hit.value === void 0) {
    return {
      ok: false,
      id,
      label: rule.label,
      reason: "pending",
      status: hit.status,
      effectiveFrom: hit.effectiveFrom,
      sources: hit.sources ?? [],
      note: hit.note ?? rule.note
    };
  }
  return {
    ok: true,
    id,
    label: rule.label,
    value: hit.value,
    status: hit.status,
    effectiveFrom: hit.effectiveFrom,
    effectiveTo: hit.effectiveTo,
    verifiedAt: hit.verifiedAt,
    sources: hit.sources ?? [],
    note: hit.note ?? rule.note
  };
}
function ruleValue(id, date) {
  const r = resolveRule(id, date);
  if (!r.ok) throw new Error(`규칙 ${id}의 ${date} 기준 값이 없습니다 (${r.reason})`);
  return r.value;
}
var STATUS_LABEL = {
  verified: "원문 확인",
  partial: "일부 확인",
  announced: "발표 기준 · 법령 개정 전",
  pending: "기준 대기 · 시행령 미정",
  needsExpert: "노무사 확인 필요",
  missing: "이 날짜의 기준이 아직 없어요"
};
var DAY_MS = 864e5;
function isISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
function parts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}
function fromParts(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function toDays(iso) {
  const { y, m, d } = parts(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}
function fromDays(n) {
  const dt = new Date(n * DAY_MS);
  return fromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function addDays(iso, n) {
  return fromDays(toDays(iso) + n);
}
function diffDays(a, b) {
  return toDays(b) - toDays(a);
}
function addMonths(iso, n) {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12 + 1;
  return fromParts(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
function addYears(iso, n) {
  return addMonths(iso, n * 12);
}
function monthOf(iso) {
  return iso.slice(0, 7);
}
function startOfMonth(ym) {
  return `${ym}-01`;
}
function endOfMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return fromParts(y, m, daysInMonth(y, m));
}
function addMonthsYM(ym, n) {
  return monthOf(addMonths(`${ym}-01`, n));
}
function nextMonth15(iso) {
  const { y, m } = parts(iso);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return fromParts(ny, nm, 15);
}
function weekday(iso) {
  return ((toDays(iso) + 3) % 7 + 7) % 7;
}
function startOfWeek(iso) {
  return addDays(iso, -weekday(iso));
}
function listDates(from, to) {
  const out = [];
  for (let n = toDays(from); n <= toDays(to); n++) out.push(fromDays(n));
  return out;
}
function minDate(a, b) {
  return a <= b ? a : b;
}
function maxDate(a, b) {
  return a >= b ? a : b;
}
function fmtMD(iso) {
  if (!iso) return "—";
  const { m, d } = parts(iso);
  return `${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}
function dDayLabel(days) {
  if (days === 0) return "D-day";
  return days > 0 ? `D-${days}` : `D+${-days}`;
}
function isHHMM(s) {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function spanMinutes(start, end) {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  return { s, e };
}
function nightOverlapMinutes(start, end) {
  const { s, e } = spanMinutes(start, end);
  const windows = [
    [-120, 360],
    // 전날 22:00 ~ 당일 06:00
    [1320, 1800],
    // 당일 22:00 ~ 다음날 06:00
    [2760, 3240]
  ];
  let total = 0;
  for (const [ws, we] of windows) total += Math.max(0, Math.min(e, we) - Math.max(s, ws));
  return total;
}
function localDate(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime.slice(0, 10);
  return fromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
var HOLIDAY_SOURCE = {
  label: "앱 내장 목록 (특일정보 API 연결 전)",
  status: "checked",
  note: "2026·2027년은 우주항공청 월력요항과 공휴일 규정 개정(노동절·제헌절)에 맞춰 확인했어요(2026-11-07). 2028년부터는 API 연결이나 목록 추가가 필요해요."
};
var HOLIDAYS = [
  { date: "2026-01-01", name: "신정" },
  { date: "2026-02-16", name: "설날 연휴" },
  { date: "2026-02-17", name: "설날" },
  { date: "2026-02-18", name: "설날 연휴" },
  { date: "2026-03-02", name: "삼일절 대체공휴일", substitute: true },
  { date: "2026-05-01", name: "노동절" },
  { date: "2026-05-05", name: "어린이날" },
  { date: "2026-05-25", name: "부처님오신날 대체공휴일", substitute: true },
  { date: "2026-06-03", name: "전국동시지방선거" },
  { date: "2026-07-17", name: "제헌절" },
  { date: "2026-08-17", name: "광복절 대체공휴일", substitute: true },
  { date: "2026-09-24", name: "추석 연휴" },
  { date: "2026-09-25", name: "추석" },
  { date: "2026-10-05", name: "개천절 대체공휴일", substitute: true },
  { date: "2026-10-09", name: "한글날" },
  { date: "2026-12-25", name: "성탄절" },
  { date: "2027-01-01", name: "신정" },
  { date: "2027-02-08", name: "설날 연휴" },
  { date: "2027-02-09", name: "설날 대체공휴일", substitute: true },
  { date: "2027-03-01", name: "삼일절" },
  { date: "2027-05-03", name: "노동절 대체공휴일", substitute: true },
  { date: "2027-05-05", name: "어린이날" },
  { date: "2027-05-13", name: "부처님오신날" },
  { date: "2027-07-19", name: "제헌절 대체공휴일", substitute: true },
  { date: "2027-08-16", name: "광복절 대체공휴일", substitute: true },
  { date: "2027-09-14", name: "추석 연휴" },
  { date: "2027-09-15", name: "추석" },
  { date: "2027-09-16", name: "추석 연휴" },
  { date: "2027-10-04", name: "개천절 대체공휴일", substitute: true },
  { date: "2027-10-11", name: "한글날 대체공휴일", substitute: true },
  { date: "2027-12-27", name: "성탄절 대체공휴일", substitute: true }
];
var WEEKEND_HOLIDAYS = [
  { date: "2026-03-01", name: "삼일절" },
  { date: "2026-05-24", name: "부처님오신날" },
  { date: "2026-06-06", name: "현충일" },
  { date: "2026-08-15", name: "광복절" },
  { date: "2026-09-26", name: "추석 연휴" },
  { date: "2026-10-03", name: "개천절" },
  { date: "2027-02-06", name: "설날 연휴" },
  { date: "2027-02-07", name: "설날" },
  { date: "2027-05-01", name: "노동절" },
  { date: "2027-06-06", name: "현충일" },
  { date: "2027-07-17", name: "제헌절" },
  { date: "2027-08-15", name: "광복절" },
  { date: "2027-10-03", name: "개천절" },
  { date: "2027-10-09", name: "한글날" },
  { date: "2027-12-25", name: "성탄절" }
];
var MAP = new Map([...HOLIDAYS, ...WEEKEND_HOLIDAYS].map((h) => [h.date, h]));
function holidayOn(date) {
  return MAP.get(date);
}
function registerHolidays(list) {
  let added = 0;
  for (const h of list) {
    if (MAP.has(h.date) || !/^\d{4}-\d{2}-\d{2}$/.test(h.date)) continue;
    MAP.set(h.date, { date: h.date, name: h.name, substitute: /대체/.test(h.name) });
    added++;
  }
  return added;
}
var isUnder5 = (scale) => scale === "1-4";
function conditionAt(conditions, employeeId, date) {
  let hit = null;
  for (const c of conditions) {
    if (c.employeeId !== employeeId || c.effectiveFrom > date) continue;
    if (!hit || c.effectiveFrom > hit.effectiveFrom || c.effectiveFrom === hit.effectiveFrom && c.createdAt > hit.createdAt) hit = c;
  }
  return hit;
}
function conditionHistory(conditions, employeeId) {
  const list = conditions.filter((c) => c.employeeId === employeeId).sort((a, b) => a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : a.createdAt < b.createdAt ? -1 : 1);
  const dedup = [];
  for (const c of list) {
    if (dedup.length && dedup[dedup.length - 1].effectiveFrom === c.effectiveFrom) dedup[dedup.length - 1] = c;
    else dedup.push(c);
  }
  return dedup.map((c, i) => ({ ...c, effectiveTo: i < dedup.length - 1 ? addDays(dedup[i + 1].effectiveFrom, -1) : null }));
}
function netMinutes(s) {
  const { s: a, e } = spanMinutes(s.start, s.end);
  return Math.max(0, e - a - (s.breakMin || 0));
}
function weeklyHours(c) {
  if (!c) return 0;
  if (c.variable) return c.variableWeeklyHours ?? 0;
  return c.schedule.reduce((sum, d) => sum + (d ? netMinutes(d) : 0), 0) / 60;
}
function workDaysPerWeek(c) {
  if (!c || c.variable) return 0;
  return c.schedule.filter(Boolean).length;
}
function dailyScheduledHours(c) {
  if (!c) return 0;
  const days = workDaysPerWeek(c);
  if (!days) return weeklyHours(c) / 5;
  return weeklyHours(c) / days;
}
function isEmployed(e, date) {
  return date >= e.hireDate && (!e.resignDate || date <= e.resignDate);
}
function dayPlan(state, e, date) {
  const ovs = state.overrides.filter((o) => o.employeeId === e.id && o.date === date);
  const cond2 = conditionAt(state.conditions, e.id, date);
  const wd = weekday(date);
  const ph = holidayOn(date);
  const scale = state.workplace?.scale ?? "1-4";
  const base = {
    date,
    employeeId: e.id,
    contract: null,
    shift: null,
    off: null,
    overrides: ovs,
    isWeeklyHoliday: cond2 ? cond2.weeklyHolidayDay === wd : wd === 6,
    publicHoliday: ph ? ph.name : null,
    variableNeedsInput: false
  };
  if (!isEmployed(e, date) || !cond2) return base;
  const contract = cond2.variable ? null : cond2.schedule[wd] ?? null;
  base.contract = contract;
  const change = ovs.find((o) => o.kind === "change");
  const extra = ovs.find((o) => o.kind === "extra");
  const subIn = ovs.find((o) => o.kind === "subIn");
  const offOv = ovs.find((o) => o.kind === "absent" || o.kind === "leave" || o.kind === "subOut");
  if (offOv) {
    base.off = offOv.kind;
    return base;
  }
  const pick = change ?? subIn ?? extra;
  if (pick && pick.start && pick.end) {
    base.shift = {
      employeeId: e.id,
      date,
      start: pick.start,
      end: pick.end,
      breakMin: pick.breakMin,
      kind: pick.kind === "subIn" ? "subIn" : pick.kind === "extra" ? "extra" : "change",
      overrideId: pick.id
    };
    return base;
  }
  if (cond2.variable) {
    base.variableNeedsInput = true;
    return base;
  }
  if (contract) {
    if (ph && !isUnder5(scale)) {
      base.off = "publicHoliday";
      return base;
    }
    base.shift = { employeeId: e.id, date, ...contract, kind: "regular", overrideId: null };
  }
  return base;
}
function currentTimes(rec, edits) {
  const mine = edits.filter((x) => x.recordId === rec.id).sort((a, b) => a.at < b.at ? -1 : 1);
  return mine.length ? mine[mine.length - 1].after : rec.original;
}
function workedSegment(state, e, date) {
  const plan = dayPlan(state, e, date);
  const rec = state.attendance.find((r) => r.employeeId === e.id && r.date === date);
  if (rec) {
    const t = currentTimes(rec, state.attendanceEdits);
    if (rec.status === "confirmed" && t.clockIn && t.clockOut) {
      let start = t.clockIn;
      let end = t.clockOut;
      const breakMin = plan.shift?.breakMin ?? 0;
      if (plan.shift && rec.approval !== "actual") {
        const tol = state.workplace?.lateToleranceMin ?? 5;
        const ps = toMin(plan.shift.start);
        const pe = spanMinutes(plan.shift.start, plan.shift.end).e;
        const ci = toMin(start);
        const co = spanMinutes(plan.shift.start, end).e;
        if (ci < ps || ci - ps <= tol) start = plan.shift.start;
        if (co > pe || pe - co <= tol) end = plan.shift.end;
      }
      return { seg: { date, start, end, breakMin, source: "attendance", recordNo: rec.recordNo }, pending: false, plan };
    }
    if (plan.shift) {
      return {
        seg: { date, start: plan.shift.start, end: plan.shift.end, breakMin: plan.shift.breakMin, source: "pendingAsSchedule", recordNo: rec.recordNo },
        pending: true,
        plan
      };
    }
    return { seg: null, pending: true, plan };
  }
  if (plan.shift) {
    return { seg: { date, start: plan.shift.start, end: plan.shift.end, breakMin: plan.shift.breakMin, source: "schedule", recordNo: null }, pending: false, plan };
  }
  return { seg: null, pending: false, plan };
}
function classifyClock(plan, clockIn, clockOut, toleranceMin, gps) {
  if (gps === "outside" || gps === "denied") return { status: "exception", reason: gps === "outside" ? "반경 밖 기록" : "위치 확인 거부 — 수동 기록" };
  if (!clockIn) return { status: "exception", reason: "출근 기록 없음" };
  if (!clockOut) return { status: "pending", reason: "퇴근 기록 전" };
  if (!plan.shift) return { status: "pending", reason: "예정에 없는 근무" };
  const ps = toMin(plan.shift.start);
  const pe = spanMinutes(plan.shift.start, plan.shift.end).e;
  const ci = toMin(clockIn);
  const co = spanMinutes(plan.shift.start, clockOut).e;
  if (ci < ps - toleranceMin) return { status: "pending", reason: "예정보다 일찍 출근" };
  if (co > pe + toleranceMin) return { status: "pending", reason: "예정보다 늦게 퇴근" };
  const notes = [];
  if (ci > ps + toleranceMin) notes.push("지각(일하지 않은 시간만 빼고 계산)");
  if (co < pe - toleranceMin) notes.push("조퇴(일하지 않은 시간만 빼고 계산)");
  return { status: "confirmed", reason: notes.join(", ") };
}
function contractDriftWeeks(state, e, baseDate) {
  let diffWeeks = 0;
  for (let w = 1; w <= 4; w++) {
    const ws = addDays(startOfWeek(baseDate), -7 * w);
    const cond2 = conditionAt(state.conditions, e.id, addDays(ws, 6));
    if (!cond2 || cond2.variable) continue;
    let actual = 0;
    for (const d of listDates(ws, addDays(ws, 6))) {
      const p = dayPlan(state, e, d);
      if (p.shift) actual += netMinutes(p.shift);
    }
    if (Math.abs(actual / 60 - weeklyHours(cond2)) >= 1) diffWeeks++;
  }
  return diffWeeks;
}
var won = (n) => Math.round(n);
function weeklyHolidayHours(weeklyHrs, date) {
  const min = ruleValue("weeklyHoliday.minWeeklyHours", date);
  if (weeklyHrs < min) return 0;
  return Math.min(weeklyHrs, 40) / 40 * 8;
}
function monthlyHours(weeklyHrs, date) {
  return Math.round((weeklyHrs + weeklyHolidayHours(weeklyHrs, date)) * 365 / 7 / 12);
}
function monthlyWageEstimate(c, date) {
  if (!c) return 0;
  return won(monthlyHours(weeklyHours(c), date) * c.hourlyWage) + (c.mealAllowance || 0);
}
var VERDICT_LABEL = {
  expected: "가입 대상 예상",
  excluded: "제외 예상",
  check: "확인 필요",
  noRule: "기준 없음"
};
var INSURANCE_LABEL = {
  pension: "국민연금",
  health: "건강보험",
  ltc: "장기요양",
  employment: "고용보험",
  industrial: "산재보험"
};
function judgeInputFor(e, c) {
  return {
    ageBand: e.ageBand,
    startedBefore65: e.startedBefore65,
    employmentType: e.employmentType,
    hireDate: e.hireDate,
    contractEnd: e.contractEnd,
    isForeign: e.isForeign,
    visa: e.foreign?.visa ?? null,
    nationality: e.foreign?.nationality ?? "",
    weeklyHours: weeklyHours(c),
    variable: !!c?.variable
  };
}
function contractMonths(j) {
  if (j.employmentType === "regular" || !j.contractEnd) return Infinity;
  return (diffDays(j.hireDate, j.contractEnd) + 1) / 30.4;
}
function judgeInsurance(j, date) {
  const monthlyH = j.weeklyHours * 365 / 7 / 12;
  const months = contractMonths(j);
  const daily = j.employmentType === "daily";
  const variableNote = j.variable ? ["매주 달라요 — 주 평균 예상 시간으로 판정"] : [];
  const out = [];
  out.push({ kind: "industrial", verdict: "expected", reasons: ["하루만 일해도 적용, 보험료는 전액 사장님 부담"], basis: ["insurance.industrial.rate"] });
  {
    const rule = resolveRule("insurance.employment.eligibility", date);
    const reasons = [...variableNote];
    let verdict;
    if (j.isForeign) {
      verdict = "check";
      reasons.push("외국인 고용보험 적용은 체류자격별 확인 필요 (원문 확인 전)");
    } else if (!rule.ok) {
      if (daily || months >= 3) {
        verdict = "expected";
        reasons.push(daily ? "일용근로자는 적용" : "3개월 이상 계속 근로는 적용");
      } else {
        verdict = "noRule";
        reasons.push('2027.1.1부터 "보수가 소득기준 미만이면 제외" — 소득기준 시행령 확정 전이라 이 날짜의 기준이 아직 없어요');
      }
    } else if (daily) {
      verdict = "expected";
      reasons.push("일용근로자는 적용 (근로내용 확인신고로 갈음)");
    } else if (monthlyH < 60 || j.weeklyHours < 15) {
      if (months >= 3) {
        verdict = "expected";
        reasons.push("주 15시간 미만이지만 3개월 이상 계속 근로는 적용");
      } else {
        verdict = "excluded";
        reasons.push(`월 60시간 미만 또는 주 15시간 미만 (주 ${j.weeklyHours.toFixed(1)}시간)`);
      }
    } else {
      verdict = "expected";
      reasons.push(`주 ${j.weeklyHours.toFixed(1)}시간`);
    }
    if (verdict === "expected" && j.ageBand === "65+") {
      if (j.startedBefore65 === null) {
        verdict = "check";
        reasons.push("65세 전부터 일했는지 확인 필요");
      } else if (!j.startedBefore65) reasons.push("65세 이후 새로 고용 — 실업급여 보험료 없음(고용안정 사장님분만)");
    }
    out.push({ kind: "employment", verdict, reasons, basis: ["insurance.employment.eligibility", "insurance.employment.age65"] });
  }
  {
    const reasons = [...variableNote];
    let verdict;
    if (j.isForeign) {
      verdict = "check";
      reasons.push("외국인 건강보험은 확인 필요");
    } else if (daily) {
      verdict = "check";
      reasons.push("하루 단위 고용 — 1개월 미만 일용은 제외, 계속 여부 확인 필요");
    } else if (months < 1) {
      verdict = "excluded";
      reasons.push("1개월 미만 계약");
    } else if (monthlyH < 60 || j.weeklyHours < 15) {
      verdict = "excluded";
      reasons.push(monthlyH < 60 ? `월 60시간 미만 단시간 (월 약 ${monthlyH.toFixed(0)}시간)` : `주 15시간 미만 — 월 60시간 경계 근처(월 약 ${monthlyH.toFixed(0)}시간)라 실제 계약 기준 확인 권장`);
    } else {
      verdict = "expected";
      reasons.push(`월 약 ${monthlyH.toFixed(0)}시간`);
    }
    out.push({ kind: "health", verdict, reasons, basis: ["insurance.health.rate"] });
    out.push({ kind: "ltc", verdict, reasons: ["건강보험과 함께 부과"], basis: ["insurance.ltc.rate"] });
  }
  {
    const reasons = [...variableNote];
    let verdict;
    if (j.ageBand === "under18") {
      verdict = "check";
      reasons.push("18세 미만 — 확인 필요");
    } else if (j.ageBand === "60-64" || j.ageBand === "65+") {
      verdict = "excluded";
      reasons.push("사업장가입자 나이 18세 이상 60세 미만");
    } else if (j.isForeign) {
      verdict = "check";
      reasons.push(j.nationality ? `국적(${j.nationality})별 상호주의 확인 필요` : "국적별 상호주의 — 국적 입력 시 안내, 확인 필요");
    } else if (daily) {
      verdict = "check";
      reasons.push("일용 — 1개월 이상 계속 + 월 8일 이상 또는 월 60시간 이상이면 포함");
    } else if (months < 1) {
      verdict = "excluded";
      reasons.push("1개월 미만 계약");
    } else if (monthlyH < 60 || j.weeklyHours < 15) {
      verdict = "excluded";
      reasons.push(monthlyH < 60 ? "월 60시간 미만 단시간 (예외 있음)" : "주 15시간 미만 — 월 60시간 경계 근처, 실제 계약 기준 확인 권장 (예외 있음)");
    } else {
      verdict = "expected";
      reasons.push("18세 이상 60세 미만, 월 60시간 이상");
    }
    out.push({ kind: "pension", verdict, reasons, basis: ["insurance.pension.age", "insurance.pension.rate"] });
  }
  const order = ["pension", "health", "ltc", "employment", "industrial"];
  return order.map((k) => out.find((o) => o.kind === k));
}
var floor10 = (n) => Math.floor(n / 10) * 10;
function st(r) {
  if (!r.ok) return "missing";
  return r.status === "announced" ? "announced" : r.status === "partial" ? "partial" : "verified";
}
function premiums(base, date, judgments, industry, ageBand, startedBefore65) {
  const rows = [];
  const v = (k) => judgments.find((j) => j.kind === k)?.verdict ?? "check";
  const excludedRow = (kind, verdict, basis) => ({ kind, verdict, worker: 0, employer: 0, status: "excluded", note: verdict === "excluded" ? "제외 예상" : "", basis });
  {
    const rate = resolveRule("insurance.pension.rate", date);
    const bi = resolveRule("insurance.pension.baseIncome", date);
    const verdict = v("pension");
    if (verdict === "excluded") rows.push(excludedRow("pension", verdict, ["insurance.pension.rate"]));
    else if (!rate.ok || !bi.ok) rows.push({ kind: "pension", verdict, worker: null, employer: null, status: "missing", note: !rate.ok ? "요율 기준 없음" : "기준소득월액 하한·상한 기준 없음", basis: ["insurance.pension.rate", "insurance.pension.baseIncome"] });
    else {
      const b = Math.min(bi.value.max, Math.max(bi.value.min, Math.floor(base / bi.value.truncateUnder) * bi.value.truncateUnder));
      const amt = floor10(b * rate.value);
      rows.push({ kind: "pension", verdict, worker: amt, employer: amt, status: st(rate), note: `기준소득월액 ${b.toLocaleString("ko-KR")}원 × ${(rate.value * 100).toFixed(2)}%`, basis: ["insurance.pension.rate", "insurance.pension.baseIncome"] });
    }
  }
  {
    const verdict = v("health");
    const hr = resolveRule("insurance.health.rate", date);
    const lr = resolveRule("insurance.ltc.rate", date);
    if (verdict === "excluded") {
      rows.push(excludedRow("health", verdict, ["insurance.health.rate"]));
      rows.push(excludedRow("ltc", verdict, ["insurance.ltc.rate"]));
    } else {
      if (!hr.ok) rows.push({ kind: "health", verdict, worker: null, employer: null, status: "missing", note: "기준 없음", basis: ["insurance.health.rate"] });
      else {
        const amt = floor10(base * hr.value / 2);
        rows.push({ kind: "health", verdict, worker: amt, employer: amt, status: st(hr), note: `${base.toLocaleString("ko-KR")}원 × ${(hr.value / 2 * 100).toFixed(3)}%`, basis: ["insurance.health.rate"] });
      }
      if (!lr.ok) rows.push({ kind: "ltc", verdict, worker: null, employer: null, status: "missing", note: "기준 없음", basis: ["insurance.ltc.rate"] });
      else {
        const amt = floor10(base * lr.value / 2);
        rows.push({ kind: "ltc", verdict, worker: amt, employer: amt, status: st(lr), note: `소득 × ${(lr.value / 2 * 100).toFixed(4)}%`, basis: ["insurance.ltc.rate"] });
      }
    }
  }
  {
    const verdict = v("employment");
    const ur = resolveRule("insurance.employment.unemploymentRate", date);
    const sr = resolveRule("insurance.employment.stabilityRate", date);
    if (verdict === "excluded") rows.push(excludedRow("employment", verdict, ["insurance.employment.eligibility"]));
    else if (verdict === "noRule") rows.push({ kind: "employment", verdict, worker: null, employer: null, status: "missing", note: "이 날짜의 가입 기준이 아직 없어요", basis: ["insurance.employment.eligibility"] });
    else if (!ur.ok || !sr.ok) rows.push({ kind: "employment", verdict, worker: null, employer: null, status: "missing", note: "요율 기준 없음", basis: ["insurance.employment.unemploymentRate"] });
    else {
      const noUnemployment = ageBand === "65+" && startedBefore65 === false;
      const w = noUnemployment ? 0 : floor10(base * ur.value / 2);
      const er = floor10(base * ((noUnemployment ? 0 : ur.value / 2) + sr.value.under150));
      rows.push({ kind: "employment", verdict, worker: w, employer: er, status: st(ur), note: noUnemployment ? "65세 이후 신규 고용 — 실업급여분 없음" : `근로자 ${(ur.value / 2 * 100).toFixed(2)}% / 사장님 ${((ur.value / 2 + sr.value.under150) * 100).toFixed(2)}% (150명 미만)`, basis: ["insurance.employment.unemploymentRate", "insurance.employment.stabilityRate"] });
    }
  }
  {
    const r = resolveRule("insurance.industrial.rate", date);
    if (industry === "service") rows.push({ kind: "industrial", verdict: "expected", worker: 0, employer: null, status: "missing", note: "기타 서비스업 요율은 규칙 파일에 없어요 (음식·숙박·도소매만 확인)", basis: ["insurance.industrial.rate"] });
    else if (!r.ok) rows.push({ kind: "industrial", verdict: "expected", worker: 0, employer: null, status: "missing", note: "이 날짜의 산재요율 고시가 아직 없어요", basis: ["insurance.industrial.rate"] });
    else rows.push({ kind: "industrial", verdict: "expected", worker: 0, employer: floor10(base * r.value.total), status: st(r), note: `${(r.value.total * 100).toFixed(2)}% 전액 사장님`, basis: ["insurance.industrial.rate"] });
  }
  return rows;
}
function premiumTotals(rows) {
  const incomplete = rows.some((r) => r.verdict !== "excluded" && (r.worker === null || r.employer === null || r.verdict === "check"));
  if (rows.some((r) => r.worker === null || r.employer === null)) return { worker: null, employer: null, incomplete: true };
  return { worker: rows.reduce((s, r) => s + (r.worker ?? 0), 0), employer: rows.reduce((s, r) => s + (r.employer ?? 0), 0), incomplete };
}
function insuranceBase(c, date) {
  if (!c) return 0;
  const limit = resolveRule("tax.mealAllowanceNonTaxable", date);
  const meal = c.mealAllowance || 0;
  return monthlyWageEstimate(c, date) - Math.min(meal, limit.ok ? limit.value : 0);
}
function employeeInsurance(state, e, date) {
  const c = conditionAt(state.conditions, e.id, date);
  const judgments = judgeInsurance(judgeInputFor(e, c), date);
  const base = insuranceBase(c, date);
  const rows = premiums(base, date, judgments, state.workplace?.industry ?? "food", e.ageBand, e.startedBefore65);
  return { condition: c, judgments, base, rows, totals: premiumTotals(rows), monthlyHours: c ? monthlyHours(weeklyHours(c), date) : 0 };
}
function noticeFor(state, employeeId, month) {
  return state.insuranceNotices.filter((n) => n.employeeId === employeeId && n.fromMonth <= month).sort((a, b) => a.fromMonth < b.fromMonth ? 1 : a.fromMonth > b.fromMonth ? -1 : a.enteredAt < b.enteredAt ? 1 : -1)[0];
}
function employeeMonthlyPremiums(state, e, month, date) {
  const ins = employeeInsurance(state, e, date);
  const notice = noticeFor(state, e.id, month);
  const kinds = ["pension", "health", "ltc", "employment"];
  return kinds.map((k) => {
    const label = INSURANCE_LABEL[k];
    const n = notice?.amounts[k];
    if (n != null) return { code: k, label, amount: n, source: "notice", note: `고지서 금액 (${notice.fromMonth}부터 입력값)` };
    const row = ins.rows.find((r) => r.kind === k);
    if (row.verdict === "excluded") return { code: k, label, amount: 0, source: "excluded", note: "제외 예상" };
    if (row.verdict === "check" || row.verdict === "noRule") return { code: k, label, amount: null, source: "missing", note: `${VERDICT_LABEL[row.verdict]} — 고지서 금액을 입력하면 공제해요` };
    if (row.worker === null) return { code: k, label, amount: null, source: "missing", note: row.note };
    return { code: k, label, amount: row.worker, source: "estimate", note: `예상 금액${row.status === "announced" ? " · 발표 기준" : ""}` };
  });
}
function reportDeadlines(eventDate, date) {
  const r = resolveRule("insurance.reportDeadline", date);
  const days = r.ok ? r.value.health.days : 14;
  const health = addDays(eventDate, days);
  const others = nextMonth15(eventDate);
  return { health, others, first: health < others ? health : others, ruleOk: r.ok };
}
function lossDate(resignDate) {
  return addDays(resignDate, 1);
}
function checkMinimumWage(hourlyWage, date) {
  const r = resolveRule("minimumWage.hourly", date);
  if (!r.ok) return { status: "noRule", required: null, wage: hourlyWage };
  return { status: hourlyWage >= r.value ? "ok" : "below", required: r.value, wage: hourlyWage, ruleStatus: r.status };
}
function dailyWorkerIncomeTax(dailyPay, date) {
  const r = ruleValue("tax.dailyWorker", date);
  const round2 = (n) => Math.round(n * 100) / 100;
  const calc = Math.floor(round2(Math.max(0, dailyPay - r.deductionPerDay) * r.rate));
  return calc - Math.floor(round2(calc * r.taxCredit));
}
function dayCalc(state, e, d, scale) {
  const cond2 = conditionAt(state.conditions, e.id, d);
  if (!cond2) return null;
  const { seg, pending, plan } = workedSegment(state, e, d);
  const wage = cond2.hourlyWage;
  const contractMin = plan.contract ? netMinutes(plan.contract) : 0;
  let netMin = 0;
  let nightMin = 0;
  if (seg) {
    netMin = netMinutes(seg);
    nightMin = Math.min(netMin, nightOverlapMinutes(seg.start, seg.end));
  }
  let paidOffMin = 0;
  let paidOffKind = null;
  if (!isUnder5(scale) && (plan.off === "leave" || plan.off === "publicHoliday") && contractMin > 0) {
    paidOffMin = contractMin;
    paidOffKind = plan.off;
  }
  const holiday = plan.isWeeklyHoliday || !isUnder5(scale) && !!plan.publicHoliday;
  return { date: d, wage, netMin, nightMin, holiday, pending, paidOffMin, paidOffKind, contractMin, basePay: netMin / 60 * wage };
}
function premiumsFor(days, weekDays, contractWeekly, inPeriod, date) {
  const otRate = ruleValue("premium.overtime", date);
  const nightRate = ruleValue("premium.night", date).rate;
  const hol = ruleValue("premium.holiday", date);
  const ptRate = ruleValue("fixedTerm.partTimeOvertime", date).premium;
  const out = { overtimeMin: 0, overtimePay: 0, nightMin: 0, nightPay: 0, holidayWithin8Min: 0, holidayOver8Min: 0, holidayPay: 0, partTimeOverMin: 0, partTimeOverPay: 0 };
  for (const d of days) {
    if (!inPeriod(d.date)) continue;
    out.nightMin += d.nightMin;
    out.nightPay += d.nightMin / 60 * d.wage * nightRate;
    if (d.holiday && d.netMin > 0) {
      const w8 = Math.min(d.netMin, 480);
      const o8 = Math.max(0, d.netMin - 480);
      out.holidayWithin8Min += w8;
      out.holidayOver8Min += o8;
      out.holidayPay += w8 / 60 * d.wage * hol.within8h + o8 / 60 * d.wage * hol.over8h;
    }
  }
  for (const [weekEnd, wdays] of weekDays) {
    const work = wdays.filter((d) => !d.holiday);
    let dailyOT = 0;
    let regular = 0;
    let ptOver = 0;
    for (const d of work) {
      const ot = Math.max(0, d.netMin - 480);
      if (inPeriod(d.date)) dailyOT += ot;
      regular += Math.min(d.netMin, 480);
      ptOver += Math.max(0, Math.min(d.netMin, 480) - d.contractMin);
    }
    const weeklyOT = inPeriod(weekEnd) ? Math.max(0, regular - 2400) : 0;
    const wageAtEnd = wdays[wdays.length - 1]?.wage ?? 0;
    const dayWage = (dd) => wdays.find((x) => x.date === dd)?.wage ?? wageAtEnd;
    for (const d of work) {
      if (!inPeriod(d.date)) continue;
      const ot = Math.max(0, d.netMin - 480);
      out.overtimePay += ot / 60 * dayWage(d.date) * otRate;
    }
    out.overtimeMin += dailyOT + weeklyOT;
    out.overtimePay += weeklyOT / 60 * wageAtEnd * otRate;
    const cw = contractWeekly(weekEnd);
    if (cw > 0 && cw < 40 && inPeriod(weekEnd)) {
      const pt = Math.max(0, ptOver - weeklyOT);
      out.partTimeOverMin += pt;
      out.partTimeOverPay += pt / 60 * wageAtEnd * ptRate;
    }
  }
  return out;
}
function computePayrollLine(input) {
  const { state, employee: e, scale } = input;
  const from = maxDate(input.from, e.hireDate);
  const to = e.resignDate ? minDate(input.to, e.resignDate) : input.to;
  const refDate = input.to;
  const under5 = isUnder5(scale);
  const warnings = [];
  const items = [];
  const inPeriod = (d) => d >= from && d <= to;
  const calcStart = startOfWeek(from);
  const calcEnd = addDays(startOfWeek(to), 6);
  const allDays = [];
  if (from <= to) {
    for (const d of listDates(calcStart, calcEnd)) {
      const c = dayCalc(state, e, d, scale);
      if (c) allDays.push(c);
    }
  }
  const days = allDays.filter((d) => inPeriod(d.date));
  const weekMap = /* @__PURE__ */ new Map();
  for (const d of allDays) {
    const we = addDays(startOfWeek(d.date), 6);
    if (!weekMap.has(we)) weekMap.set(we, []);
    weekMap.get(we).push(d);
  }
  const workedMin = days.reduce((s, d) => s + d.netMin, 0);
  const basePay = days.reduce((s, d) => s + d.basePay, 0);
  const wages = Array.from(new Set(days.filter((d) => d.netMin > 0 || d.paidOffMin > 0).map((d) => d.wage)));
  const wageText = wages.length <= 1 ? `${(wages[0] ?? conditionAt(state.conditions, e.id, to)?.hourlyWage ?? 0).toLocaleString("ko-KR")}원` : wages.map((w) => `${w.toLocaleString("ko-KR")}원`).join(" → ");
  items.push({
    code: "base",
    label: "기본급",
    amount: won(basePay),
    formula: `확정 근무 ${(workedMin / 60).toFixed(1).replace(/\.0$/, "")}시간 × ${wageText}`,
    basis: ["minimumWage.hourly"]
  });
  const belowDays = days.filter((d) => d.netMin > 0 && checkMinimumWage(d.wage, d.date).status === "below");
  if (belowDays.length) {
    const req = checkMinimumWage(belowDays[0].wage, belowDays[0].date).required;
    warnings.push({ level: "risk", text: `최저임금 미달 ${belowDays.length}일 — 시급 ${belowDays[0].wage.toLocaleString("ko-KR")}원 < ${req?.toLocaleString("ko-KR")}원 (${fmtMD(belowDays[0].date)}부터)`, basis: ["minimumWage.hourly"] });
  }
  const noRuleDays = days.filter((d) => d.netMin > 0 && checkMinimumWage(d.wage, d.date).status === "noRule");
  if (noRuleDays.length) warnings.push({ level: "check", text: `${fmtMD(noRuleDays[0].date)} 등 ${noRuleDays.length}일은 최저임금 기준이 규칙 파일에 없어요`, basis: ["minimumWage.hourly"] });
  const whRows = [];
  let whPay = 0;
  const cond2 = (d) => conditionAt(state.conditions, e.id, d);
  for (const [weekEnd, wdays] of weekMap) {
    if (!inPeriod(weekEnd) && !(e.resignDate && weekEnd > to && inPeriod(e.resignDate))) continue;
    const weekStart = addDays(weekEnd, -6);
    const c = cond2(minDate(weekEnd, to));
    if (!c) continue;
    const flags = [];
    const employedDays = wdays.filter((d) => d.date >= e.hireDate && (!e.resignDate || d.date <= e.resignDate));
    let sched;
    if (c.variable) {
      sched = employedDays.reduce((s, d) => s + d.netMin, 0) / 60;
      flags.push("매주 달라요 — 실제 근무로 계산, 확인 필요");
    } else {
      sched = employedDays.reduce((s, d) => s + d.contractMin, 0) / 60;
    }
    if (weekStart < e.hireDate) flags.push("입사한 주 — 근무한 날 기준 비례, 확인 필요");
    const hist = [c.variable ? sched : weeklyHours(c)];
    for (let k = 1; k <= 3; k++) {
      const ws = addDays(weekStart, -7 * k);
      if (addDays(ws, 6) < e.hireDate) break;
      const ck = cond2(addDays(ws, 6));
      hist.push(ck ? ck.variable ? ck.variableWeeklyHours ?? 0 : weeklyHours(ck) : 0);
    }
    const avg4w = hist.reduce((a, b) => a + b, 0) / hist.length;
    const plans = employedDays.map((d) => dayPlan(state, e, d.date));
    const absent = plans.some((p) => p.off === "absent");
    const subs = plans.some((p) => p.overrides.some((o) => o.kind === "subIn" || o.kind === "subOut"));
    if (subs) flags.push("대타로 바뀐 날 포함 — 근무일 변경으로 처리, 확인 필요 (C3)");
    const minH = ruleValue("weeklyHoliday.minWeeklyHours", weekEnd);
    const eligible = avg4w >= minH && !absent && sched > 0;
    const hours = eligible ? Math.min(sched, 40) / 40 * 8 : 0;
    const wageW = c.hourlyWage;
    let included = eligible;
    if (e.resignDate && e.resignDate >= weekStart && e.resignDate < weekEnd) {
      flags.push("퇴사하는 주 — 확인 필요 (노무사 확인 C2), 자동 포함하지 않음");
      included = false;
    }
    if (absent) flags.push("결근 있음 — 개근 요건 미충족");
    if (avg4w < minH) flags.push(`4주 평균 ${avg4w.toFixed(1)}시간 < ${minH}시간`);
    const amount = won(hours * wageW);
    if (included) whPay += amount;
    whRows.push({ weekStart, weekEnd, scheduledHours: Math.round(sched * 100) / 100, avg4w: Math.round(avg4w * 100) / 100, perfectAttendance: !absent, eligible, included, hours: Math.round(hours * 100) / 100, amount, flags });
  }
  whRows.sort((a, b) => a.weekEnd < b.weekEnd ? -1 : 1);
  items.push({
    code: "weeklyHoliday",
    label: "주휴수당",
    amount: won(whPay),
    formula: whRows.filter((r) => r.included).length ? whRows.filter((r) => r.included).map((r) => `주 ${r.scheduledHours}h→${r.hours}h`).join(" + ") : "대상 주 없음",
    basis: ["weeklyHoliday.minWeeklyHours", "weeklyHoliday.paidHours"]
  });
  if (whRows.some((r) => r.flags.some((f) => f.includes("C2")))) warnings.push({ level: "check", text: "퇴사하는 주의 주휴수당은 자동으로 넣지 않았어요 (노무사 확인 C2)", basis: ["weeklyHoliday.paidHours"] });
  const contractWeekly = (we) => {
    const c = cond2(we);
    return c && !c.variable ? weeklyHours(c) : 0;
  };
  const prem = premiumsFor(allDays, weekMap, contractWeekly, inPeriod, refDate);
  const premTotal = prem.overtimePay + prem.nightPay + prem.holidayPay + prem.partTimeOverPay;
  if (under5) {
    items.push({
      code: "premium",
      label: "연장·야간·휴일 가산",
      amount: 0,
      formula: "1~4명 사업장은 가산 미적용",
      basis: ["scope.under5.appliedArticles"],
      note: `상시 4명 이하 사업장은 연장·야간·휴일 가산분이 적용되지 않아요. 일한 시간의 임금은 그대로 드려야 해요.${premTotal > 0 ? ` (5명 이상이었다면 약 ${won(premTotal).toLocaleString("ko-KR")}원)` : ""}`
    });
  } else {
    if (prem.overtimeMin) items.push({ code: "overtime", label: "연장 가산", amount: won(prem.overtimePay), formula: `${(prem.overtimeMin / 60).toFixed(1)}시간 × 시급 × 50%`, basis: ["premium.overtime"] });
    if (prem.nightMin) items.push({ code: "night", label: "야간 가산", amount: won(prem.nightPay), formula: `${(prem.nightMin / 60).toFixed(1)}시간(22~06시) × 시급 × 50%`, basis: ["premium.night"] });
    if (prem.holidayWithin8Min || prem.holidayOver8Min) items.push({ code: "holiday", label: "휴일 가산", amount: won(prem.holidayPay), formula: `8시간 이내 ${(prem.holidayWithin8Min / 60).toFixed(1)}h × 50% + 초과 ${(prem.holidayOver8Min / 60).toFixed(1)}h × 100%`, basis: ["premium.holiday"] });
    if (prem.partTimeOverMin) items.push({ code: "partTimeOver", label: "단시간 초과근로 가산", amount: won(prem.partTimeOverPay), formula: `소정근로시간 초과 ${(prem.partTimeOverMin / 60).toFixed(1)}시간 × 시급 × 50% (근사)`, basis: ["fixedTerm.partTimeOvertime"] });
    if (!prem.overtimeMin && !prem.nightMin && !prem.holidayWithin8Min && !prem.holidayOver8Min && !prem.partTimeOverMin)
      items.push({ code: "premium", label: "연장·야간·휴일 가산", amount: 0, formula: "해당 근무 없음", basis: ["premium.overtime", "premium.night", "premium.holiday"] });
  }
  const phMin = days.filter((d) => d.paidOffKind === "publicHoliday").reduce((s, d) => s + d.paidOffMin, 0);
  const lvMin = days.filter((d) => d.paidOffKind === "leave").reduce((s, d) => s + d.paidOffMin, 0);
  const phPay = days.filter((d) => d.paidOffKind === "publicHoliday").reduce((s, d) => s + d.paidOffMin / 60 * d.wage, 0);
  const lvPay = days.filter((d) => d.paidOffKind === "leave").reduce((s, d) => s + d.paidOffMin / 60 * d.wage, 0);
  if (phMin) items.push({ code: "publicHoliday", label: "공휴일 유급", amount: won(phPay), formula: `${(phMin / 60).toFixed(1)}시간 × 시급 (단시간 비례 원문 확인 전)`, basis: ["holidays.legal"] });
  if (lvMin) items.push({ code: "leavePay", label: "연차 사용일 유급", amount: won(lvPay), formula: `${(lvMin / 60).toFixed(1)}시간 × 시급`, basis: ["annualLeave.accrual"] });
  if (under5 && days.some((d) => dayPlan(state, e, d.date).off === "leave")) warnings.push({ level: "info", text: "1~4명 사업장은 연차 규정 미적용 — 연차로 표시한 날은 무급으로 계산했어요", basis: ["scope.under5.appliedArticles"] });
  const lastCond = cond2(to);
  let taxFree = 0;
  if (lastCond?.mealAllowance) {
    const periodDays = diffDays(input.from, input.to) + 1;
    const employedDays = Math.max(0, diffDays(from, to) + 1);
    const meal = won(lastCond.mealAllowance * employedDays / periodDays);
    const limit = ruleValue("tax.mealAllowanceNonTaxable", refDate);
    taxFree = Math.min(meal, limit);
    items.push({ code: "meal", label: "식대", amount: meal, formula: employedDays < periodDays ? `월 ${lastCond.mealAllowance.toLocaleString("ko-KR")}원 × ${employedDays}/${periodDays}일` : `월 고정`, basis: ["tax.mealAllowanceNonTaxable"], note: `월 ${limit.toLocaleString("ko-KR")}원까지 비과세` });
  }
  for (const adj of input.manual?.adjustments ?? []) {
    items.push({ code: "adjust", label: adj.label || "조정", amount: won(adj.amount), formula: "사장님 직접 입력", basis: [] });
  }
  const gross = items.reduce((s, i) => s + i.amount, 0);
  if (e.probationEnd && e.probationEnd >= from) warnings.push({ level: "check", text: "수습 중 — 감액하지 않고 계산했어요. 감액 가능 여부는 확인 필요 (노무사 확인 C1)", basis: ["minimumWage.probation"] });
  const pendingDays = days.filter((d) => d.pending).map((d) => d.date);
  if (pendingDays.length) warnings.push({ level: "check", text: `확인 대기 근무 ${pendingDays.length}일 — 확인 전에는 예정 시간으로 계산해요`, basis: [] });
  if (lastCond?.variable) warnings.push({ level: "check", text: "매주 달라요 — 입력한 실제 근무로 계산했어요", basis: [] });
  if (e.ageBand === "under18") warnings.push({ level: "info", text: "18세 미만 — 근무 화면의 시간 한도·야간·휴일 경고를 확인하세요", basis: ["minor.limits"] });
  const deductions = [];
  if (!input.grossOnly) {
    const month = monthOf(to);
    const prem3 = employeeMonthlyPremiums(state, e, month, to);
    for (const p of prem3) deductions.push(p);
    if (e.employmentType === "daily") {
      const perDay = /* @__PURE__ */ new Map();
      for (const d of days) perDay.set(d.date, (perDay.get(d.date) ?? 0) + d.basePay);
      let tax = 0;
      for (const [dd, pay] of perDay) tax += dailyWorkerIncomeTax(won(pay), dd);
      deductions.push({ code: "incomeTax", label: "소득세 (일용)", amount: tax, source: "dailyFormula", note: "(1일 지급액 − 15만 원) × 6% − 산출세액의 55%" });
    } else {
      const mt = input.manual?.incomeTax;
      deductions.push(
        mt != null ? { code: "incomeTax", label: "소득세", amount: mt, source: "manual", note: "사장님 직접 입력" } : { code: "incomeTax", label: "소득세", amount: null, source: "missing", note: "상용 간이세액표 확보 전 — 직접 입력하세요 (세무 전문가 확인 권장)" }
      );
    }
    const lt = input.manual?.localTax;
    deductions.push(
      lt != null ? { code: "localTax", label: "지방소득세", amount: lt, source: "manual", note: "사장님 직접 입력" } : { code: "localTax", label: "지방소득세", amount: null, source: "missing", note: "규칙 파일에 없어 자동 계산하지 않아요 — 직접 입력" }
    );
  }
  const deductionTotal = deductions.reduce((s, d) => s + (d.amount ?? 0), 0);
  const netComplete = deductions.every((d) => d.amount !== null);
  const ruleIds = Array.from(new Set(items.flatMap((i) => i.basis).concat(["minimumWage.hourly"])));
  const ruleRefs = ruleIds.map((id) => {
    const r = resolveRule(id, refDate);
    return { id, status: r.ok ? r.status : r.reason, verifiedAt: r.ok ? r.verifiedAt : void 0 };
  });
  return {
    employeeId: e.id,
    alias: e.alias,
    period: { from: input.from, to: input.to },
    payDate: input.payDate,
    hours: {
      worked: workedMin / 60,
      night: prem.nightMin / 60,
      overtime: prem.overtimeMin / 60,
      holidayWithin8: prem.holidayWithin8Min / 60,
      holidayOver8: prem.holidayOver8Min / 60,
      partTimeOver: prem.partTimeOverMin / 60,
      paidLeave: lvMin / 60,
      paidPublicHoliday: phMin / 60
    },
    workDays: days.filter((d) => d.netMin > 0).length,
    wageText,
    items,
    gross,
    taxFree,
    deductions,
    deductionTotal,
    net: gross - deductionTotal,
    netComplete,
    warnings,
    pendingDays,
    weeklyHolidayDetail: whRows,
    ruleRefs
  };
}
function quickWage(q) {
  const wh = q.schedule.reduce((s, d) => s + (d ? netMinutes(d) : 0), 0) / 60;
  const whh = weeklyHolidayHours(wh, q.date);
  const night = q.schedule.reduce((s, d) => s + (d ? Math.min(netMinutes(d), nightOverlapMinutes(d.start, d.end)) : 0), 0) / 60;
  const daily = q.schedule.reduce((s, d) => s + (d ? Math.max(0, netMinutes(d) - 480) : 0), 0) / 60;
  const regular = q.schedule.reduce((s, d) => s + (d ? Math.min(netMinutes(d), 480) : 0), 0) / 60;
  const weeklyOT = Math.max(0, regular - 40);
  const otRate = ruleValue("premium.overtime", q.date);
  const nightRate = ruleValue("premium.night", q.date).rate;
  const premIf5 = (daily + weeklyOT) * q.hourlyWage * otRate + night * q.hourlyWage * nightRate;
  const breakRule = resolveRule("break.minimum", q.date);
  const breakIssues = [];
  if (breakRule.ok) {
    q.schedule.forEach((d, i) => {
      if (!d) return;
      const gross = netMinutes({ ...d, breakMin: 0 });
      const need = gross >= 480 ? breakRule.value.per8h : gross >= 240 ? breakRule.value.per4h : 0;
      if (d.breakMin < need) breakIssues.push(`${["월", "화", "수", "목", "금", "토", "일"][i]}요일 휴게 ${d.breakMin}분 < 최소 ${need}분`);
    });
  }
  const mh = monthlyHours(wh, q.date);
  const prem = isUnder5(q.scale) ? 0 : premIf5;
  return {
    weeklyHours: wh,
    minWage: checkMinimumWage(q.hourlyWage, q.date),
    weeklyHolidayHours: whh,
    weeklyHolidayPay: won(whh * q.hourlyWage),
    monthlyHours: mh,
    monthlyPay: won(mh * q.hourlyWage + prem * 365 / 7 / 12),
    weeklyPremiumIf5: won(premIf5),
    weeklyPremium: won(prem),
    nightHoursWeekly: night,
    breakIssues
  };
}
function payrollPeriodFor(wp, month) {
  const payMonth = wp.payMonthBasis === "previous" ? addMonthsYM(month, 1) : month;
  const last = Number(endOfMonth(payMonth).slice(8));
  const payDate = `${payMonth}-${String(Math.min(wp.payDay, last)).padStart(2, "0")}`;
  return { from: startOfMonth(month), to: endOfMonth(month), payDate };
}
function payrollFor(state, month) {
  return state.payrolls.find((p) => p.month === month);
}
function payrollLines(state, month) {
  const p = payrollFor(state, month);
  if (p?.status === "confirmed" && p.confirmedLines) return { lines: p.confirmedLines, confirmed: true, payroll: p };
  return { lines: draftLines(state, month), confirmed: false, payroll: p };
}
function draftLines(state, month) {
  const wp = state.workplace;
  if (!wp) return [];
  const { from, to, payDate } = payrollPeriodFor(wp, month);
  const p = payrollFor(state, month);
  const scale = p?.scaleConfirmed ?? wp.scale;
  return state.employees.filter((e) => e.hireDate <= to && (!e.resignDate || e.resignDate >= from)).map((e) => computePayrollLine({ state, employee: e, from, to, payDate, scale, manual: p?.manual.find((m) => m.employeeId === e.id) ?? null }));
}
function pendingAttendanceIn(state, month) {
  const wp = state.workplace;
  if (!wp) return [];
  const { from, to } = payrollPeriodFor(wp, month);
  return state.attendance.filter((a) => a.date >= from && a.date <= to && a.status !== "confirmed");
}
function severanceAmount(i, minServiceDays = 365) {
  const extra = ((i.bonusAnnual ?? 0) + (i.leaveAllowanceAnnual ?? 0)) * (3 / 12);
  const avg = i.days3m > 0 ? (i.wage3m + extra) / i.days3m : 0;
  const used = avg < i.ordinaryDaily ? "ordinary" : "average";
  const usedDaily = used === "ordinary" ? i.ordinaryDaily : avg;
  if (i.serviceDays < minServiceDays) {
    return { eligible: false, reason: `계속근로 1년 미만 (재직 ${i.serviceDays}일)`, averageDaily: Math.floor(avg), ordinaryDaily: i.ordinaryDaily, used, usedDaily, amount: 0, extraAdded: won(extra) };
  }
  return {
    eligible: true,
    reason: "",
    averageDaily: Math.floor(avg),
    ordinaryDaily: i.ordinaryDaily,
    used,
    usedDaily,
    amount: won(Math.floor(usedDaily) * 30 * i.serviceDays / 365),
    extraAdded: won(extra)
  };
}
function estimateSeverance(state, e, asOf) {
  const last = e.resignDate ?? asOf;
  const serviceDays = diffDays(e.hireDate, last) + 1;
  const c = conditionAt(state.conditions, e.id, last);
  const wh = weeklyHours(c);
  const notes = [];
  const rule = resolveRule("severance.basic", last);
  const minWeekly = rule.ok ? rule.value.minWeeklyHours : 15;
  const payDays = rule.ok ? rule.value.paymentDays : 14;
  const periodTo = last;
  const periodFrom = addMonths(addDays(last, 1), -3);
  const days3m = diffDays(periodFrom, periodTo) + 1;
  const line = computePayrollLine({ state, employee: e, from: periodFrom, to: periodTo, payDate: periodTo, scale: state.workplace?.scale ?? "1-4", grossOnly: true });
  const wage3m = line.gross;
  const ordinaryDaily = won((c?.hourlyWage ?? 0) * dailyScheduledHours(c));
  const calc = severanceAmount({ serviceDays, wage3m, days3m, ordinaryDaily, bonusAnnual: e.bonusAnnual, leaveAllowanceAnnual: e.leaveAllowanceAnnual });
  let applicable = calc.eligible ? "yes" : "no";
  if (e.isForeign && e.foreign?.visa === "E-9") {
    applicable = "e9";
    notes.push("E-9: 출국만기보험에 가입하면 퇴직금 제도를 설정한 것으로 보고, 지급은 출국 후 14일 이내예요 (외국인고용법 제13조)");
  }
  if (wh < minWeekly) {
    applicable = "no";
    notes.push(`4주 평균 주 ${minWeekly}시간 미만은 퇴직금 대상이 아니에요`);
  }
  if (c?.variable) {
    applicable = applicable === "no" ? "no" : "check";
    notes.push("매주 달라요 — 주 15시간 판정 확인 필요");
  }
  if (e.employmentType === "daily") {
    applicable = applicable === "no" ? "no" : "check";
    notes.push("하루 단위·짧은 계약의 반복 — 계속근로 확인 필요");
  }
  if (e.probationEnd && e.probationEnd >= periodFrom) notes.push("평균임금 기간에 수습이 있어요 — 제외 기간 여부는 전문가 확인 필요 (C9)");
  if (e.bonusAnnual || e.leaveAllowanceAnnual) notes.push("상여·연차수당 3/12 가산은 법령에 없는 실무 기준이에요 (노무사 확인 전)");
  if (calc.used === "ordinary") notes.push("평균임금이 통상임금보다 낮아 통상임금으로 계산했어요 (근로기준법 제2조②)");
  notes.push("1~4명 사업장도 퇴직금은 적용돼요. 퇴직소득세는 계산하지 않아요");
  const monthlyAccrual = won(line.gross / 3 / 12);
  return {
    ...calc,
    applicable,
    notes,
    serviceDays,
    oneYearDate: addYears(e.hireDate, 1),
    paymentDue: e.resignDate ? addDays(e.resignDate, payDays) : null,
    periodFrom,
    periodTo,
    wage3m,
    days3m,
    monthlyAccrual,
    weeklyHours: wh
  };
}
function annualDaysForYear(completedYears, rule) {
  if (completedYears < 1) return 0;
  return Math.min(rule.max, rule.base + Math.floor((completedYears - 1) / 2) * rule.plusEvery2Years);
}
function firstYearMonthly(hireDate, asOf, absentMonths) {
  let months = 0;
  for (let k = 1; k <= 11; k++) {
    if (addMonths(hireDate, k) <= asOf) months++;
  }
  return Math.max(0, months - absentMonths);
}
function leaveAccrual(state, e, asOf) {
  const empty = (reason) => ({ applicable: false, reason, firstYearDays: 0, annualDays: 0, totalDays: 0, usedDays: 0, remainingDays: 0, partTime: false, totalHours: null, usedHours: null, remainingHours: null, currentYearStart: e.hireDate, currentYearEnd: e.hireDate, promotion: null });
  if (isUnder5(state.workplace?.scale)) return empty("1~4명 사업장은 연차 규정이 적용되지 않아요 (근로기준법 시행령 별표 1)");
  const c = conditionAt(state.conditions, e.id, asOf);
  const wh = weeklyHours(c);
  const minW = resolveRule("weeklyHoliday.minWeeklyHours", asOf);
  if (wh < (minW.ok ? minW.value : 15)) return empty("주 15시간 미만은 연차가 없어요");
  const rule = resolveRule("annualLeave.accrual", asOf);
  if (!rule.ok) return empty("연차 규칙이 이 날짜에 없어요");
  const years = Math.floor(diffDays(e.hireDate, asOf) / 365.25);
  let yearStart = e.hireDate;
  for (let y = 1; y <= years; y++) yearStart = addYears(e.hireDate, y);
  const yearEnd = addYears(yearStart, 1);
  const absences = state.overrides.filter((o) => o.employeeId === e.id && o.kind === "absent");
  let absentMonths = 0;
  for (let k = 0; k < 11; k++) {
    const ms = addMonths(e.hireDate, k);
    const me = addMonths(e.hireDate, k + 1);
    if (absences.some((a) => a.date >= ms && a.date < me)) absentMonths++;
  }
  const firstYearDays = firstYearMonthly(e.hireDate, asOf, absentMonths);
  const annualDays = annualDaysForYear(years, rule.value);
  const totalDays = years >= 1 ? annualDays : firstYearDays;
  const used = state.leaveRequests.filter((l) => l.employeeId === e.id && l.status === "approved" && l.date >= yearStart && l.date < yearEnd);
  const usedOverrides = state.overrides.filter((o) => o.employeeId === e.id && o.kind === "leave" && o.date >= yearStart && o.date < yearEnd && !used.some((u) => u.date === o.date));
  const dailyHours = c && !c.variable ? wh / Math.max(1, c.schedule.filter(Boolean).length) : 8;
  const usedHoursTotal = used.reduce((s, l) => s + (l.hours ?? dailyHours), 0) + usedOverrides.length * dailyHours;
  const partTime = wh < 40;
  let totalHours = null;
  if (partTime) {
    totalHours = Math.ceil(totalDays * (wh / 40) * 8);
  }
  const usedDays = Math.round(usedHoursTotal / dailyHours * 10) / 10;
  let promotion = null;
  const promo = resolveRule("annualLeave.promotion", asOf);
  if (years >= 1 && promo.ok) {
    const p = promo.value.overOneYear;
    const notifyFrom = addMonths(yearEnd, -p.notifyMonthsBefore);
    promotion = { notifyFrom, notifyTo: addDays(notifyFrom, p.notifyWindowDays - 1), designateBy: addMonths(yearEnd, -p.designateMonthsBefore) };
  }
  return {
    applicable: true,
    reason: "",
    firstYearDays,
    annualDays,
    totalDays,
    usedDays,
    remainingDays: Math.max(0, Math.round((totalDays - usedDays) * 10) / 10),
    partTime,
    totalHours,
    usedHours: partTime ? Math.round(usedHoursTotal * 10) / 10 : null,
    remainingHours: partTime && totalHours != null ? Math.max(0, Math.round((totalHours - usedHoursTotal) * 10) / 10) : null,
    currentYearStart: yearStart,
    currentYearEnd: addDays(yearEnd, -1),
    promotion
  };
}
var TYPE_LABEL = {
  probationEnd: "수습 종료",
  contractEnd: "계약 만료",
  visaExpiry: "체류기간 만료",
  healthCert: "보건증 유효기간",
  payday: "급여 지급일",
  insAcquisition: "4대보험 입사 신고",
  insLoss: "4대보험 퇴사 신고",
  severanceYear: "퇴직금 준비",
  severancePay: "퇴직금 지급 기한",
  minWageTransition: "최저임금 전환",
  dailyRoster: "근로자 명부 추가",
  retentionEnd: "서류 보관 종료",
  leavePromotion: "연차 사용 촉진",
  fixedTerm2y: "기간제 2년"
};
function alertDates(date, recurring) {
  const offs = recurring ? [3, 0] : [30, 7, 3, 0];
  return offs.map((o) => addDays(date, -o));
}
function computeDeadlines(state, base) {
  const wp = state.workplace;
  if (!wp) return [];
  const raws = [];
  const under5 = isUnder5(wp.scale);
  for (const e of state.employees) {
    const resigned = !!e.resignDate && e.resignDate < base;
    const empLink = `/owner/employees/${e.id}`;
    if (!resigned) {
      if (e.probationEnd) raws.push({ key: `probationEnd:${e.id}:${e.probationEnd}`, type: "probationEnd", title: `${e.alias} 수습 종료`, employee: e, date: e.probationEnd, origin: `수습 종료일 ${e.probationEnd}`, link: empLink, basis: "직원 등록값", ruleIds: ["minimumWage.probation"], actions: ["done"] });
      if (e.employmentType === "fixed" && e.contractEnd)
        raws.push({ key: `contractEnd:${e.id}:${e.contractEnd}`, type: "contractEnd", title: `${e.alias} 계약 만료`, employee: e, date: e.contractEnd, origin: `계약 종료일 ${e.contractEnd}`, link: empLink, basis: "직원 등록값 · 기간제법 제17조", actions: ["renewed", "ended", "unknown"] });
      if (e.isForeign && e.foreign?.expiry)
        raws.push({ key: `visaExpiry:${e.id}:${e.foreign.expiry}`, type: "visaExpiry", title: `${e.alias} 체류기간 만료`, employee: e, date: e.foreign.expiry, origin: `체류기간 만료일 ${e.foreign.expiry}`, link: empLink, basis: "외국인 정보 (출입국관리법 원문 확인 전)", actions: ["done"] });
      const hc = state.docRecords.find((r) => r.key === `E5:${e.id}` && (r.status === "done" || r.status === "stored"));
      if (hc?.expiry) {
        raws.push({ key: `healthCert:${e.id}:${hc.expiry}`, type: "healthCert", title: `${e.alias} 보건증 재검진`, employee: e, date: hc.expiry, origin: `보건증 유효기간 ${hc.expiry}`, link: `/owner/documents?item=E5&emp=${e.id}`, basis: "건강진단규칙 제2조", ruleIds: ["healthCertificate"], actions: ["done"], showFrom: addDays(hc.expiry, -30) });
      }
      if (e.insuranceMethod !== "alreadyDone") {
        const r = reportDeadlines(e.hireDate, e.hireDate);
        const rep = state.insuranceReports.find((x) => x.employeeId === e.id && x.phase === "acquisition");
        const done = !!rep && rep.status !== "none";
        raws.push({ key: `insAcquisition:${e.id}:${e.hireDate}`, type: "insAcquisition", title: `${e.alias} 4대보험 입사 신고`, employee: e, date: r.first, secondaryDate: r.others, secondaryLabel: `건강 ${fmtMD(r.health)} / 연금·고용·산재 ${fmtMD(r.others)}`, origin: `입사일 ${e.hireDate}`, link: `/owner/insurance?emp=${e.id}`, basis: "국민건강보험법 제8조② · 국민연금법 시행규칙 제6조① · 고용보험법 시행령 제7조①", ruleIds: ["insurance.reportDeadline"], actions: ["done"], autoDone: done });
      }
      const c = conditionAt(state.conditions, e.id, base);
      if (!(e.isForeign && e.foreign?.visa === "E-9") && weeklyHours(c) >= 15) {
        const oneYear = addYears(e.hireDate, 1);
        raws.push({ key: `severanceYear:${e.id}:${oneYear}`, type: "severanceYear", title: `${e.alias} 퇴직금 준비 (1년 되는 날)`, employee: e, date: oneYear, origin: `입사일 ${e.hireDate}`, link: empLink, basis: "퇴직급여법 제4조①", ruleIds: ["severance.basic"], actions: ["done"] });
      }
      if (c) {
        const nextJan = `${Number(base.slice(0, 4)) + 1}-01-01`;
        const mw = checkMinimumWage(c.hourlyWage, nextJan);
        const futureCond = conditionAt(state.conditions, e.id, nextJan);
        if (mw.status === "below" && futureCond && futureCond.hourlyWage < (mw.required ?? 0))
          raws.push({ key: `minWageTransition:${e.id}:${nextJan}`, type: "minWageTransition", title: `${e.alias} 최저임금 전환 — 시급 ${c.hourlyWage.toLocaleString("ko-KR")}원 < ${mw.required?.toLocaleString("ko-KR")}원`, employee: e, date: nextJan, origin: `${nextJan.slice(0, 4)}년 최저임금 고시`, link: `${empLink}?tab=conditions`, basis: "최저임금법 제6조", ruleIds: ["minimumWage.hourly"], actions: ["done"], showFrom: `${base.slice(0, 4)}-12-01` });
      }
      if (e.employmentType === "daily") {
        const d30 = addDays(e.hireDate, 29);
        raws.push({ key: `dailyRoster:${e.id}:${d30}`, type: "dailyRoster", title: `${e.alias} 근로자 명부 작성 (사용기간 30일)`, employee: e, date: d30, origin: `입사일 ${e.hireDate}`, link: `/owner/documents?item=E3&emp=${e.id}`, basis: "근로기준법 시행령 제21조", ruleIds: ["records.rosterException"], actions: ["done"] });
      }
      if (!under5 && e.employmentType === "fixed") {
        const d2 = addDays(addYears(e.hireDate, 2), -1);
        raws.push({ key: `fixedTerm2y:${e.id}:${d2}`, type: "fixedTerm2y", title: `${e.alias} 기간제 2년 도달`, employee: e, date: d2, origin: `최초 입사일 ${e.hireDate}`, link: empLink, basis: "기간제법 제4조", ruleIds: ["fixedTerm.maxYears"], actions: ["done"] });
      }
      if (!under5) {
        const la = leaveAccrual(state, e, base);
        if (la.applicable && la.promotion)
          raws.push({ key: `leavePromotion:${e.id}:${la.promotion.notifyFrom}`, type: "leavePromotion", title: `${e.alias} 연차 사용 촉진 서면 촉구`, employee: e, date: la.promotion.notifyTo, secondaryDate: la.promotion.designateBy, secondaryLabel: `촉구 ${fmtMD(la.promotion.notifyFrom)}~${fmtMD(la.promotion.notifyTo)} · 지정 ${fmtMD(la.promotion.designateBy)}까지`, origin: `연차 기간 ${la.currentYearStart}~${la.currentYearEnd}`, link: "/owner/work?tab=leave", basis: "근로기준법 제61조", ruleIds: ["annualLeave.promotion"], actions: ["done"] });
      }
    }
    if (e.resignDate) {
      const ld = lossDate(e.resignDate);
      const r = reportDeadlines(ld, ld);
      const rep = state.insuranceReports.find((x) => x.employeeId === e.id && x.phase === "loss");
      raws.push({ key: `insLoss:${e.id}:${e.resignDate}`, type: "insLoss", title: `${e.alias} 4대보험 퇴사(상실) 신고`, employee: e, date: r.first, secondaryDate: r.others, secondaryLabel: `건강 ${fmtMD(r.health)} / 연금·고용·산재 ${fmtMD(r.others)}`, origin: `퇴사일 ${e.resignDate} (상실일 ${ld})`, link: `/owner/insurance?emp=${e.id}`, basis: "국민건강보험법 제10조② · 징수법 제16조의10", ruleIds: ["insurance.reportDeadline"], actions: ["done"], autoDone: !!rep && rep.status !== "none" });
      const sev = resolveRule("severance.basic", e.resignDate);
      const payDays = sev.ok ? sev.value.paymentDays : 14;
      raws.push({ key: `severancePay:${e.id}:${e.resignDate}`, type: "severancePay", title: `${e.alias} 임금·퇴직금 지급 기한 (퇴사 후 ${payDays}일)`, employee: e, date: addDays(e.resignDate, payDays), origin: `퇴사일 ${e.resignDate}`, link: `/owner/offboarding/${e.id}`, basis: "근로기준법 제36조 · 퇴직급여법 제9조①", ruleIds: ["severance.basic"], actions: ["done"] });
      const ret = addYears(e.resignDate, 3);
      raws.push({ key: `retentionEnd:${e.id}:${ret}`, type: "retentionEnd", title: `${e.alias} 서류 3년 보관 종료`, employee: e, date: ret, origin: `퇴사일 ${e.resignDate}`, link: `/owner/documents?emp=${e.id}`, basis: "근로기준법 제42조 · 시행령 제22조②", ruleIds: ["records.retentionYears"], actions: ["done"] });
    }
  }
  if (state.employees.some((e) => !e.resignDate || e.resignDate >= base)) {
    const thisMonth = monthOf(base);
    for (const off of [-1, 0, 1]) {
      const ym = monthOf(addMonths(`${thisMonth}-01`, off));
      const workMonth = wp.payMonthBasis === "previous" ? monthOf(addMonths(`${ym}-01`, -1)) : ym;
      const p = payrollPeriodFor(wp, workMonth);
      const inPeriod = state.employees.filter((e) => e.hireDate <= p.to && (!e.resignDate || e.resignDate >= p.from));
      if (!inPeriod.length) continue;
      if (p.payDate < inPeriod.map((e) => e.registeredAt).sort()[0]) continue;
      const pr = state.payrolls.find((x) => x.month === workMonth);
      raws.push({ key: `payday:${workMonth}:${p.payDate}`, type: "payday", title: `${Number(workMonth.slice(5))}월분 급여 확정 · 임금명세서`, employee: null, date: p.payDate, origin: `사업장 설정 — 매달 ${wp.payDay}일, ${wp.payMonthBasis === "previous" ? "전월분" : "당월분"}`, recurring: true, link: `/owner/payroll?month=${workMonth}`, basis: "근로기준법 제43조 · 제48조", ruleIds: ["wageStatement.electronic"], actions: ["done"], autoDone: pr?.status === "confirmed" });
    }
  }
  const out = [];
  for (const r of raws) {
    if (r.showFrom && base < r.showFrom && diffDays(base, r.date) > 30) continue;
    const handled = state.deadlineActions.find((a) => a.key === r.key) ?? null;
    const days = diffDays(base, r.date);
    let status;
    const autoDoneAction = r.autoDone ? { key: r.key, action: "done", at: "", date: base, note: "연결된 화면에서 처리됨" } : null;
    const h = handled ?? autoDoneAction;
    if (h && h.action !== "unknown") status = "done";
    else if (r.employee && r.employee.onboarding === "existing-pending" && r.date < r.employee.registeredAt) status = "onboarding";
    else if (days < 0) status = "overdue";
    else if (days <= 7) status = "due7";
    else if (days <= 30) status = "due30";
    else status = "later";
    const alerts = alertDates(r.date, !!r.recurring);
    out.push({
      key: r.key,
      type: r.type,
      title: r.title,
      employeeId: r.employee?.id ?? null,
      alias: r.employee?.alias ?? null,
      date: r.date,
      secondaryDate: r.secondaryDate ?? null,
      secondaryLabel: r.secondaryLabel ?? "",
      origin: r.origin,
      recurring: !!r.recurring,
      link: r.link,
      basis: r.basis,
      ruleIds: r.ruleIds ?? [],
      actions: r.actions ?? ["done"],
      handled: h,
      status,
      days,
      dLabel: dDayLabel(days),
      alerts,
      nextAlert: status === "done" ? null : alerts.find((a) => a >= base) ?? null
    });
  }
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1);
}
var esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 60) {
    out.push(rest.slice(0, 60));
    rest = " " + rest.slice(60);
  }
  out.push(rest);
  return out.join("\r\n");
}
function buildIcs(deadlines, generatedAt = /* @__PURE__ */ new Date()) {
  const stamp = generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ai-labor-service//draft//KO", "CALSCALE:GREGORIAN", "X-WR-CALNAME:노무 기한 (로컬 데모)"];
  for (const d of deadlines) {
    const ymd = d.date.replace(/-/g, "");
    const next = new Date(Date.UTC(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7)) - 1, Number(d.date.slice(8, 10)) + 1));
    const ymd2 = next.toISOString().slice(0, 10).replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${esc(d.key)}@ai-labor-service.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${ymd}`);
    lines.push(`DTEND;VALUE=DATE:${ymd2}`);
    lines.push(fold(`SUMMARY:${esc(d.title)}`));
    lines.push(fold(`DESCRIPTION:${esc(`${d.secondaryLabel ? d.secondaryLabel + "\n" : ""}계산 근거: ${d.origin}
근거: ${d.basis}
내려받은 시점의 사본이에요. 기한이 바뀌면 다시 내려받으세요.`)}`));
    const offsets = d.recurring ? [3, 0] : [30, 7, 3, 0];
    for (const o of offsets) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(d.title)}`), o === 0 ? "TRIGGER:PT9H" : `TRIGGER:-P${o}D`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
var CHECKLIST_ITEMS = [
  {
    id: "W1",
    title: "취업규칙 작성·신고",
    group: "workplace",
    kind: "서류",
    condition: "상시 10명 이상",
    cycle: "최초, 변경 시",
    basis: "근로기준법 제93조",
    penalty: "500만 원 이하 과태료 (제116조②2)",
    evidence: "article",
    plain: "근무 시간·임금·휴가 등 회사 규칙을 문서로 만들어 고용노동부에 신고해야 해요.",
    todo: ["표준 취업규칙 양식으로 작성", "관할 고용노동부에 신고"],
    retention: "변경 시까지",
    ruleIds: []
  },
  {
    id: "W2",
    title: "법령 주요 내용·취업규칙 게시 또는 비치",
    group: "workplace",
    kind: "게시·교육",
    condition: "상시 5명 이상",
    cycle: "상시",
    basis: "근로기준법 제14조",
    penalty: "500만 원 이하 과태료 (제116조②2)",
    evidence: "article",
    plain: "근로기준법 주요 내용을 직원이 볼 수 있는 곳에 붙이거나 비치해요.",
    todo: ["게시물 준비", "직원이 볼 수 있는 곳에 게시"],
    retention: "상시",
    ruleIds: ["scope.under5.appliedArticles"]
  },
  {
    id: "W3",
    title: "최저임금 게시 또는 고지",
    group: "workplace",
    kind: "게시·교육",
    condition: "직원 1명 이상 (동거 친족만 쓰는 사업 제외)",
    cycle: "매년",
    basis: "최저임금법 제11조, 제3조①",
    penalty: "100만 원 이하 과태료 (제31조①1)",
    evidence: "verified",
    plain: "올해 최저임금을 직원이 볼 수 있게 게시하거나 알려요.",
    todo: ["올해 최저임금 안내문 게시"],
    retention: "매년 갱신",
    ruleIds: ["minimumWage.hourly"]
  },
  {
    id: "W4",
    title: "성희롱 예방 교육 실시와 내용 게시",
    group: "workplace",
    kind: "게시·교육",
    condition: "직원 1명 이상. 상시 10명 미만은 교육자료 게시·배포로 가능",
    cycle: "연 1회 이상",
    basis: "남녀고용평등법 제13조, 시행령 제3조①④",
    penalty: "500만 원 이하 과태료 (제39조③1의2·1의3)",
    evidence: "verified",
    plain: "1년에 한 번 이상 성희롱 예방 교육을 하고 내용을 게시해요.",
    todo: ["교육 실시 또는 자료 게시·배포(10명 미만)", "실시일 기록"],
    retention: "3년 권장",
    ruleIds: ["sexualHarassmentEducation"]
  },
  {
    id: "W5",
    title: "식품위생교육 (영업자)",
    group: "workplace",
    kind: "게시·교육",
    condition: "음식점·카페 영업자(사장님). 일반 종업원은 대상 아님",
    cycle: "매년 3시간",
    basis: "식품위생법 제41조, 시행규칙 제52조①",
    penalty: "100만 원 이하 과태료 (제101조④1)",
    evidence: "verified",
    plain: "사장님 본인이 매년 3시간 위생교육을 받아요. 직원은 대상이 아니에요.",
    todo: ["위생교육 기관에서 수강", "수료일 기록"],
    retention: "매년",
    ruleIds: ["foodHygieneEducation"]
  },
  {
    id: "E1",
    title: "근로계약서 작성·교부",
    group: "employee",
    kind: "서류",
    condition: "모든 직원",
    cycle: "근무 시작 전, 조건 변경 시",
    basis: "근로기준법 제17조",
    penalty: "500만 원 이하 벌금 (제114조1호)",
    evidence: "article",
    plain: "계약 내용을 적은 서면을 직원에게 줘야 합니다.",
    todo: ["등록값으로 채운 계약서 만들기", "서명 후 직원에게 교부, 실물은 사업장에 보관"],
    retention: "근로관계가 끝난 날부터 3년",
    ruleIds: ["fixedTerm.writtenTerms", "records.retentionYears"],
    makeable: "contract",
    reissue: "사업장 보관본을 복사해 다시 교부하세요."
  },
  {
    id: "E3",
    title: "근로자 명부 작성",
    group: "employee",
    kind: "서류",
    condition: "사용기간 30일 미만 일용근로자 외",
    cycle: "입사 시, 변경 시",
    basis: "근로기준법 제41조, 시행령 제20·21조",
    penalty: "500만 원 이하 과태료 (제116조②2)",
    evidence: "verified",
    plain: "직원별 인적사항·고용 정보를 명부로 작성해 보관해요. 이름은 출력할 때만 입력해요.",
    todo: ["명부 양식 출력", "이름 등은 출력 직전에 브라우저에서만 입력"],
    retention: "퇴직한 날부터 3년",
    ruleIds: ["records.rosterException"],
    makeable: "roster"
  },
  {
    id: "E4",
    title: "가족관계증명서·친권자(후견인) 동의서 비치",
    group: "employee",
    kind: "서류",
    condition: "18세 미만",
    cycle: "근무 시작 전",
    basis: "근로기준법 제66조",
    penalty: "500만 원 이하 과태료 (제116조②2)",
    evidence: "article",
    plain: "18세 미만 직원은 가족관계증명서와 친권자 동의서를 받아 사업장에 보관해요.",
    todo: ["직원에게 서류 요청 (문구 복사)", "받으면 [받음] 처리"],
    retention: "18세가 되는 날부터 3년",
    ruleIds: ["minor.limits"]
  },
  {
    id: "E5",
    title: "건강진단 결과서(보건증)",
    group: "employee",
    kind: "서류",
    condition: "식품을 조리·판매하는 일에 직접 종사 (완전 포장 식품의 운반·판매만 하면 제외)",
    cycle: "근무 시작 전, 매 1년",
    basis: "식품위생법 제40조, 시행규칙 제49조, 건강진단규칙 제2조",
    penalty: "300만 원 이하 과태료 (제101조③1)",
    evidence: "verified",
    plain: "음식을 다루는 직원은 근무 전에 보건증이 있어야 하고, 1년마다 다시 받아요.",
    todo: ["직원에게 보건증 요청", "검진일·유효기간 입력 (파일은 받지 않아요)"],
    retention: "유효기간 동안",
    ruleIds: ["healthCertificate"],
    reissue: "보건소에서 재발급받을 수 있어요."
  },
  {
    id: "M1",
    title: "임금대장 작성",
    group: "monthly",
    kind: "서류",
    condition: "모든 사업장. 상시 4명 이하는 근로일수·근로시간수 생략 가능",
    cycle: "임금 지급 때마다",
    basis: "근로기준법 제48조①, 시행령 제27조",
    penalty: "500만 원 이하 과태료 (제116조②2)",
    evidence: "article",
    plain: "급여를 줄 때마다 임금대장을 작성해요. 급여를 확정하면 자동으로 만들어져요.",
    todo: ["급여 화면에서 확정"],
    retention: "마지막 기재일부터 3년",
    ruleIds: ["records.retentionYears"]
  },
  {
    id: "M2",
    title: "임금명세서 교부",
    group: "monthly",
    kind: "서류",
    condition: "모든 직원. 규모 예외 없음",
    cycle: "임금 지급 때마다",
    basis: "근로기준법 제48조②, 시행령 제27조의2",
    penalty: "500만 원 이하 과태료 (제116조②2)",
    evidence: "verified",
    plain: "급여를 줄 때 명세서를 줘야 해요. 앱으로 교부하면 직원이 열어본 시각이 수령 확인으로 남아요.",
    todo: ["급여 확정 → 앱 교부 또는 출력"],
    retention: "보관 권장 (3년 보존 목록에는 없음)",
    ruleIds: ["wageStatement.electronic"]
  },
  {
    id: "S3",
    title: "연차 사용 촉진 (서면 촉구·지정 통보)",
    group: "event",
    kind: "서류",
    condition: "상시 5명 이상",
    cycle: "연차 기간 끝나기 6개월 전",
    basis: "근로기준법 제61조",
    penalty: "촉진하지 않으면 미사용 연차 수당 지급 의무",
    evidence: "verified",
    plain: "연차를 다 쓰도록 서면으로 촉구하면 남은 연차 수당 의무가 줄어들 수 있어요.",
    todo: ["기한 화면의 촉진 시점 확인", "서면 촉구"],
    retention: "3년",
    ruleIds: ["annualLeave.promotion"]
  },
  {
    id: "F1",
    title: "체류자격·근무처 제한 확인",
    group: "foreign",
    kind: "서류",
    condition: "모든 외국인",
    cycle: "채용 시, 변경 시",
    basis: "출입국관리법 제18조 (원문 확인 전)",
    penalty: "원문 확인 전이라 표시하지 않아요",
    evidence: "todo",
    plain: "체류자격으로 이 일을 할 수 있는지 확인해요. 외국인등록증 사본은 받지 않아요.",
    todo: ["체류자격·만료일 확인", "확인한 날짜만 기록"],
    retention: "—",
    ruleIds: []
  },
  {
    id: "F2",
    title: "시간제취업 허가 확인",
    group: "foreign",
    kind: "서류",
    condition: "D-2, D-4",
    cycle: "근무 시작 전",
    basis: "출입국관리법 제20조, 하이코리아 매뉴얼 (원문 확인 전)",
    penalty: "원문 확인 전이라 표시하지 않아요",
    evidence: "todo",
    plain: "유학·연수 비자는 시간제취업 허가가 있어야 일할 수 있어요.",
    todo: ["허가 여부·허가 시간 확인", "직원 정보에 입력"],
    retention: "—",
    ruleIds: []
  },
  {
    id: "F3",
    title: "고용·퇴직 등 변동 신고",
    group: "foreign",
    kind: "서류",
    condition: "신고 대상 외국인",
    cycle: "변동 시",
    basis: "출입국관리법 제19조 (원문 확인 전)",
    penalty: "원문 확인 전이라 표시하지 않아요",
    evidence: "todo",
    plain: "외국인 직원의 고용·퇴직 변동을 신고해야 할 수 있어요. 대상과 기한은 확인이 필요해요.",
    todo: ["신고 대상 여부 확인"],
    retention: "—",
    ruleIds: []
  },
  {
    id: "F4",
    title: "외국인고용법 표준근로계약서",
    group: "foreign",
    kind: "서류",
    condition: "E-9",
    cycle: "채용 시",
    basis: "외국인고용법 제9조①",
    penalty: "—",
    evidence: "verified",
    plain: "E-9 직원은 외국인고용법상 표준근로계약서를 써요. 서식 링크는 아직 확보하지 못했어요.",
    todo: ["서식 확인", "작성·교부"],
    retention: "3년",
    ruleIds: []
  }
];
var ITEM_BY_ID = new Map(CHECKLIST_ITEMS.map((i) => [i.id, i]));
function activeEmployees(state, date) {
  return state.employees.filter((e) => !e.resignDate || e.resignDate >= date);
}
function contractKind(e, c) {
  if (e.ageBand === "under18") return "연소근로자 표준근로계약서";
  if (e.isForeign && e.foreign?.visa === "E-9") return "외국인고용법 표준근로계약서";
  if (c && !c.variable && weeklyHours(c) < 40) return e.employmentType === "fixed" ? "단시간근로자 표준근로계약서 (기간 있음)" : "단시간근로자 표준근로계약서";
  if (e.employmentType === "fixed") return "표준근로계약서 (기간 있음)";
  return "표준근로계약서 (기간 없음)";
}
function recordFor(state, key) {
  return state.docRecords.find((r) => r.key === key) ?? null;
}
function levelForDue(due, base, e) {
  if (e && e.onboarding === "existing-pending" && due < e.registeredAt) return { level: null, text: "기존 직원 — 한 번에 체크로 정리", onboarding: true };
  const d = diffDays(base, due);
  if (d <= 0) return { level: "risk", text: due < base ? "입사일 지남" : "오늘까지", onboarding: false };
  if (d <= 3) return { level: "soon", text: `D-${d}`, onboarding: false };
  return { level: null, text: `D-${d}`, onboarding: false };
}
function computeChecklist(state, base) {
  const wp = state.workplace;
  if (!wp) return [];
  const rows = [];
  const emps = activeEmployees(state, base);
  const count = emps.length;
  const scale = wp.scale;
  const mk = (item, partial) => ({
    key: item.id,
    item,
    title: item.title,
    employeeId: null,
    alias: null,
    conditionId: null,
    applies: true,
    naReason: "",
    boundaryHint: "",
    status: "todo",
    level: null,
    levelText: "",
    dueDate: null,
    record: null,
    contractKind: null,
    link: `/owner/documents?item=${item.id}`,
    ...partial
  });
  const applyRecord = (row) => {
    const rec = recordFor(state, row.key);
    row.record = rec;
    if (!row.applies) {
      row.status = "na";
      row.level = null;
      return row;
    }
    if (rec) {
      row.status = rec.status === "na" ? "na" : rec.status === "stored" ? "stored" : "done";
      if (rec.status === "na") row.naReason = rec.naReason;
      row.level = null;
      row.levelText = rec.doneAt ? `${rec.doneAt} 완료` : "완료";
    }
    return row;
  };
  const itm = (id) => ITEM_BY_ID.get(id);
  rows.push(applyRecord(mk(itm("W1"), { applies: scale === "10+", naReason: "상시 10명 이상부터 작성·신고 의무가 있어요 (근로기준법 제93조)", boundaryHint: scale === "5-9" ? "직원이 늘어 10명 이상이 되면 추가돼요" : "" })));
  rows.push(applyRecord(mk(itm("W2"), { applies: !isUnder5(scale), naReason: "1~4명 사업장은 제14조가 적용되지 않아요 (근로기준법 시행령 별표 1)", boundaryHint: isUnder5(scale) ? "직원이 늘어 5명 이상이 되면 추가돼요" : "" })));
  const anyEmp = count > 0 && !wp.familyOnly;
  const yearly = (row, months) => {
    if (row.status === "done" && row.record?.doneAt && diffDays(row.record.doneAt, base) > months * 30.4) {
      row.status = "todo";
      row.levelText = `지난 실시 ${row.record.doneAt} — 다시 할 때예요`;
    }
    if (row.status === "todo" && row.applies) {
      row.level = "check";
      if (!row.levelText) row.levelText = "실시 기록 없음";
    }
    return row;
  };
  rows.push(yearly(applyRecord(mk(itm("W3"), { applies: anyEmp, naReason: wp.familyOnly ? "동거하는 친족만 사용하는 사업장은 제외" : "직원이 생기면 추가돼요" })), 12));
  rows.push(yearly(applyRecord(mk(itm("W4"), { applies: anyEmp, naReason: "직원이 생기면 추가돼요", title: count && scale !== "10+" ? "성희롱 예방 교육 (10명 미만: 자료 게시·배포 가능)" : itm("W4").title })), 12));
  rows.push(yearly(applyRecord(mk(itm("W5"), { applies: wp.industry === "food", naReason: "음식점·카페 영업자만 대상이에요" })), 12));
  for (const e of emps) {
    const hist = conditionHistory(state.conditions, e.id);
    hist.forEach((c, idx) => {
      const isChange = idx > 0;
      const due = isChange ? c.effectiveFrom : e.hireDate;
      const row = mk(itm("E1"), {
        key: `E1:${e.id}:${c.id}`,
        title: isChange ? `변경 계약서 작성·교부 (${c.effectiveFrom} 적용)` : "근로계약서 작성·교부",
        employeeId: e.id,
        alias: e.alias,
        conditionId: c.id,
        dueDate: due,
        contractKind: contractKind(e, c),
        link: `/owner/documents?item=E1&emp=${e.id}&cond=${c.id}`
      });
      applyRecord(row);
      if (row.status === "todo") {
        const lv = levelForDue(due, base, e);
        row.level = lv.level;
        row.levelText = isChange ? `조건 변경 (${lv.text})` : lv.text;
        if (lv.onboarding) row.status = "onboarding";
        if (c.variable && row.level === null) {
          row.level = "check";
          row.levelText = "매주 달라요 — 근로일별 시간을 채울 수 없어 확인 필요";
        }
      }
      rows.push(row);
    });
    {
      const daily = e.employmentType === "daily";
      const usedDays = diffDays(e.hireDate, base) + 1;
      const applies = !daily || usedDays >= 30;
      const row = mk(itm("E3"), { key: `E3:${e.id}`, employeeId: e.id, alias: e.alias, applies, naReason: "사용기간 30일 미만 일용근로자는 작성 생략 가능 (시행령 제21조) — 30일이 되면 추가돼요", dueDate: daily ? null : e.hireDate });
      applyRecord(row);
      if (row.status === "todo" && row.dueDate) {
        const lv = levelForDue(row.dueDate, base, e);
        row.level = lv.level;
        row.levelText = lv.text;
        if (lv.onboarding) row.status = "onboarding";
      } else if (row.status === "todo") {
        row.level = "soon";
        row.levelText = "하루 단위 고용 30일 도달";
      }
      rows.push(row);
    }
    {
      const row = mk(itm("E4"), { key: `E4:${e.id}`, employeeId: e.id, alias: e.alias, applies: e.ageBand === "under18", naReason: "18세 미만 직원만", dueDate: e.hireDate });
      applyRecord(row);
      if (row.status === "todo" && row.applies) {
        const lv = levelForDue(e.hireDate, base, e);
        row.level = lv.level;
        row.levelText = lv.text;
        if (lv.onboarding) row.status = "onboarding";
      }
      rows.push(row);
    }
    {
      const applies = wp.industry === "food" && e.foodHandler;
      const row = mk(itm("E5"), { key: `E5:${e.id}`, employeeId: e.id, alias: e.alias, applies, naReason: wp.industry !== "food" ? "음식점·카페 업종만" : "식품을 직접 다루지 않는 직원 (등록 정보 기준)", dueDate: e.hireDate });
      applyRecord(row);
      if (row.applies) {
        if (row.status === "todo") {
          const lv = levelForDue(e.hireDate, base, e);
          row.level = lv.level;
          row.levelText = lv.text;
          if (lv.onboarding) row.status = "onboarding";
        } else if (row.status === "done" || row.status === "stored") {
          const exp = row.record?.expiry;
          if (!exp) {
            row.level = "check";
            row.levelText = "유효기간 입력 필요";
          } else {
            const d = diffDays(base, exp);
            row.dueDate = exp;
            if (d < 0) {
              row.level = "risk";
              row.levelText = `유효기간 지남 (${exp})`;
            } else if (d <= 30) {
              row.level = "soon";
              row.levelText = `유효기간 D-${d} — 재검진 시기`;
            } else row.levelText = `유효기간 ${exp}`;
          }
        }
      }
      rows.push(row);
    }
    if (e.isForeign && e.foreign) {
      const f = e.foreign;
      const f1 = applyRecord(mk(itm("F1"), { key: `F1:${e.id}`, employeeId: e.id, alias: e.alias }));
      if (f.checkedAt) {
        f1.status = "done";
        f1.levelText = `${f.checkedAt} 확인`;
      } else if (f1.status === "todo") {
        f1.level = "check";
        f1.levelText = "확인 필요";
      }
      rows.push(f1);
      if (f.visa === "D-2" || f.visa === "D-4") {
        const f2 = mk(itm("F2"), { key: `F2:${e.id}`, employeeId: e.id, alias: e.alias });
        if (f.permitted === true && f.permitHours != null) {
          f2.status = "done";
          f2.levelText = `허가 ${f.permitHours}시간`;
        } else {
          f2.level = f.permitted === false ? "risk" : "check";
          f2.levelText = f.permitted === false ? "허가 전 — 근무 시작 전 확인 필요" : "허가 여부·시간 입력 필요";
        }
        rows.push(f2);
      }
      const f3 = applyRecord(mk(itm("F3"), { key: `F3:${e.id}`, employeeId: e.id, alias: e.alias }));
      if (f3.status === "todo") {
        f3.level = "check";
        f3.levelText = "대상·기한 원문 확인 전";
      }
      rows.push(f3);
      if (f.visa === "E-9") {
        const f4 = applyRecord(mk(itm("F4"), { key: `F4:${e.id}`, employeeId: e.id, alias: e.alias, dueDate: e.hireDate }));
        if (f4.status === "todo") {
          const lv = levelForDue(e.hireDate, base, e);
          f4.level = lv.level ?? "check";
          f4.levelText = lv.text;
        }
        rows.push(f4);
      }
    }
  }
  if (count > 0) {
    const months = recentPayMonths(state, base);
    for (const m of months) {
      const p = state.payrolls.find((x) => x.month === m.month);
      const confirmed = p?.status === "confirmed";
      const delivered = confirmed && emps.every((e) => state.statements.some((s) => s.payrollId === p.id && s.employeeId === e.id) || !p.confirmedLines?.some((l) => l.employeeId === e.id));
      for (const [id, done] of [["M1", confirmed], ["M2", delivered]]) {
        const row = mk(itm(id), { key: `${id}:${m.month}`, title: `${Number(m.month.slice(5))}월분 ${itm(id).title}`, dueDate: m.payDate, link: `/owner/payroll?month=${m.month}` });
        if (done) {
          row.status = "done";
          row.levelText = id === "M1" ? `${localDate(p.confirmedAt)} 확정` : "교부함";
        } else {
          const d = diffDays(base, m.payDate);
          row.level = d < 0 ? "risk" : d <= 3 ? "soon" : null;
          row.levelText = d < 0 ? `지급일 지남 (${m.payDate})` : `지급일 ${m.payDate} · D-${d}`;
        }
        rows.push(row);
      }
    }
  }
  rows.push(applyRecord(mk(itm("S3"), { applies: !isUnder5(scale), naReason: "1~4명 사업장은 연차 규정이 적용되지 않아요", link: "/owner/deadlines" })));
  return rows;
}
function recentPayMonths(state, base) {
  const wp = state.workplace;
  if (!wp) return [];
  const out = [];
  const thisMonth = monthOf(base);
  for (const offset of [-2, -1, 0, 1]) {
    const [y, m] = thisMonth.split("-").map(Number);
    const total = y * 12 + (m - 1) + offset;
    const ym = `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, "0")}`;
    const p = payrollPeriodFor(wp, ym);
    out.push({ month: ym, payDate: p.payDate });
  }
  const past = out.filter((o) => o.payDate <= base);
  const future = out.filter((o) => o.payDate > base);
  const lastPast = past.slice(-1).filter((o) => {
    const per = payrollPeriodFor(wp, o.month);
    const emps = state.employees.filter((e) => e.hireDate <= per.to && (!e.resignDate || e.resignDate >= per.from));
    return emps.length > 0 && per.payDate >= emps.map((e) => e.registeredAt).sort()[0];
  });
  const unconfirmedPast = past.filter((o) => {
    const per = payrollPeriodFor(wp, o.month);
    const emps = state.employees.filter((e) => e.hireDate <= per.to && (!e.resignDate || e.resignDate >= per.from));
    return state.payrolls.find((p) => p.month === o.month)?.status !== "confirmed" && emps.length > 0 && per.payDate >= emps.map((e) => e.registeredAt).sort()[0];
  });
  const set = /* @__PURE__ */ new Map();
  for (const o of [...unconfirmedPast, ...lastPast, ...future.slice(0, 1)]) set.set(o.month, o);
  return Array.from(set.values()).sort((a, b) => a.month < b.month ? -1 : 1);
}
var activeEmps = (s, base) => s.employees.filter((e) => !e.resignDate || e.resignDate >= base);
var RISK_QUESTIONS = [
  { id: "R1", no: 1, text: "휴게시간을 근무 중에 실제로 쉬게 하시나요?", dangerAnswer: "no", risk: "쉰 시간도 근무로 계산돼 임금 차액을 청구받을 수 있어요", action: "근무 일정에 휴게시간 반영 (2026.12.10부터 4시간 근무는 직원이 요청하면 생략 가능 — 요청 기록 남기기)", actionLink: "/owner/work", expert: false, basis: "근로기준법 제54조", visible: (s, b) => activeEmps(s, b).length > 0 },
  { id: "R2", no: 2, text: "주 15시간 이상 직원에게 주휴수당을 주시나요?", dangerAnswer: "no", risk: "퇴사 후 밀린 주휴수당을 한꺼번에 청구받을 수 있어요", action: "급여 화면에서 주휴수당 계산", actionLink: "/owner/payroll", expert: false, basis: "근로기준법 제55조", visible: (s, b) => activeEmps(s, b).some((e) => weeklyHours(conditionAt(s.conditions, e.id, b)) >= 15) },
  { id: "R3", no: 3, text: "수습 기간에 최저임금보다 적게 주시나요?", dangerAnswer: "yes", risk: "감액 조건이 맞지 않으면 차액이 체불이 돼요", action: "노무 전문가와 확인", actionLink: "/owner/consult?topic=수습 감액", expert: true, basis: "최저임금법 제5조", visible: (s, b) => activeEmps(s, b).some((e) => !!e.probationEnd && e.probationEnd >= b) },
  { id: "R4", no: 4, text: "지각 벌금이나 파손 비용을 월급에서 빼시나요?", dangerAnswer: "yes", risk: "뺀 금액이 체불로 인정될 수 있어요", action: "노무 전문가와 확인", actionLink: "/owner/consult?topic=임금 공제", expert: true, basis: "근로기준법 제20조, 제43조", visible: () => true },
  { id: "R5", no: 5, text: "월급을 정해진 날에 한 번에 다 주시나요?", dangerAnswer: "no", risk: "체불 진정 대상이 될 수 있어요", action: "급여일 알림 확인 (기한 화면)", actionLink: "/owner/deadlines", expert: false, basis: "근로기준법 제43조", visible: () => true },
  { id: "R6", no: 6, text: "계약서와 다른 요일·시간으로 자주 일을 시키시나요?", dangerAnswer: "yes", risk: "분쟁 때 계약서가 불리한 증거가 돼요", action: "변경 계약서 만들기", actionLink: "/owner/documents?item=E1", expert: false, basis: "근로기준법 제17조", visible: () => true },
  { id: "R7", no: 7, text: "연장근무를 직원과 미리 합의하시나요?", dangerAnswer: "no", risk: "한도(주 12시간)를 넘기면 처벌 대상이에요", action: "근무 일정에서 주간 시간 확인", actionLink: "/owner/work", expert: false, basis: "근로기준법 제53조 (1~4명은 시행령 별표 1에 제53조 없음)", under5Info: "1~4명 사업장은 법적 의무가 아니에요. 권장 사항으로 안내해요.", visible: () => true },
  { id: "R8", no: 8, text: "직원을 내보낼 때 30일 전에 알리시나요?", dangerAnswer: "no", risk: "30일분 통상임금(예고수당) 청구, 5명 이상은 서면 통지·부당해고 다툼", action: "노무 전문가와 확인", actionLink: "/owner/consult?topic=해고 예고", expert: true, basis: "근로기준법 제26조(1~4명 포함), 제27조(5명 이상)", visible: () => true },
  { id: "R9", no: 9, text: "괴롭힘 신고가 들어오면 처리 방법을 정해 두셨나요?", dangerAnswer: "no", risk: "신고 후 조치를 안 하면 사장님 책임(과태료)", action: "노무 전문가와 확인", actionLink: "/owner/consult?topic=직장 내 괴롭힘", expert: true, basis: "근로기준법 제76조의2·3 (1~4명은 별표 1 제6장에 제76조만 있음, 팀원 의견은 적용 — 11.26 직전 재확인)", under5Info: "1~4명 사업장은 법적 의무가 아니에요(시행령 별표 1). 정부가 적용 확대를 추진 중이라 권장으로 안내해요.", visible: () => true },
  { id: "R10", no: 10, text: "퇴사자 임금·퇴직금을 14일 안에 정산하시나요?", dangerAnswer: "no", risk: "지연 시 체불 진정 대상이에요", action: "퇴사 처리 화면", actionLink: "/owner/employees", expert: false, basis: "근로기준법 제36조", visible: () => true },
  { id: "R11", no: 11, text: "18세 미만 직원에게 밤 10시 이후나 휴일에 일을 시키시나요?", dangerAnswer: "yes", risk: "본인 동의와 고용노동부장관 인가가 필요해요", action: "근무 일정 확인 · 전문가 확인", actionLink: "/owner/work", expert: true, basis: "근로기준법 제70조②", visible: (s, b) => activeEmps(s, b).some((e) => e.ageBand === "under18") }
];
function evaluateRisk(state, base) {
  const scale = state.workplace?.scale ?? "1-4";
  const under5 = isUnder5(scale);
  const rows = [];
  for (const q of RISK_QUESTIONS) {
    if (!q.visible(state, base)) continue;
    const a = state.riskAnswers.find((x) => x.questionId === q.id) ?? null;
    let result = "unanswered";
    let text = "";
    if (a) {
      const stale = addMonths(a.answeredAt, 6) <= base || a.scaleAtAnswer !== scale;
      if (stale) {
        result = "stale";
        text = a.scaleAtAnswer !== scale ? "규모 구간이 바뀌어 다시 확인해요" : "6개월이 지나 다시 확인해요";
      } else if (a.answer === "unknown") {
        result = "check";
        text = "잘 모르겠어요 — 확인 필요";
      } else if (a.answer === q.dangerAnswer) {
        if (under5 && q.under5Info) {
          result = "info";
          text = q.under5Info;
        } else {
          result = "risk";
          text = q.risk;
        }
      } else {
        result = "ok";
        text = "";
      }
    }
    rows.push({ q, answer: a, result, text });
  }
  const answered = rows.filter((r) => r.answer && r.result !== "stale").length;
  return { rows, answered, total: rows.length, riskCount: rows.filter((r) => r.result === "risk").length, checkCount: rows.filter((r) => r.result === "check").length };
}
var VISA_GUIDE = {
  "D-2": "유학 — 시간제취업 허가 여부·허가 시간, 다른 사업장 주당 시간 합계 확인",
  "D-4": "연수 — 시간제취업 허가 여부·허가 시간 확인",
  "E-9": "고용허가 — 허용 업종·근무처 제한 확인, 외국인고용법 표준근로계약서, 출국만기보험",
  "H-2": "방문취업 — 취업 제한 업종 확인 (F-4 통합 여부는 법무부 원문 확인 전)",
  "F-4": "재외동포 — 취업 제한 업종 확인",
  other: "기타 — 확인 필요"
};
function foreignSignal(state, e, baseDate) {
  if (!e.isForeign || !e.foreign) return null;
  const f = e.foreign;
  const items = [];
  if (f.expiry) {
    const d = diffDays(baseDate, f.expiry);
    if (d < 0) items.push({ signal: "risk", text: `체류기간 만료일이 지났어요 (${f.expiry})` });
    else if (d <= 30) items.push({ signal: "check", text: `체류기간 만료 D-${d} — 연장 여부 확인 (알림은 연장·허가를 대신하지 않아요)` });
    else items.push({ signal: "ok", text: `체류기간 ${f.expiry}까지` });
  } else items.push({ signal: "check", text: "체류기간 만료일 입력 필요" });
  if (f.visa === "D-2" || f.visa === "D-4") {
    if (f.permitted === false) items.push({ signal: "risk", text: "시간제취업 허가 전 — 근무 시작 전에 확인이 필요해요" });
    else if (f.permitted === null) items.push({ signal: "check", text: "시간제취업 허가 여부 확인 필요" });
    else {
      const wh = weeklyHours(conditionAt(state.conditions, e.id, baseDate));
      if (f.permitHours == null) items.push({ signal: "check", text: "허가 시간 입력 필요 (유학생 허가 시간 기준은 원문 미확인)" });
      else if (wh + (f.otherWorkplaceHours || 0) > f.permitHours) items.push({ signal: "risk", text: `주 ${wh.toFixed(1)}h + 다른 사업장 ${f.otherWorkplaceHours}h가 허가 ${f.permitHours}h를 넘어요` });
      else items.push({ signal: "ok", text: `허가 ${f.permitHours}h 이내 (주 ${wh.toFixed(1)}h + 다른 사업장 ${f.otherWorkplaceHours}h)` });
    }
  } else if (f.checkedAt) {
    items.push({ signal: "ok", text: `체류자격·근무처 확인함 (${f.checkedAt})` });
  } else {
    items.push({ signal: "check", text: VISA_GUIDE[f.visa] ?? VISA_GUIDE.other });
  }
  const signal = items.some((i) => i.signal === "risk") ? "risk" : items.some((i) => i.signal === "check") ? "check" : "ok";
  return { signal, items };
}
var ORDER = { risk: 0, soon: 1, check: 2 };
function computeTodos(state, base) {
  const out = [];
  if (!state.workplace) return out;
  const alias = (id) => state.employees.find((e) => e.id === id)?.alias ?? "";
  for (const r of computeChecklist(state, base)) {
    if (!r.level || r.status === "done" || r.status === "na" || r.status === "onboarding") continue;
    out.push({ id: `doc:${r.key}`, level: r.level, area: r.item.group === "monthly" ? "임금" : r.item.group === "foreign" ? "외국인" : "서류", title: `${r.alias ? r.alias + " " : ""}${r.title}${r.levelText ? ` (${r.levelText})` : ""}`, badge: r.level === "risk" ? "위험" : r.level === "soon" ? r.levelText.match(/D-\d+/)?.[0] ?? "임박" : "확인", basis: r.item.basis, link: r.link, date: r.dueDate, employeeId: r.employeeId });
  }
  for (const d of computeDeadlines(state, base)) {
    if (d.status === "overdue" || d.status === "due7") {
      if (d.type === "payday" && out.some((t) => t.id.startsWith("doc:M"))) continue;
      out.push({ id: `dl:${d.key}`, level: d.status === "overdue" ? "risk" : "soon", area: d.type.startsWith("ins") || d.type.startsWith("severance") ? "보험·퇴직금" : d.type === "visaExpiry" ? "외국인" : d.type === "payday" ? "임금" : "기한", title: `${d.title}${d.secondaryLabel ? ` · ${d.secondaryLabel}` : ""}`, badge: d.status === "overdue" ? "위험" : d.dLabel, basis: d.basis, link: d.link, date: d.date, employeeId: d.employeeId });
    }
  }
  for (const e of state.employees) {
    if (e.resignDate && e.resignDate < base) continue;
    if (e.insuranceMethod === "notYet") out.push({ id: `ins:${e.id}`, level: "risk", area: "보험·퇴직금", title: `${e.alias} 4대보험 처리 · 아직 안 함`, badge: "위험", basis: "4대보험 취득 신고", link: `/owner/insurance?emp=${e.id}`, date: null, employeeId: e.id });
    if (e.onboarding === "existing-pending") out.push({ id: `onb:${e.id}`, level: "check", area: "직원", title: `${e.alias} 있는 서류·보험·지난 기한 한 번에 체크하기`, badge: "정리", basis: "기존 직원 입구", link: `/owner/employees/${e.id}/onboarding`, date: null, employeeId: e.id });
    const disp = e.conditionAcks.find((a) => a.status === "disputed" && !a.resolvedAt);
    if (disp) out.push({ id: `ack:${e.id}`, level: "check", area: "직원", title: `${e.alias} 근로조건에 "다른 점이 있어요": ${disp.memo}`, badge: "확인", basis: "직원 근로조건 확인", link: `/owner/employees/${e.id}`, date: null, employeeId: e.id });
    const fs = foreignSignal(state, e, base);
    if (fs && fs.signal === "risk") out.push({ id: `fx:${e.id}`, level: "risk", area: "외국인", title: `${e.alias} 외국인 신호등 위험: ${fs.items.find((i) => i.signal === "risk")?.text}`, badge: "위험", basis: "외국인 고용 확인", link: `/owner/employees/${e.id}`, date: null, employeeId: e.id });
    if (contractDriftWeeks(state, e, base) >= 3) out.push({ id: `drift:${e.id}`, level: "check", area: "근무", title: `${e.alias} 최근 4주 중 3주 이상 계약 시간과 달라요 — 변경 계약서를 만들까요?`, badge: "확인", basis: "근로기준법 제17조", link: `/owner/employees/${e.id}?tab=conditions`, date: null, employeeId: e.id });
  }
  for (const a of state.attendance.filter((x) => x.status !== "confirmed" && !(x.status === "pending" && !x.original.clockOut && x.date >= base))) {
    out.push({ id: `att:${a.id}`, level: "check", area: "근무", title: `${alias(a.employeeId)} ${a.date.slice(5)} 출퇴근 확인 대기 · ${a.reason}`, badge: "확인", basis: "사장님이 확정한 시간만 급여에 반영", link: `/owner/work?tab=attendance&record=${a.id}`, date: a.date, employeeId: a.employeeId });
  }
  for (const ed of state.attendanceEdits.filter((x) => x.employeeResponse?.status === "disputed")) {
    const rec = state.attendance.find((r) => r.id === ed.recordId);
    const resolved = state.attendanceEdits.some((x) => x.recordId === ed.recordId && x.at > ed.at);
    if (rec && !resolved) out.push({ id: `disp:${ed.id}`, level: "check", area: "근무", title: `${alias(rec.employeeId)} 출퇴근 수정에 "다른 점이 있어요": ${ed.employeeResponse.memo}`, badge: "확인", basis: "근무 기록 수정 이력", link: `/owner/work?tab=attendance&record=${rec.id}`, date: rec.date, employeeId: rec.employeeId });
  }
  for (const s of state.substitutions.filter((x) => x.status === "applied")) out.push({ id: `sub:${s.id}`, level: "check", area: "근무", title: `${s.date.slice(5)} 대타 승인 대기 (${alias(s.fromEmployeeId)} → ${alias(s.toEmployeeId)})`, badge: "승인", basis: "대타", link: "/owner/work?tab=subs", date: s.date, employeeId: s.fromEmployeeId });
  for (const l of state.leaveRequests.filter((x) => x.status === "requested")) out.push({ id: `lv:${l.id}`, level: "check", area: "근무", title: `${alias(l.employeeId)} 연차 신청 ${l.date.slice(5)}${l.hours ? ` ${l.hours}시간` : ""}`, badge: "승인", basis: "근로기준법 제60조", link: "/owner/work?tab=leave", date: l.date, employeeId: l.employeeId });
  for (const r of state.docRequests.filter((x) => x.status === "requested")) {
    const d = diffDays(base, r.dueDate);
    if (d <= 3) out.push({ id: `req:${r.id}`, level: d < 0 ? "risk" : "soon", area: "서류", title: `${alias(r.employeeId)} ${r.customName} 요청 기한 ${r.dueDate.slice(5)}`, badge: d < 0 ? "지남" : dDayLabel(d), basis: "서류 요청", link: "/owner/documents?tab=requests", date: r.dueDate, employeeId: r.employeeId });
  }
  const risk = evaluateRisk(state, base);
  for (const r of risk.rows.filter((x) => x.result === "risk" || x.result === "check")) out.push({ id: `risk:${r.q.id}`, level: r.result === "risk" ? "risk" : "check", area: "점검", title: `위험 점검 ${r.q.no}번: ${r.text}`, badge: r.result === "risk" ? "위험" : "확인", basis: r.q.basis, link: r.q.expert ? r.q.actionLink : `/owner/risk#${r.q.id}`, date: null, employeeId: null });
  const seen = /* @__PURE__ */ new Set();
  return out.filter((t) => seen.has(t.id) ? false : (seen.add(t.id), true)).sort((a, b) => ORDER[a.level] - ORDER[b.level] || (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}
function areaCounts(todos) {
  const c = { 서류: 0, 임금: 0, "보험·퇴직금": 0, 기한: 0, 외국인: 0, 근무: 0, 점검: 0, 직원: 0 };
  for (const t of todos) if (t.level !== "check" || t.area === "점검") c[t.area]++;
  return c;
}
var FAQS = [
  {
    id: "FAQ1",
    q: "5명 미만 사업장은 뭐가 다른가요?",
    keywords: ["5명", "5인", "미만", "1~4명", "4명", "소규모", "가산", "적용"],
    oneLine: "연장·야간·휴일 가산, 공휴일 유급, 연차, 해고 서면 통지, 괴롭힘 조치 의무 등이 적용되지 않아요. 최저임금·주휴수당·퇴직금·해고 예고는 똑같이 적용돼요.",
    todo: ["사업장 설정의 규모 구간이 맞는지 확인", '급여 화면의 "가산이 0원인 이유" 확인'],
    ruleIds: ["scope.under5.appliedArticles"],
    basis: "근로기준법 시행령 별표 1",
    expert: false
  },
  {
    id: "FAQ2",
    q: "주휴수당은 누구에게 줘야 하나요?",
    keywords: ["주휴", "주휴수당", "15시간", "개근"],
    oneLine: "4주 평균 주 15시간 이상 일하고, 그 주 정해진 근무일을 모두 나온 직원에게 줘요. 1~4명 사업장도 적용돼요.",
    todo: ["직원별 주 소정근로시간 확인", "급여 화면의 주휴수당 계산 근거 확인"],
    ruleIds: ["weeklyHoliday.minWeeklyHours", "weeklyHoliday.paidHours"],
    basis: "근로기준법 제55조①, 제18조③, 시행령 제30조①",
    expert: false
  },
  {
    id: "FAQ3",
    q: "수습 중인 직원에게 월급을 덜 줘도 되나요?",
    keywords: ["수습", "감액", "90%", "덜", "적게"],
    oneLine: "1년 이상 계약, 수습 3개월 이내, 단순노무 직종이 아닐 때만 최저임금의 10%까지 줄일 수 있어요. 음식점·카페 일은 해당이 안 될 수 있어요.",
    todo: ["계약 기간이 1년 이상인지 확인", "감액 전에 전문가 확인"],
    ruleIds: ["minimumWage.probation"],
    basis: "최저임금법 제5조②, 시행령 제3조",
    expert: true
  },
  {
    id: "FAQ4",
    q: "1년 직전에 그만두면 퇴직금은요?",
    keywords: ["퇴직금", "1년", "직전", "364"],
    oneLine: "계속근로 1년 미만이면 퇴직금 대상이 아니에요. 서비스는 기간만 안내하고 퇴사 시기를 조언하지 않아요.",
    todo: ['직원 상세의 "1년 되는 날" 확인'],
    ruleIds: ["severance.basic"],
    basis: "퇴직급여법 제4조①",
    expert: false
  },
  {
    id: "FAQ5",
    q: "4대보험은 어떻게 처리하나요?",
    keywords: ["4대보험", "보험", "신고", "취득", "국민연금", "건강보험", "고용보험", "산재"],
    oneLine: "건강보험은 입사일부터 14일 이내, 국민연금·고용·산재는 다음 달 15일까지 취득 신고해요. 직접 하거나 대리인에게 맡길 수 있어요.",
    todo: ["보험 화면에서 처리 방식 선택", '신고 후 "신고함" 날짜 기록'],
    ruleIds: ["insurance.reportDeadline"],
    basis: "국민건강보험법 제8조②, 국민연금법 시행규칙 제6조①, 고용보험법 시행령 제7조①",
    expert: false
  },
  {
    id: "FAQ6",
    q: "유학생 아르바이트를 써도 되나요?",
    keywords: ["유학생", "D-2", "D-4", "외국인", "아르바이트", "비자"],
    oneLine: "시간제취업 허가가 있어야 해요. 허가 시간과 다른 사업장 시간을 합쳐 넘지 않게 관리하세요. 허가 시간 기준은 원문 확인 전이에요.",
    todo: ["직원 등록에서 허가 여부·허가 시간 입력", "근무 일정의 허가시간 경고 확인"],
    ruleIds: [],
    basis: "출입국관리법 제20조 (원문 확인 전)",
    expert: true
  },
  {
    id: "FAQ7",
    q: "휴게시간은 얼마나 줘야 하나요?",
    keywords: ["휴게", "쉬는", "30분", "1시간", "휴식"],
    oneLine: "4시간 이상 일하면 30분, 8시간 이상이면 1시간 이상이에요. 2026.12.10부터 정확히 4시간 근무는 직원이 요청하면 생략할 수 있어요.",
    todo: ["근무 일정의 휴게 부족 경고 확인", "생략 요청은 근로조건에 기록"],
    ruleIds: ["break.minimum"],
    basis: "근로기준법 제54조①",
    expert: false
  },
  {
    id: "FAQ8",
    q: "임금명세서는 꼭 줘야 하나요?",
    keywords: ["명세서", "임금명세서", "교부"],
    oneLine: "모든 사업장, 모든 직원에게 임금 지급 때마다 줘야 해요. 전자문서로 줄 수 있어요.",
    todo: ["급여 확정 → 앱 교부 또는 출력"],
    ruleIds: ["wageStatement.electronic"],
    basis: "근로기준법 제48조②",
    expert: false
  },
  {
    id: "FAQ9",
    q: "직원을 내보내려면 어떻게 하나요?",
    keywords: ["해고", "내보내", "자르", "그만두게", "징계"],
    oneLine: "30일 전에 알리거나 30일분 통상임금을 줘야 해요(1~4명 포함). 5명 이상은 서면 통지가 필요하고 정당성 다툼이 생길 수 있어 전문가 확인을 권해요.",
    todo: ['퇴사 처리 마법사에서 "내보냄" 선택', "노무 전문가와 확인"],
    ruleIds: ["dismissal.notice"],
    basis: "근로기준법 제26조, 제27조",
    expert: true
  },
  {
    id: "FAQ10",
    q: "3.3% 떼고 프리랜서로 계약하면 되나요?",
    keywords: ["3.3", "프리랜서", "사업소득", "근로자 여부"],
    oneLine: "근로자인지는 계약 형식이 아니라 실제 일하는 방식으로 판단해요. 이 서비스는 등록한 직원을 근로자로 계산해요.",
    todo: ["판단이 필요하면 전문가 확인"],
    ruleIds: [],
    basis: "근로기준법 제2조 (판례)",
    expert: true
  }
];
function searchFaq(query) {
  const q = query.replace(/\s+/g, " ").trim();
  if (!q) return [];
  const tokens = q.split(/[\s,.?!]+/).filter((t) => t.length >= 1);
  return FAQS.map((faq) => {
    let score = 0;
    for (const k of faq.keywords) if (q.includes(k)) score += 3;
    for (const t of tokens) if (t.length >= 2 && (faq.q.includes(t) || faq.oneLine.includes(t))) score += 1;
    return { faq, score };
  }).filter((x) => x.score >= 3).sort((a, b) => b.score - a.score).slice(0, 3);
}
function detectPII(text) {
  const found = [];
  if (/\d{6}\s*-?\s*[1-8]\d{6}/.test(text)) found.push("주민등록번호·외국인등록번호로 보이는 숫자");
  if (/01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}/.test(text)) found.push("휴대폰 번호");
  if (/0\d{1,2}-\d{3,4}-\d{4}/.test(text)) found.push("전화번호");
  return Array.from(new Set(found));
}
function buildMemo(state, question, faq, base) {
  const wp = state.workplace;
  const ind = wp ? { food: "음식점·카페", retail: "소매", service: "기타 서비스업" }[wp.industry] : "-";
  const lines = [
    `상담 전 정리 메모 · 작성 ${base} · 참고용`,
    "",
    `질문: ${question || "(입력 없음)"}`,
    `사업장 조건: ${ind} · 상시 ${wp?.scale ?? "-"}명 구간`
  ];
  if (faq) {
    lines.push(`관련 안내: ${faq.oneLine}`);
    lines.push(`관련 조문: ${faq.basis}`);
  } else lines.push("관련 조문: 자동으로 찾지 못함 — 전문가 확인 필요");
  lines.push("확인할 점:");
  lines.push("  1. 사실관계(날짜·근무 시간·지급 내역)");
  lines.push("  2. 사업장 규모별 적용 여부");
  lines.push('  3. 서비스 화면의 "확인 필요" 항목');
  lines.push("");
  lines.push("※ 이 메모는 브라우저에서만 만들었고 저장되지 않아요. 직원 실명·번호는 넣지 마세요.");
  return lines.join("\n");
}
var EMPTY_DIAG = { industry: null, staff: null, kinds: [], contract: null, weeklyHoliday: null, insurance: null, concern: null };
function diagnosisSteps(a) {
  const all = ["industry", "staff", "kinds", "contract", "weeklyHoliday", "insurance", "concern"];
  return a.staff === "0" ? all.filter((k) => k !== "contract" && k !== "weeklyHoliday" && k !== "insurance") : all;
}
function diagnose(a) {
  const items = [];
  if (a.staff === "0") {
    items.push({ level: "info", title: "채용 준비: 근로계약서는 근무 시작 전에 써서 줘야 해요", basis: "근로기준법 제17조", join: "→ 가입하면 채용 전 점검에서 시급·근무시간으로 인건비와 필요한 서류를 미리 계산해요" });
    items.push({ level: "info", title: "채용 준비: 최저임금(2026년 10,320원)과 주 15시간 이상이면 주휴수당", basis: "최저임금법 제6조 · 근로기준법 제55조", join: "→ 가입하면 조건을 넣는 즉시 최저임금·주휴를 확인해요" });
  }
  if (a.contract === "some" || a.contract === "none") items.push({ level: "risk", title: a.contract === "none" ? "근로계약서를 쓰지 않았어요" : "근로계약서를 일부 직원만 썼어요", basis: "근로기준법 제17조 (500만 원 이하 벌금)", join: "→ 가입하면 등록한 근무 조건으로 계약서를 채워 출력해요" });
  if (a.contract === "unknown") items.push({ level: "check", title: "근로계약서 작성 여부를 확인해 주세요", basis: "근로기준법 제17조", join: "→ 가입하면 직원별 서류 상태를 한 표로 봐요" });
  if (a.weeklyHoliday === "no") items.push({ level: "risk", title: "주 15시간 이상 직원에게 주휴수당을 주지 않고 있어요", basis: "근로기준법 제55조 · 제18조③", join: "→ 가입하면 근무 시간으로 주휴수당과 근거를 함께 계산해요" });
  if (a.weeklyHoliday === "unknown") items.push({ level: "check", title: "주휴수당 대상인지 확인이 필요해요", basis: "근로기준법 제18조③", join: "→ 가입하면 4주 평균 주 15시간 기준으로 자동 판단해요" });
  if (a.insurance === "notYet") items.push({ level: "risk", title: "4대보험을 아직 처리하지 않았어요", basis: "건강보험 14일 이내, 연금·고용·산재 다음 달 15일까지 신고", join: "→ 가입하면 직원별 신고 기한을 날짜로 알려줘요" });
  if (a.insurance === "unknown") items.push({ level: "check", title: "4대보험 처리 상태를 확인해 주세요", basis: "국민건강보험법 제8조② 등", join: "→ 가입하면 처리 방식(직접·맡김·이미 처리)을 직원별로 관리해요" });
  if (a.concern === "dismiss") items.push({ level: "risk", title: "퇴사·내보내기 고민 — 전문가 확인을 권해요", basis: "근로기준법 제26조(해고 예고), 제27조(5명 이상 서면 통지)", join: "→ 가입하면 퇴사 처리 마법사와 노무사 연결을 쓸 수 있어요" });
  if (a.kinds.includes("foreign") || a.concern === "foreign") items.push({ level: "check", title: "외국인·유학생 직원은 체류자격과 허가 시간 확인이 필요해요", basis: "출입국관리법 (원문 확인 전)", join: "→ 가입하면 체류기간 만료와 허가시간 초과를 미리 알려줘요" });
  if (a.kinds.includes("minor")) items.push({ level: "check", title: "18세 미만 직원은 친권자 동의서·가족관계증명서와 근로시간 한도가 있어요", basis: "근로기준법 제66조 · 제69조", join: "→ 가입하면 1일 7시간·주 35시간 초과와 야간·휴일 근무를 경고해요" });
  if (a.industry === "food") items.push({ level: "check", title: "음식점·카페는 보건증(매 1년)과 사장님 식품위생교육이 필요해요", basis: "식품위생법 제40조 · 제41조", join: "→ 가입하면 보건증 유효기간 30일 전부터 알려줘요" });
  if (a.staff === "5-9") items.push({ level: "check", title: "5명 이상 사업장은 연장·야간·휴일 가산, 연차, 법령 게시가 적용돼요", basis: "근로기준법 시행령 별표 1", join: "→ 가입하면 규모에 맞는 항목만 보여줘요" });
  if (a.staff === "10+") items.push({ level: "check", title: "10명 이상 사업장은 취업규칙 작성·신고가 필요해요", basis: "근로기준법 제93조", join: "→ 가입하면 규모별 서류를 자동으로 정리해요" });
  if (a.staff && a.staff !== "0") items.push({ level: "info", title: "임금명세서는 규모와 관계없이 매번 줘야 해요", basis: "근로기준법 제48조②", join: "→ 가입하면 급여 확정 후 앱으로 교부하고 수령 확인을 남겨요" });
  if (a.staff === "1-4") items.push({ level: "info", title: "1~4명 사업장은 연장·야간·휴일 가산이 적용되지 않아요 (일한 시간 임금은 지급)", basis: "근로기준법 시행령 별표 1", join: "→ 가입하면 가산이 0원인 이유를 근거와 함께 보여줘요" });
  if (a.kinds.includes("alba")) items.push({ level: "info", title: "아르바이트도 근로계약서·주휴수당·퇴직금 대상이 될 수 있어요", basis: "근로기준법 제17조 · 퇴직급여법 제4조", join: "→ 가입하면 단시간 근로계약서 양식으로 채워줘요" });
  const order = { risk: 0, check: 1, info: 2 };
  items.sort((x, y) => order[x.level] - order[y.level]);
  const showGuestConsult = items.some((i) => i.level === "risk") || a.concern === "dismiss";
  const topic = a.concern === "dismiss" ? "퇴사·내보내기" : a.concern === "allowance" ? "수당" : a.concern === "foreign" ? "외국인" : a.concern === "schedule" ? "일정·대타" : "기타";
  return { items, showGuestConsult, topic };
}
var SCHEMA_VERSION = 1;
function createEmptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    workplace: null,
    employees: [],
    conditions: [],
    overrides: [],
    attendance: [],
    attendanceEdits: [],
    substitutions: [],
    leaveRequests: [],
    payrolls: [],
    payrollEdits: [],
    statements: [],
    insuranceReports: [],
    insuranceNotices: [],
    docRecords: [],
    docRequests: [],
    customForms: [],
    deadlineActions: [],
    riskAnswers: [],
    offboarding: [],
    consults: [],
    guestConsults: [],
    reviewComments: [],
    notifications: [],
    busyDays: [],
    settings: { baseDateOverride: null, kakaoBannerDismissed: false, employeeLang: {} },
    seq: 0
  };
}
var ts = (d, hm = "09:00") => (/* @__PURE__ */ new Date(`${d}T${hm}:00+09:00`)).toISOString();
var S = (start, end, breakMin) => ({ start, end, breakMin });
function emp(p) {
  return {
    ageBand: "18-59",
    birthDate: null,
    startedBefore65: null,
    employmentType: "regular",
    contractEnd: null,
    probationEnd: null,
    foodHandler: true,
    isForeign: false,
    foreign: null,
    school: null,
    insuranceMethod: "self",
    registeredAt: p.hireDate,
    onboarding: "new",
    resignDate: null,
    resignType: null,
    account: "none",
    invite: null,
    locationConsent: null,
    conditionAcks: [],
    bonusAnnual: 0,
    leaveAllowanceAnnual: 0,
    createdAt: ts(p.hireDate),
    ...p
  };
}
function cond(p) {
  return {
    schedule: [null, null, null, null, null, null, null],
    variable: false,
    variableWeeklyHours: null,
    weeklyHolidayDay: 6,
    job: "홀 서빙·음료 제조",
    mealAllowance: 0,
    breakWaiverRequested: false,
    reason: "최초 등록",
    createdAt: ts(p.effectiveFrom),
    ...p
  };
}
function createSeed(base) {
  const s = createEmptyState();
  const created = ts(addDays(base, -75));
  s.workplace = {
    name: "카페 샘터 (가상)",
    industry: "food",
    scale: "1-4",
    familyOnly: false,
    payDay: 10,
    payMonthBasis: "previous",
    gpsEnabled: true,
    address: "부산 남구 (가상 주소)",
    radiusM: 100,
    lateToleranceMin: 5,
    defaultInsuranceMethod: "self",
    hourlyLeaveAllowed: false,
    firmInsuranceShareConsent: true,
    createdAt: created
  };
  const aHire = addDays(base, -70);
  const A = emp({ id: "emp-a", alias: "직원 A", hireDate: aHire, registeredAt: addDays(aHire, -2), probationEnd: addDays(addMonths(aHire, 3), -1), insuranceMethod: "notYet", account: "joined", locationConsent: { at: ts(aHire, "10:00"), revokedAt: null } });
  const aSched = [S("10:00", "15:00", 30), S("10:00", "15:00", 30), null, S("10:00", "15:00", 30), S("10:00", "15:00", 30), null, null];
  const A1 = cond({ id: "cond-a1", employeeId: A.id, effectiveFrom: aHire, hourlyWage: 10320, schedule: aSched });
  const A2 = cond({ id: "cond-a2", employeeId: A.id, effectiveFrom: addDays(base, 12), hourlyWage: 10500, schedule: aSched, reason: "시급 인상 (예정)", createdAt: ts(addDays(base, -3)) });
  A.conditionAcks = [{ conditionId: A1.id, status: "confirmed", memo: "", at: ts(aHire, "18:00"), resolvedAt: null }];
  const bHire = addDays(base, -200);
  const B = emp({
    id: "emp-b",
    alias: "직원 B",
    hireDate: bHire,
    registeredAt: addDays(base, -30),
    onboarding: "existing-done",
    isForeign: true,
    school: "경성대 (예시)",
    foreign: { visa: "D-2", expiry: addDays(base, 4), permitted: true, permitHours: null, otherWorkplaceHours: 0, nationality: "", checkedAt: null },
    insuranceMethod: "delegated"
  });
  const B1 = cond({ id: "cond-b1", employeeId: B.id, effectiveFrom: bHire, hourlyWage: 10320, schedule: [null, S("18:00", "22:00", 30), S("18:00", "22:00", 30), null, S("18:00", "22:00", 30), S("12:00", "18:00", 30), null], job: "주방 보조·마감" });
  const cHire = addDays(base, -45);
  const C = emp({ id: "emp-c", alias: "직원 C", hireDate: cHire, registeredAt: addDays(base, -1), onboarding: "existing-pending", employmentType: "fixed", contractEnd: addDays(base, 25), school: "부경대 (예시)" });
  const C1 = cond({ id: "cond-c1", employeeId: C.id, effectiveFrom: cHire, hourlyWage: 10320, variable: true, variableWeeklyHours: 11, weeklyHolidayDay: 2, job: "주말 홀 서빙" });
  s.employees = [A, B, C];
  s.conditions = [A1, A2, B1, C1];
  const ovs = [];
  for (const d of listDates(cHire, addDays(base, 13))) {
    const wd = weekday(d);
    if (wd === 5 || wd === 6) ovs.push({ id: `ov-c-${d}`, employeeId: C.id, date: d, kind: "extra", start: wd === 5 ? "10:00" : "11:00", end: wd === 5 ? "16:00" : "17:00", breakMin: 30, memo: "주말 근무", substitutionId: null, createdAt: ts(addDays(d, -3)) });
  }
  s.overrides = ovs;
  let seq = 0;
  const recent = listDates(addDays(base, -16), addDays(base, -1)).filter((d) => [0, 1, 3, 4].includes(weekday(d)));
  recent.forEach((d, i) => {
    seq++;
    const last = i === recent.length - 1;
    const editTarget = i === recent.length - 3;
    const clockIn = editTarget ? "10:12" : i % 3 === 0 ? "09:58" : "10:01";
    const clockOut = last ? "15:40" : "15:02";
    s.attendance.push({
      id: `att-${d}`,
      recordNo: `R-${d.replace(/-/g, "")}-${String(seq).padStart(4, "0")}`,
      employeeId: A.id,
      date: d,
      original: { clockIn, clockOut },
      source: "gps-demo",
      gps: "inside",
      status: last ? "pending" : "confirmed",
      approval: null,
      reason: last ? "예정보다 늦게 퇴근" : editTarget ? "지각(일하지 않은 시간만 빼고 계산)" : "",
      createdAt: ts(d, clockIn),
      confirmedAt: last ? null : ts(d, "20:00")
    });
    if (editTarget) {
      s.attendanceEdits.push({ id: `edit-${d}`, recordId: `att-${d}`, before: { clockIn, clockOut }, after: { clockIn: "10:00", clockOut }, reason: "출근 버튼을 늦게 누름 — 사장님이 10시 출근 확인", by: "owner", at: ts(d, "21:00"), employeeResponse: null });
    }
  });
  s.seq = seq;
  s.docRecords.push(
    { id: "doc-w3", key: "W3", itemId: "W3", employeeId: null, status: "done", doneAt: addDays(base, -100), naReason: "", expiry: null, examDate: null, location: "카운터 옆 게시판", bulk: false, updatedAt: created },
    { id: "doc-w5", key: "W5", itemId: "W5", employeeId: null, status: "done", doneAt: addDays(base, -200), naReason: "", expiry: null, examDate: null, location: "수료증 — 사무 파일", bulk: false, updatedAt: created },
    { id: "doc-e1-b", key: `E1:${B.id}:${B1.id}`, itemId: "E1", employeeId: B.id, status: "stored", doneAt: bHire, naReason: "", expiry: null, examDate: null, location: "카운터 서랍 파란 파일", bulk: true, updatedAt: created },
    { id: "doc-e3-b", key: `E3:${B.id}`, itemId: "E3", employeeId: B.id, status: "done", doneAt: bHire, naReason: "", expiry: null, examDate: null, location: "카운터 서랍 파란 파일", bulk: true, updatedAt: created },
    { id: "doc-e5-b", key: `E5:${B.id}`, itemId: "E5", employeeId: B.id, status: "done", doneAt: addDays(base, -340), naReason: "", expiry: addDays(base, 25), examDate: addDays(base, -340), location: "카운터 서랍 파란 파일", bulk: true, updatedAt: created },
    { id: "doc-e3-a", key: `E3:${A.id}`, itemId: "E3", employeeId: A.id, status: "done", doneAt: aHire, naReason: "", expiry: null, examDate: null, location: "카운터 서랍 파란 파일", bulk: false, updatedAt: created },
    { id: "doc-e5-a", key: `E5:${A.id}`, itemId: "E5", employeeId: A.id, status: "done", doneAt: addDays(aHire, -5), naReason: "", expiry: addDays(addMonths(addDays(aHire, -5), 12), 0), examDate: addDays(aHire, -5), location: "카운터 서랍 파란 파일", bulk: false, updatedAt: created }
  );
  s.docRequests.push({ id: "req-1", employeeId: B.id, itemId: "E5", customName: "보건증 (재검진)", status: "requested", requestedAt: addDays(base, -1), dueDate: addDays(base, 6), receivedAt: null, fixReason: "", expiry: null, location: "", history: [{ status: "requested", at: addDays(base, -1), memo: "문구 복사 후 사장님이 직접 전송" }] });
  s.insuranceReports.push({ employeeId: B.id, phase: "acquisition", status: "handedOver", date: addDays(base, -28), by: "owner" });
  const ans = (questionId, answer) => ({ questionId, answer, answeredAt: addDays(base, -20), scaleAtAnswer: "1-4" });
  s.riskAnswers = [ans("R1", "yes"), ans("R2", "yes"), ans("R4", "no"), ans("R5", "yes"), ans("R6", "yes"), ans("R8", "unknown")];
  s.busyDays = [{ id: "busy-1", date: addDays(base, 8), memo: "지역 축제 (예시 — 사장님 입력)" }];
  s.guestConsults = [
    { id: "guest-1", nickname: "분식집 사장님", phoneMasked: "010-****-1234", phoneKey: "", contactTime: "평일 오후 2~5시", topic: "퇴사·내보내기", summary: "1~4명 · 음식점 · 위험 2건 (계약서 일부만, 퇴사·내보내기 고민)", consents: { collect: ts(addDays(base, -2), "14:00"), provide: ts(addDays(base, -2), "14:00") }, createdAt: ts(addDays(base, -2), "14:01"), mode: "demo" }
  ];
  s.notifications = [
    { id: "n-1", to: "owner", kind: "employeeJoined", text: "직원 A 가입·근로조건 확인 완료", link: `/owner/employees/${A.id}`, createdAt: ts(aHire, "18:00"), readAt: ts(aHire, "19:00"), channels: { inApp: "delivered", kakao: "not-connected" } }
  ];
  const thisYM = base.slice(0, 7);
  for (const off of [-1, -2, -3]) {
    const ym = addMonths(`${thisYM}-01`, off).slice(0, 7);
    const per = payrollPeriodFor(s.workplace, ym);
    if (per.payDate <= base) {
      const lines = draftLines(s, ym);
      const id = ym;
      s.payrolls.push({ id, month: ym, status: "confirmed", scaleConfirmed: "1-4", manual: [], confirmedAt: ts(addDays(per.payDate, -2), "20:00"), confirmedLines: lines, confirmedWithPending: [], revision: 1 });
      for (const l of lines) {
        const e = s.employees.find((x) => x.id === l.employeeId);
        s.statements.push({ id: `st-${ym}-${e.id}`, payrollId: id, employeeId: e.id, revision: 1, method: e.account === "joined" ? "app" : "print", deliveredAt: ts(addDays(per.payDate, -2), "20:05"), viewedAt: e.account === "joined" ? ts(addDays(per.payDate, -1), "08:30") : null, disputed: null });
      }
      break;
    }
  }
  return s;
}

// supabase/functions/_shared/engine.ts
var engine = domain_exports;

// supabase/functions/_shared/http.ts
var ALLOWED_ORIGINS = /* @__PURE__ */ new Set([
  "https://ai-labor-management.github.io",
  // 사람샘각 공개 사이트 (AI-Labor-Management/saram-saemgak, OpenAI Sites)
  "https://ai-labor-service-draft-sj.gold89765.chatgpt.site",
  "http://localhost:5173",
  "http://localhost:4173"
]);
function corsHeaders(req) {
  const origin = req.headers.get("origin") ?? "";
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = ALLOWED_ORIGINS.has(origin) || extra.includes(origin);
  return {
    ...allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {},
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}
var HttpError = class extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
  status;
  detail;
};
var bad = (msg, detail) => new HttpError(400, msg, detail);
var notFound = (msg = "찾을 수 없어요") => new HttpError(404, msg);
function json(req, body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req), ...headers }
  });
}
async function readJson(req) {
  if (req.method === "GET") return {};
  try {
    const t = await req.text();
    return t ? JSON.parse(t) : {};
  } catch {
    throw bad("요청 본문이 올바른 JSON이 아니에요");
  }
}
function subPath(req, fnName) {
  const p = new URL(req.url).pathname;
  const i = p.indexOf(`/${fnName}`);
  return (i >= 0 ? p.slice(i + fnName.length + 1) : p).replace(/^\/+|\/+$/g, "");
}
function handleError(req, e) {
  if (e instanceof HttpError) return json(req, { error: e.message, detail: e.detail ?? null }, e.status);
  const pg = e;
  if (pg && typeof pg.message === "string" && pg.code) {
    const status = pg.code === "42501" ? 403 : pg.code === "23505" ? 409 : 400;
    return json(req, { error: pg.message, code: pg.code }, status);
  }
  console.error("unhandled", e);
  return json(req, { error: "서버 오류가 났어요. 잠시 후 다시 시도하세요" }, 500);
}
function str(v, name, max = 200, required = true) {
  if (v === void 0 || v === null || v === "") {
    if (required) throw bad(`${name}을(를) 입력하세요`);
    return "";
  }
  if (typeof v !== "string") throw bad(`${name} 형식이 올바르지 않아요`);
  const s = v.trim();
  if (required && !s) throw bad(`${name}을(를) 입력하세요`);
  if (s.length > max) throw bad(`${name}은(는) ${max}자 이내로 적어 주세요`);
  return s;
}
function oneOf(v, name, options) {
  if (typeof v !== "string" || !options.includes(v)) throw bad(`${name} 값이 올바르지 않아요 (${options.join(" / ")})`);
  return v;
}
function int(v, name, min = -1e12, max = 1e12) {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || Math.round(n) !== n || n < min || n > max) throw bad(`${name}은(는) ${min}~${max} 사이 정수여야 해요`);
  return n;
}

// supabase/functions/_shared/db.ts
var createClient = null;
function setCreateClient(fn) {
  createClient = fn;
}
function cc() {
  if (!createClient) throw new Error("createClient가 설정되지 않았어요 (index.ts에서 setCreateClient 호출)");
  return createClient;
}
function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys2 = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys2) {
    const parsed = JSON.parse(keys2);
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error("서비스 키 환경변수가 없어요");
}
var admin = null;
function serviceClient() {
  admin ??= cc()(Deno.env.get("SUPABASE_URL"), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return admin;
}
function kstToday() {
  return new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
}

// supabase/functions/_shared/kakao-core.ts
var KAKAO_SCOPE = "talk_message";
var KAKAO_POLICY_FROM = "2026-11-08";
var RETURN_ORIGINS = ["https://ai-labor-management.github.io", "http://localhost:5173", "http://localhost:4173", "http://localhost:4175"];
var STATE_TTL_MS = 10 * 6e4;
var b64url = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`kakao-state:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))));
}
async function readState(secret, state, now = Date.now()) {
  const [body, sig] = state.split(".");
  if (!body || !sig || await hmac(secret, body) !== sig) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!o.u || !o.r || !o.e || o.e < now) return null;
    return { userId: o.u, returnTo: o.r };
  } catch {
    return null;
  }
}
function safeReturn(v, siteUrl) {
  if (typeof v === "string") {
    try {
      const u = new URL(v);
      if (RETURN_ORIGINS.includes(u.origin)) return u.toString();
    } catch {
    }
  }
  return `${siteUrl}/owner/deadlines`;
}
function withParam(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}
var hasMessageScope = (scope) => (scope ?? "").split(/[\s,]+/).includes(KAKAO_SCOPE);
var tokenErrorCode = (error) => error === "invalid_grant" ? "TOKEN_EXPIRED" : "TOKEN_FAILED";

// supabase/functions/_shared/kakao.ts
var SITE_URL = (Deno.env.get("SITE_URL") ?? "https://ai-labor-management.github.io/saram-saemgak-site").replace(/\/$/, "");
var AUTH_HOST = "https://kauth.kakao.com";
function keys() {
  return { restKey: Deno.env.get("KAKAO_REST_KEY") ?? "", secret: Deno.env.get("KAKAO_CLIENT_SECRET") ?? "" };
}
function kakaoConfigured() {
  const k = keys();
  return !!k.restKey && !!k.secret;
}
function callbackUrl() {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/public-api/kakao/callback`;
}
var safeReturn2 = (v) => safeReturn(v, SITE_URL);
var readState2 = (state) => readState(keys().secret, state);
var KakaoError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  code;
};
async function tokenRequest(params) {
  const r = await fetch(`${AUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ client_id: keys().restKey, client_secret: keys().secret, ...params }),
    signal: AbortSignal.timeout(15e3)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new KakaoError(tokenErrorCode(j.error), `${j.error ?? r.status} ${j.error_description ?? ""}`.trim());
  return j;
}
async function connectWithCode(db, userId, code) {
  const t = await tokenRequest({ grant_type: "authorization_code", redirect_uri: callbackUrl(), code });
  if (!hasMessageScope(t.scope)) throw new KakaoError("NO_SCOPE", "카카오톡 메시지 전송에 동의하지 않았어요");
  if (!t.refresh_token) throw new KakaoError("TOKEN_FAILED", "갱신 토큰을 받지 못했어요");
  const { error } = await db.rpc("kakao_link_save", { p_user: userId, p_refresh: t.refresh_token, p_expires_in: t.refresh_token_expires_in ?? null, p_connect: true });
  if (error) throw error;
}

// supabase/functions/_shared/datagokr-core.ts
function diffHolidays(builtIn, api, year) {
  const y = String(year);
  const a = new Set(builtIn.filter((d) => d.startsWith(y)));
  const b = new Set(api.map((h) => h.date).filter((d) => d.startsWith(y)));
  return { onlyBuiltIn: [...a].filter((d) => !b.has(d)).sort(), onlyApi: [...b].filter((d) => !a.has(d)).sort() };
}

// supabase/functions/_shared/datagokr.ts
async function holidayDiff(db, years) {
  const { data } = await db.from("holidays_api").select("date, name").order("date");
  const api = data ?? [];
  const builtIn = [...engine.HOLIDAYS, ...engine.WEEKEND_HOLIDAYS].map((h) => h.date);
  return years.map((y) => ({ year: y, ...diffHolidays(builtIn, api, y) }));
}

// supabase/functions/public-api/handler.ts
var redirect = (to) => new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
async function kakaoCallback(url) {
  const fallback = safeReturn2(null);
  if (!kakaoConfigured()) return redirect(withParam(fallback, "kakao", "error"));
  const st2 = await readState2(url.searchParams.get("state") ?? "");
  if (!st2) return redirect(withParam(fallback, "kakao", "expired"));
  const back = safeReturn2(st2.returnTo);
  const err = url.searchParams.get("error");
  if (err) return redirect(withParam(back, "kakao", err === "access_denied" ? "denied" : "error"));
  const code = url.searchParams.get("code");
  if (!code || kstToday() < KAKAO_POLICY_FROM) return redirect(withParam(back, "kakao", "error"));
  try {
    await connectWithCode(serviceClient(), st2.userId, code);
    return redirect(withParam(back, "kakao", "connected"));
  } catch (e) {
    console.error("kakao callback", e instanceof Error ? e.message : e);
    return redirect(withParam(back, "kakao", e instanceof KakaoError && e.code === "NO_SCOPE" ? "noscope" : "error"));
  }
}
function precheck(body) {
  const date = body.date && engine.isISODate(body.date) ? body.date : kstToday();
  const hourlyWage = int(body.hourlyWage, "hourlyWage", 1, 1e6);
  const scale = oneOf(body.scale ?? "1-4", "scale", ["1-4", "5-9", "10+"]);
  const industry = oneOf(body.industry ?? "food", "industry", ["food", "retail", "service"]);
  const ageBand = oneOf(body.ageBand ?? "18-59", "ageBand", ["under18", "18-59", "60-64", "65+"]);
  const term = oneOf(body.contractTerm ?? "none", "contractTerm", ["lt1m", "ge1m", "none"]);
  if (!Array.isArray(body.schedule) || body.schedule.length !== 7) throw bad("schedule은 월~일 7칸 배열이어야 해요");
  const schedule = body.schedule.map((d, i) => {
    if (d === null) return null;
    const o = d;
    if (!engine.isHHMM(o.start) || !engine.isHHMM(o.end)) throw bad(`schedule[${i}] 시간 형식(HH:MM)을 확인하세요`);
    return { start: o.start, end: o.end, breakMin: int(o.breakMin ?? 0, `schedule[${i}].breakMin`, 0, 600) };
  });
  const wage = engine.quickWage({ hourlyWage, schedule, scale, date });
  const contractEnd = term === "none" ? null : term === "lt1m" ? engine.addDays(date, 20) : engine.addDays(date, 180);
  const judgments = engine.judgeInsurance({ ageBand, startedBefore65: null, employmentType: term === "none" ? "regular" : "fixed", hireDate: date, contractEnd, isForeign: body.isForeign === true, visa: null, nationality: "", weeklyHours: wage.weeklyHours, variable: false }, date);
  const rows = engine.premiums(wage.monthlyPay, date, judgments, industry, ageBand, null);
  return { date, wage, insurance: { judgments, rows, totals: engine.premiumTotals(rows) }, stored: false, note: "입력값은 저장하지 않아요. 참고용 예상 금액이에요" };
}
async function handler(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    const path = subPath(req, "public-api");
    const url = new URL(req.url);
    const m = req.method;
    if (m === "GET" && (path === "" || path === "health")) {
      return json(req, { ok: true, service: "ai-labor-service", function: "public-api", time: (/* @__PURE__ */ new Date()).toISOString(), kstToday: kstToday(), rules: { schema: engine.RULES_FILE.schema, generatedAt: engine.RULES_FILE.generatedAt, count: engine.RULES_FILE.rules.length } });
    }
    if (m === "GET" && path === "rules") {
      const date = url.searchParams.get("date");
      if (!date) return json(req, engine.RULES_FILE, 200, { "Cache-Control": "public, max-age=300" });
      if (!engine.isISODate(date)) throw bad("date는 YYYY-MM-DD 형식이어야 해요");
      return json(req, { date, basis: engine.RULES_FILE.basis, values: engine.RULES_FILE.rules.map((r) => ({ id: r.id, label: r.label, category: r.category, ...engine.resolveRule(r.id, date) })) });
    }
    if (m === "GET" && path === "faq") return json(req, engine.FAQS, 200, { "Cache-Control": "public, max-age=300" });
    if (m === "GET" && path === "checklist-items") return json(req, engine.CHECKLIST_ITEMS, 200, { "Cache-Control": "public, max-age=300" });
    if (m === "GET" && path === "holidays") {
      const db = serviceClient();
      const { data } = await db.from("holidays_api").select("date, name").order("date");
      const builtIn = new Set([...engine.HOLIDAYS, ...engine.WEEKEND_HOLIDAYS].map((h) => h.date));
      const extra = (data ?? []).filter((h) => !builtIn.has(h.date));
      const year = Number(kstToday().slice(0, 4));
      return json(req, { source: engine.HOLIDAY_SOURCE, holidays: engine.HOLIDAYS, extra, check: url.searchParams.get("check") ? await holidayDiff(db, [year, year + 1]) : void 0 }, 200, { "Cache-Control": "public, max-age=3600" });
    }
    if (m === "GET" && path === "kakao/callback") return await kakaoCallback(url);
    const body = await readJson(req);
    if (m === "POST" && path === "diagnosis") return json(req, { ...engine.diagnose(body.answers ?? body), stored: false });
    if (m === "POST" && path === "precheck") return json(req, precheck(body));
    if (m === "POST" && path === "guest-consult") {
      const { data, error } = await serviceClient().rpc("submit_guest_consult", {
        p_nickname: str(body.nickname, "호칭", 30),
        p_phone: str(body.phone, "휴대폰 번호", 20),
        p_contact_time: str(body.contactTime, "연락 편한 시간", 60),
        p_topic: str(body.topic, "상담 주제", 30, false) || "기타",
        p_summary: str(body.summary, "진단 요약", 300, false),
        p_consent_collect: body.consentCollect === true,
        p_consent_provide: body.consentProvide === true,
        p_honeypot: typeof body.website === "string" ? body.website : ""
      });
      if (error) throw error;
      return json(req, data, data?.accepted ? 201 : 200);
    }
    throw notFound(`없는 경로예요: ${m} /${path}`);
  } catch (e) {
    return handleError(req, e);
  }
}
export {
  handler,
  setCreateClient
};
