import { useEffect, type RefObject } from 'react';
import { useBlocker } from 'react-router';
import { Button, Modal } from './kit';
import { registerUnsavedForm } from './unsavedRegistry';

export function UnsavedChanges({ when, bypass }: { when: boolean; bypass: RefObject<boolean> }) {
  useEffect(
    () =>
      registerUnsavedForm(
        () => when && !bypass.current,
        () => {
          bypass.current = true;
        },
      ),
    [when, bypass],
  );
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && !bypass.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!when) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!bypass.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [when, bypass]);
  const stay = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };
  return (
    <Modal
      open={blocker.state === 'blocked'}
      onClose={stay}
      title="입력 중인 내용이 있어요"
      footer={
        <>
          <Button onClick={stay}>계속 작성</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            저장하지 않고 나가기
          </Button>
        </>
      }
    >
      <p className="text-sm">이 화면을 나가면 아직 저장하지 않은 입력이 사라져요.</p>
    </Modal>
  );
}
