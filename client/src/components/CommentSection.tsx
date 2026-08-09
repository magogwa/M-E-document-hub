import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { client } from '../lib/api';
import { ApiError } from '../lib/auth';
import { useData } from '../hooks/useData';
import { timeAgo } from '../lib/format';
import { useAuth } from '../lib/auth';
import { Badge, EmptyState, ErrorState, Spinner } from './ui';
import type { DocumentComment } from '../types';

export function CommentSection({ documentId, onCountChange }: { documentId: string; onCountChange?: (count: number) => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, loading, error, reload } = useData<{ items: DocumentComment[] }>(
    () => client.get(`/documents/${documentId}/comments`),
    [documentId]
  );
  const comments = data?.items ?? [];

  useEffect(() => {
    if (!loading) onCountChange?.(comments.length);
  }, [comments.length, loading, onCountChange]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await client.post(`/documents/${documentId}/comments`, { content: trimmed });
      setContent('');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not post the comment.');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(comment: DocumentComment) {
    setDeletingId(comment.id);
    try {
      await client.delete(`/documents/${documentId}/comments/${comment.id}`);
      toast.success('Comment deleted.');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the comment.');
    } finally {
      setDeletingId(null);
    }
  }

  const canDelete = (comment: DocumentComment) => user?.role === 'admin' || comment.user_id === user?.id;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900">Comments ({comments.length})</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {loading && <Spinner label="Loading comments…" />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && comments.length === 0 && (
          <EmptyState title="No comments yet" description="Start the discussion about this document." />
        )}
        {!loading && !error &&
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-xs font-semibold text-slate-800">{c.author?.full_name ?? 'User'}</p>
                  {c.author?.role === 'admin' && <Badge tone="blue">Admin</Badge>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-[11px] text-slate-400">{timeAgo(c.created_at)}</span>
                  {canDelete(c) && (
                    <button
                      type="button"
                      title="Delete comment"
                      disabled={deletingId === c.id}
                      onClick={() => handleDelete(c)}
                      className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{c.content}</p>
            </div>
          ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Write a comment about this document…"
            className="input flex-1 resize-none"
          />
          <button type="submit" disabled={sending || !content.trim()} className="btn-primary !px-3" title="Post comment">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}