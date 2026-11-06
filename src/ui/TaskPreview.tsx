import { Link } from 'react-router';
import type { Todo, TodoArea } from '../domain/todos';
import { fmtDate } from '../domain/dates';
import { Badge, Modal } from './kit';
import { Icon } from './Icon';

const NEXT: Record<TodoArea, string> = {
  서류: '직원의 서류 상태와 교부 기록을 확인하세요. 처리한 내용은 서류 관리에서 기록할 수 있어요.',
  임금: '근무 시간과 공제 내역을 살펴본 뒤 급여와 명세서를 확인하세요.',
  '보험·퇴직금': '직원별 가입 판단과 신고 처리 상태를 확인하세요. 필요한 정보는 보험 화면에 모여 있어요.',
  기한: '원래 날짜와 현재 처리 상태를 확인하세요. 처리한 기한은 일정 관리에서 기록할 수 있어요.',
  외국인: '해당 직원의 체류기간과 확인 항목을 살펴보세요. 개별 판단이 필요한 내용은 전문가에게 확인하세요.',
  근무: '예정된 일정과 출퇴근 기록을 비교하세요. 수정한 시간과 사유를 확인한 뒤 확정하세요.',
  점검: '해당 문항과 현재 답변을 확인하세요. 상황이 달라졌다면 답변을 수정할 수 있어요.',
  직원: '직원 정보를 열어 현재 근로조건과 등록 상태를 확인하세요.',
};
export function TaskPreview({
  open,
  todo,
  employee,
  onClose,
}: {
  open: boolean;
  todo: Todo | null;
  employee?: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open && !!todo}
      onClose={onClose}
      title="업무 미리보기"
      className="task-preview-modal"
      footer={
        todo && (
          <>
            <button className="ui-button secondary" onClick={onClose}>
              목록으로
            </button>
            <Link to={todo.link} className="ui-button primary" onClick={onClose}>
              확인하러 가기 <Icon name="arrow" size={17} />
            </Link>
          </>
        )
      }
    >
      {todo && (
        <div className="task-preview-content">
          <div className="task-preview-tags">
            <Badge tone={todo.level === 'risk' ? 'risk' : todo.level === 'soon' ? 'warn' : 'info'}>
              {todo.level === 'risk' ? '우선 확인' : todo.level === 'soon' ? '기한 임박' : '확인 필요'}
            </Badge>
            <span>{todo.area}</span>
          </div>
          <h3>{todo.title}</h3>
          <dl className="task-preview-facts">
            <div>
              <dt>확인 대상</dt>
              <dd>{employee || '사업장 공통'}</dd>
            </div>
            {todo.date && (
              <div>
                <dt>기준 날짜</dt>
                <dd>{fmtDate(todo.date)}</dd>
              </div>
            )}
          </dl>
          <section>
            <h4>무엇을 확인하나요?</h4>
            <p>{NEXT[todo.area]}</p>
          </section>
          <section>
            <h4>확인 기준</h4>
            <p>{todo.basis || '등록한 사업장과 직원 정보에 따른 확인 항목이에요.'}</p>
          </section>
          <p className="task-preview-note">
            <Icon name="file" size={16} />
            처리는 해당 관리 화면에서 진행해요. 이 창을 열어도 업무 상태는 바뀌지 않아요.
          </p>
        </div>
      )}
    </Modal>
  );
}
