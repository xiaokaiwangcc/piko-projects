import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createNote, deleteNote, listNotes, type Note } from './api';
import { charCount, formatTime, MAX_LENGTH } from './format';

type LoadState = 'loading' | 'ready' | 'error';

interface Notice {
  kind: 'error' | 'success';
  text: string;
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '操作失败，请稍后重试';
}

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);

  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadSeq = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoadState('loading');
    setLoadError('');

    try {
      const data = await listNotes();
      if (seq !== loadSeq.current) return;
      setNotes(data.items);
      setLoadState('ready');
    } catch (error) {
      if (seq !== loadSeq.current) return;
      setLoadError(errorText(error));
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      loadSeq.current += 1;
    };
  }, [load]);

  const trimmed = content.trim();
  const count = charCount(content);
  const tooLong = count > MAX_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError('');
    setNotice(null);

    try {
      const data = await createNote(trimmed);
      setNotes((current) => [data.item, ...current]);
      setContent('');
      setNotice({ kind: 'success', text: '留言已发布' });
      textareaRef.current?.focus();
    } catch (error) {
      setSubmitError(errorText(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(note: Note) {
    if (deletingIds.includes(note.id)) return;
    if (!window.confirm('确定删除这条留言吗？删除后不可恢复。')) return;

    setNotice(null);
    setDeletingIds((current) => [...current, note.id]);

    try {
      await deleteNote(note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
      setNotice({ kind: 'success', text: '留言已删除' });
    } catch (error) {
      setNotice({ kind: 'error', text: `删除失败：${errorText(error)}` });
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== note.id));
    }
  }

  return (
    <div className="page">
      <header className="masthead">
        <p className="eyebrow">公开留言 · 所有人可见</p>
        <h1>留言板</h1>
        <p className="lede">想说什么，写在下面就好。</p>
        <a className="haidou-entry" href="./haidou.html">
          海斗助手 · 英雄装备与胜率榜 →
        </a>
      </header>

      <main>
        <section className="composer" aria-labelledby="composer-title">
          <h2 id="composer-title" className="section-title">
            写一条留言
          </h2>
          <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="note-content">
              留言内容
            </label>
            <textarea
              ref={textareaRef}
              id="note-content"
              className={tooLong ? 'textarea textarea--invalid' : 'textarea'}
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                if (submitError) setSubmitError('');
              }}
              placeholder="写下你的想法…"
              rows={4}
              aria-invalid={tooLong}
              aria-describedby="note-meta note-error"
            />

            <div className="composer-foot">
              <p
                id="note-meta"
                className={tooLong ? 'counter counter--over' : 'counter'}
                aria-live="polite"
              >
                <span aria-hidden="true">
                  {count} / {MAX_LENGTH}
                </span>
                <span className="sr-only">
                  已输入 {count} 字，上限 {MAX_LENGTH} 字
                </span>
                {tooLong ? ' · 超出上限' : ''}
              </p>
              <button type="submit" className="button button--primary" disabled={!canSubmit}>
                {submitting ? '发布中…' : '发布留言'}
              </button>
            </div>

            {submitError && (
              <p id="note-error" className="inline-error" role="alert">
                {submitError}，内容已保留，可直接重试。
              </p>
            )}
          </form>
        </section>

        {notice && (
          <p
            className={notice.kind === 'error' ? 'notice notice--error' : 'notice notice--success'}
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            <span>{notice.text}</span>
            <button type="button" className="notice-close" onClick={() => setNotice(null)}>
              关闭
            </button>
          </p>
        )}

        <section className="board" aria-labelledby="board-title">
          <div className="board-head">
            <h2 id="board-title" className="section-title">
              留言
            </h2>
            {loadState === 'ready' && <span className="count-badge">共 {notes.length} 条</span>}
          </div>

          {loadState === 'loading' && (
            <>
              <p className="sr-only" role="status">
                正在加载留言
              </p>
              <div className="skeleton-list" aria-busy="true" aria-hidden="true">
                {[0, 1, 2].map((key) => (
                  <div className="skeleton-row" key={key}>
                    <div className="skeleton-line skeleton-line--wide" />
                    <div className="skeleton-line skeleton-line--short" />
                  </div>
                ))}
              </div>
            </>
          )}

          {loadState === 'error' && (
            <div className="state-panel" role="alert">
              <p className="state-title">留言加载失败</p>
              <p className="state-text">{loadError}</p>
              <button type="button" className="button button--secondary" onClick={() => void load()}>
                重试
              </button>
            </div>
          )}

          {loadState === 'ready' && notes.length === 0 && (
            <div className="state-panel state-panel--empty">
              <p className="state-title">还没有留言</p>
              <p className="state-text">来做第一个留言的人吧。</p>
            </div>
          )}

          {loadState === 'ready' && notes.length > 0 && (
            <ul className="note-list">
              {notes.map((note) => {
                const deleting = deletingIds.includes(note.id);
                return (
                  <li className="note" key={note.id}>
                    <p className="note-content">{note.content}</p>
                    <div className="note-meta">
                      <time dateTime={note.created_at}>{formatTime(note.created_at)}</time>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void handleDelete(note)}
                        disabled={deleting}
                      >
                        {deleting ? '删除中…' : '删除'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="foot">留言会公开显示，请勿填写隐私信息。</footer>
    </div>
  );
}
