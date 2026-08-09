import { useEffect, useState } from 'react';
import { Download, X, FileSearch, ExternalLink, MessageSquare } from 'lucide-react';
import { client } from '../lib/api';
import { ApiError } from '../lib/api';
import { extOf, formatBytes, formatDateTime, groupOf, textFromUrl } from '../lib/format';
import { FileIcon } from './FileIcon';
import { Spinner } from './ui';
import { CommentSection } from './CommentSection';
import type { DocumentItem } from '../types';

export function DocumentPreviewModal({
  document,
  onClose
}: {
  document: DocumentItem | null;
  onClose: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  useEffect(() => {
    if (!document) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setTextContent(null);
    setSignedUrl(null);
    setCommentsOpen(false);
    setCommentCount(null);

    client
      .get<{ signedUrl: string; fileName: string }>(`/documents/${document.id}/preview`)
      .then(async (json) => {
        if (!alive) return;
        setSignedUrl(json.signedUrl);
        const ext = extOf(json.fileName);
        if (ext === 'csv' || ext === 'txt') {
          const text = await textFromUrl(json.signedUrl);
          if (alive) setTextContent(text.slice(0, 20000));
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof ApiError ? err.message : 'Unable to load preview.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    client
      .get<{ items: unknown[] }>(`/documents/${document.id}/comments`)
      .then((json) => {
        if (alive) setCommentCount(json.items?.length ?? 0);
      })
      .catch(() => {
        if (alive) setCommentCount(0);
      });
    return () => {
      alive = false;
    };
  }, [document?.id]);

  if (!document) return null;

  const ext = extOf(document.file_name);
  const group = groupOf(document.file_type);
  const officeGroups = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

  function downloadUrl() {
    if (!signedUrl || !document) return;
    const a = window.document.createElement('a');
    a.href = signedUrl;
    a.download = document.file_name;
    a.rel = 'noopener noreferrer';
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileIcon file={document.file_type} />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900">{document.title}</h3>
              <p className="truncate text-xs text-slate-500">
                {document.file_name} · v{document.version} · {formatBytes(document.file_size)} ·{' '}
                {formatDateTime(document.updated_at)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {signedUrl && (
              <button type="button" className="btn-primary !px-3 !py-1.5 text-xs" onClick={downloadUrl}>
                <Download className="h-4 w-4" /> Download
              </button>
            )}
            <button
              type="button"
              onClick={() => setCommentsOpen((open) => !open)}
              className={`relative rounded-lg p-1.5 hover:bg-slate-100 ${
                commentsOpen ? 'bg-brand-50 text-brand-600' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Comments"
            >
              <MessageSquare className="h-5 w-5" />
              {typeof commentCount === 'number' && commentCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                  {commentCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex-1 overflow-auto bg-slate-100">
            {loading && <Spinner label="Preparing preview…" />}
            {!loading && error && <div className="p-8 text-center text-sm font-medium text-red-600">{error}</div>}
            {!loading && !error && signedUrl && (
              <>
                {ext === 'pdf' && <iframe src={signedUrl} title={document.title} className="h-full w-full" />}
                {['jpg', 'jpeg', 'png'].includes(ext) && (
                  <div className="flex h-full items-center justify-center p-4">
                    <img src={signedUrl} alt={document.title} className="max-h-full max-w-full rounded-lg shadow" />
                  </div>
                )}
                {['csv', 'txt'].includes(ext) && (
                  <pre className="whitespace-pre-wrap p-6 font-mono text-xs text-slate-700">
                    {textContent ?? 'No content.'}
                  </pre>
                )}
                {officeGroups.includes(ext) && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                    <FileSearch className="h-10 w-10 text-slate-400" />
                    <p className="max-w-md text-sm text-slate-600">
                      {group === 'word'
                        ? 'Word'
                        : group === 'excel'
                          ? 'Excel'
                          : 'PowerPoint'}{' '}
                      files are not previewable online in this deployment. Use the secure download button to open the
                      original file.
                    </p>
                    <button type="button" className="btn-primary" onClick={downloadUrl}>
                      <Download className="h-4 w-4" /> Download securely
                    </button>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Signed, time-limited link - expires after 15 minutes
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {commentsOpen && (
            <div className="w-80 shrink-0 border-l border-slate-200 bg-white">
              <CommentSection
                documentId={document.id}
                onCountChange={setCommentCount}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}