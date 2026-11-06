import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Render errors must leave a recovery path; never discard stored work automatically. */
export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* No HR data or user input is sent to telemetry. */
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="recovery-page">
        <p className="text-sm font-semibold text-brand">사람샘각</p>
        <h1>화면을 불러오지 못했어요</h1>
        <p>저장된 데이터는 그대로 있어요. 다시 열어 보거나 시작 화면으로 돌아가 주세요.</p>
        <div>
          <button className="ui-button primary" onClick={() => window.location.reload()}>
            다시 열기
          </button>
          <a className="ui-button secondary" href="/start">
            시작 화면
          </a>
        </div>
      </main>
    );
  }
}
