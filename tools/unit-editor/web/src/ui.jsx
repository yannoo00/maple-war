import { useRef, useState } from 'react';
import { useResource } from './api.js';

export function Badge({ type, children }) {
  return <span className={`badge b-${type}`}>{children}</span>;
}

export function Thumb({ ruid }) {
  const r = useResource(ruid);
  const ok = r && r.ok && r.thumbnail;
  return <img className="thumb" src={ok ? r.thumbnail : undefined} title={ok ? `${r.name} (${r.type})` : undefined} alt="" />;
}

// 검사/저장 결과(errors, warnings, 저장 완료 문구)
export function Messages({ result }) {
  if (!result) return <div className="msgs" />;
  const { errors = [], warnings = [], ok, savedText } = result;
  return (
    <div className="msgs">
      {errors.map((e, i) => <div key={'e' + i} className="msg err">{e}</div>)}
      {warnings.map((w, i) => <div key={'w' + i} className="msg warn">{w}</div>)}
      {ok && savedText && <div className="msg ok">{savedText}</div>}
      {ok && !savedText && !errors.length && !warnings.length && <div className="msg ok">문제 없음</div>}
    </div>
  );
}

// ask('질문') → Promise<boolean>. 반환된 dialog 를 화면 어딘가에 렌더링한다.
export function useConfirm() {
  const [pending, setPending] = useState(null);
  const ref = useRef(null);
  const ask = (text) => new Promise((resolve) => {
    setPending({ text, resolve });
    setTimeout(() => ref.current?.showModal());
  });
  const answer = (v) => { ref.current.close(); pending?.resolve(v); setPending(null); };
  const dialog = (
    <dialog ref={ref} onCancel={() => answer(false)}>
      <p>{pending?.text}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => answer(false)}>취소</button>
        <button className="primary" onClick={() => answer(true)}>확인</button>
      </div>
    </dialog>
  );
  return { ask, dialog };
}
