import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Route, Routes } from 'react-router';
import { StoreProvider } from './state/store';
import { ToastProvider } from './ui/kit';
import { PreferencesProvider } from './ui/preferences';
import { Guide } from './ui/Guide';
import { LoadGate, OwnerLayout, RoleLayout, SERVICE_NAME } from './ui/layouts';
const Landing = lazy(() => import('./pages/public/Landing'));
const Start = lazy(() => import('./pages/public/Start'));
const Invite = lazy(() => import('./pages/public/Invite'));
const OwnerHome = lazy(() => import('./pages/owner/Home'));
const Setup = lazy(() => import('./pages/owner/Setup'));
const Precheck = lazy(() => import('./pages/owner/Precheck'));
const Employees = lazy(() => import('./pages/owner/Employees'));
const EmployeeForm = lazy(() => import('./pages/owner/EmployeeForm'));
const EmployeeDetail = lazy(() => import('./pages/owner/EmployeeDetail'));
const Onboarding = lazy(() => import('./pages/owner/Onboarding'));
const Work = lazy(() => import('./pages/owner/Work'));
const Payroll = lazy(() => import('./pages/owner/Payroll'));
const Insurance = lazy(() => import('./pages/owner/Insurance'));
const Documents = lazy(() => import('./pages/owner/Documents'));
const DocMaker = lazy(() => import('./pages/owner/DocMaker'));
const Deadlines = lazy(() => import('./pages/owner/Deadlines'));
const Risk = lazy(() => import('./pages/owner/Risk'));
const Consult = lazy(() => import('./pages/owner/Consult'));
const Offboarding = lazy(() => import('./pages/owner/Offboarding'));
const Settings = lazy(() => import('./pages/owner/Settings'));
const More = lazy(() => import('./pages/owner/More'));
const Rules = lazy(() => import('./pages/owner/Rules'));
const StatementPage = lazy(() => import('./pages/owner/StatementPage'));
const EmpHome = lazy(() =>
  import('./pages/employee/EmployeePages').then((module) => ({ default: module.EmpHome })),
);
const EmpSchedule = lazy(() =>
  import('./pages/employee/EmployeePages').then((module) => ({ default: module.EmpSchedule })),
);
const EmpPay = lazy(() =>
  import('./pages/employee/EmployeePages').then((module) => ({ default: module.EmpPay })),
);
const EmpLeave = lazy(() =>
  import('./pages/employee/EmployeePages').then((module) => ({ default: module.EmpLeave })),
);
const EmpSettings = lazy(() =>
  import('./pages/employee/EmployeePages').then((module) => ({ default: module.EmpSettings })),
);
const EmpJoin = lazy(() =>
  import('./pages/employee/EmployeePages').then((module) => ({ default: module.EmpJoin })),
);
const EmployeeTitle = lazy(() =>
  import('./pages/employee/EmployeePages').then((module) => ({ default: module.EmployeeTitle })),
);
const Firm = lazy(() => import('./pages/firm/Firm'));
const Admin = lazy(() => import('./pages/admin/Admin'));
import { AppBoundary } from './ui/AppBoundary';

function ApplicationRoutes() {
  return (
    <LoadGate>
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            화면을 준비하고 있어요…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/start" element={<Start />} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/login" element={<Navigate to="/start" replace />} />
          <Route path="/signup" element={<Navigate to="/start?mode=signup" replace />} />
          <Route path="/owner" element={<OwnerLayout />}>
            <Route index element={<OwnerHome />} />
            <Route path="setup" element={<Setup />} />
            <Route path="precheck" element={<Precheck />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/new" element={<EmployeeForm />} />
            <Route path="employees/:id" element={<EmployeeDetail />} />
            <Route path="employees/:id/onboarding" element={<Onboarding />} />
            <Route path="work" element={<Work />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="payroll/statement/:month/:empId" element={<StatementPage />} />
            <Route path="insurance" element={<Insurance />} />
            <Route path="documents" element={<Documents />} />
            <Route path="documents/make/:kind/:empId" element={<DocMaker />} />
            <Route path="deadlines" element={<Deadlines />} />
            <Route path="risk" element={<Risk />} />
            <Route path="consult" element={<Consult />} />
            <Route path="offboarding/:id" element={<Offboarding />} />
            <Route path="settings" element={<Settings />} />
            <Route path="rules" element={<Rules />} />
            <Route path="more" element={<More />} />
          </Route>
          <Route
            path="/employee"
            element={
              <RoleLayout
                role="employee"
                title={<EmployeeTitle />}
                tabs={[
                  { to: '/employee', label: '홈', end: true },
                  { to: '/employee/schedule', label: '일정' },
                  { to: '/employee/pay', label: '급여' },
                  { to: '/employee/leave', label: '연차' },
                  { to: '/employee/settings', label: '설정' },
                ]}
              />
            }
          >
            <Route index element={<EmpHome />} />
            <Route path="join" element={<EmpJoin />} />
            <Route path="schedule" element={<EmpSchedule />} />
            <Route path="pay" element={<EmpPay />} />
            <Route path="leave" element={<EmpLeave />} />
            <Route path="settings" element={<EmpSettings />} />
          </Route>
          <Route
            path="/firm"
            element={
              <RoleLayout
                role="firm"
                title={<p className="font-bold">협력 노무법인 (협약 후 표시) · 상담 요청함</p>}
              />
            }
          >
            <Route index element={<Firm />} />
          </Route>
          <Route
            path="/admin"
            element={
              <RoleLayout
                role="admin"
                title={<p className="font-bold">{SERVICE_NAME} · 관리자 (조회 전용)</p>}
              />
            }
          >
            <Route index element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Guide />
    </LoadGate>
  );
}
const router = createBrowserRouter([{ path: '*', element: <ApplicationRoutes /> }]);
if (import.meta.hot) import.meta.hot.dispose(() => router.dispose());
export default function App() {
  return (
    <AppBoundary>
      <PreferencesProvider>
        <StoreProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </StoreProvider>
      </PreferencesProvider>
    </AppBoundary>
  );
}
