import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { StoreProvider } from './state/store';
import { ToastProvider } from './ui/kit';
import { LoadGate, OwnerLayout, RoleLayout, SERVICE_NAME } from './ui/layouts';
import Landing from './pages/public/Landing';
import Start from './pages/public/Start';
import OwnerHome from './pages/owner/Home';
import Setup from './pages/owner/Setup';
import Precheck from './pages/owner/Precheck';
import Employees from './pages/owner/Employees';
import EmployeeForm from './pages/owner/EmployeeForm';
import EmployeeDetail from './pages/owner/EmployeeDetail';
import Onboarding from './pages/owner/Onboarding';
import Work from './pages/owner/Work';
import Payroll from './pages/owner/Payroll';
import Insurance from './pages/owner/Insurance';
import Documents from './pages/owner/Documents';
import DocMaker from './pages/owner/DocMaker';
import Deadlines from './pages/owner/Deadlines';
import Risk from './pages/owner/Risk';
import Consult from './pages/owner/Consult';
import Offboarding from './pages/owner/Offboarding';
import Settings from './pages/owner/Settings';
import More from './pages/owner/More';
import Rules from './pages/owner/Rules';
import StatementPage from './pages/owner/StatementPage';
import { EmpHome, EmpSchedule, EmpPay, EmpLeave, EmpSettings, EmpJoin, EmployeeTitle } from './pages/employee/EmployeePages';
import Firm from './pages/firm/Firm';
import Admin from './pages/admin/Admin';

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <BrowserRouter>
          <LoadGate>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/start" element={<Start />} />
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
              <Route path="/firm" element={<RoleLayout role="firm" title={<p className="font-bold">협력 노무법인 (협약 후 표시) · 상담 요청함</p>} />}>
                <Route index element={<Firm />} />
              </Route>
              <Route path="/admin" element={<RoleLayout role="admin" title={<p className="font-bold">{SERVICE_NAME} · 관리자 (조회 전용)</p>} />}>
                <Route index element={<Admin />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </LoadGate>
        </BrowserRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
