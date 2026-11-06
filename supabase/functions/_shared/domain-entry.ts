// Edge Function용 계산 엔진 진입점. scripts/build-functions.mjs가 이 파일을 묶어 domain.js를 만든다.
// 프론트엔드와 같은 src/domain 코드(테스트 66개 통과)를 그대로 쓰며, 서버에서 따로 다시 구현하지 않는다.
export { RULES_FILE, resolveRule, allRules, STATUS_LABEL } from '../../../src/domain/rules';
export { addDays, addMonthsYM, diffDays, fmtMD, isHHMM, isISODate, monthOf, weekday } from '../../../src/domain/dates';
export { classifyClock, conditionAt, currentTimes, dayPlan, weeklyHours, isUnder5 } from '../../../src/domain/work';
export { computePayrollLine, quickWage, checkMinimumWage, dailyWorkerIncomeTax } from '../../../src/domain/wage';
export { draftLines, payrollLines, payrollPeriodFor, pendingAttendanceIn } from '../../../src/domain/payroll';
export { employeeInsurance, judgeInsurance, premiums, premiumTotals, INSURANCE_LABEL, VERDICT_LABEL } from '../../../src/domain/insurance';
export { estimateSeverance, severanceAmount } from '../../../src/domain/severance';
export { leaveAccrual } from '../../../src/domain/leave';
export { computeDeadlines, alertDates, TYPE_LABEL } from '../../../src/domain/deadlines';
export { buildIcs } from '../../../src/domain/ics';
export { computeChecklist } from '../../../src/domain/checklist';
export { computeTodos, areaCounts } from '../../../src/domain/todos';
export { evaluateRisk, RISK_QUESTIONS } from '../../../src/domain/risk';
export { foreignSignal } from '../../../src/domain/foreign';
export { buildMemo, detectPII, searchFaq } from '../../../src/domain/consult';
export { diagnose, diagnosisSteps, EMPTY_DIAG } from '../../../src/domain/diagnosis';
export { createSeed, createEmptyState } from '../../../src/data/seed';
export { FAQS } from '../../../src/data/faq';
export { CHECKLIST_ITEMS } from '../../../src/data/checklistItems';
export { HOLIDAYS, HOLIDAY_SOURCE } from '../../../src/data/holidays';
