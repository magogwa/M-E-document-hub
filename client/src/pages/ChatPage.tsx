import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, Plus, Send, X } from 'lucide-react';
import { client } from '../lib/api';
import { ApiError, useAuth } from '../lib/auth';
import { useData } from '../hooks/useData';
import { formatDateTime, timeAgo } from '../lib/format';
import { AppShell } from '../components/layout/AppShell';
import { Badge, EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import type { ChatContact, ChatConversation, ChatMessage, Role } from '../types';

const POLL_MS = 5000;

export function ChatPage({ role }: { role: Role }) {
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const {
    data: conversations,
    loading: conversationsLoading,
    error: conversationsError,
    reload: reloadConversations
  } = useData<{ items: ChatConversation[] }>(() => client.get('/chat/conversations'), []);

  const {
    data: messagesData,
    loading: messagesLoading,
    error: messagesError,
    reload: reloadMessages
  } = useData<{ items: ChatMessage[]; conversation: { id: string; counterpart: ChatConversation['counterpart'] | null } }>(
    () => (activeId ? client.get(`/chat/conversations/${activeId}/messages`) : Promise.reject(new Error('no conversation'))),
    [activeId]
  );
  const messages = messagesData?.items ?? [];

  const { data: contacts, reload: reloadContacts } = useData<{ contacts: ChatContact[] }>(
    () => client.get('/chat/contacts'),
    []
  );

  useEffect(() => {
    const timer = setInterval(() => {
      reloadConversations();
      if (activeId) reloadMessages();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, reloadConversations, reloadMessages]);

  useEffect(() => {
    const items = conversations?.items ?? [];
    if (!activeId && items.length > 0) {
      setActiveId(items[0].id);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    const container = document.getElementById('chat-scroll');
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  const activeConversation = (conversations?.items ?? []).find((c) => c.id === activeId) ?? null;

  async function handleStartChat(contact: ChatContact) {
    setStarting(contact.id);
    try {
      const json = await client.post<{ conversation: { id: string } }>('/chat/conversations', { userId: contact.id });
      setActiveId(json.conversation.id);
      setNewChatOpen(false);
      reloadConversations();
      reloadMessages();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the chat.');
    } finally {
      setStarting(null);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeId || !input.trim()) return;
    setSending(true);
    try {
      await client.post(`/chat/conversations/${activeId}/messages`, { content: input.trim() });
      setInput('');
      reloadMessages();
      reloadConversations();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  }

  const me = user?.id;

  return (
    <AppShell role={role}>
      <PageHeader
        title="Chat"
        subtitle="Message the administrator or other members directly."
        actions={
          <button type="button" className="btn-primary" onClick={() => { setNewChatOpen(true); reloadContacts(); }}>
            <Plus className="h-4 w-4" /> New chat
          </button>
        }
      />

      <div className="flex h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <aside className="w-full shrink-0 overflow-y-auto border-r border-slate-200 sm:w-64 md:w-72">
          {conversationsLoading && <Spinner label="Loading chats…" />}
          {!conversationsLoading && conversationsError && <ErrorState message={conversationsError} onRetry={reloadConversations} />}
          {!conversationsLoading && !conversationsError && (conversations?.items.length ?? 0) === 0 && (
            <EmptyState title="No chats yet" description="Start a chat with the administrator or another member." />
          )}
          {(conversations?.items ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                activeId === c.id ? 'bg-brand-50/60' : ''
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {(c.counterpart?.full_name ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{c.counterpart?.full_name ?? 'Unknown'}</p>
                  {c.last_message && <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(c.last_message.created_at)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-slate-500">{c.last_message ? c.last_message.content : 'Say hello…'}</p>
                  {c.unread > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState title="Select a conversation" description="Choose a chat on the left or start a new one." />
            </div>
          ) : messagesLoading ? (
            <Spinner label="Loading messages…" />
          ) : messagesError ? (
            <ErrorState message={messagesError} onRetry={reloadMessages} />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {(messagesData?.conversation?.counterpart?.full_name ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {messagesData?.conversation?.counterpart?.full_name ?? 'Unknown'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {messagesData?.conversation?.counterpart?.role === 'admin' ? 'Administrator' : 'Member'}
                  </p>
                </div>
              </div>

              <div id="chat-scroll" className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {messages.length === 0 && <EmptyState title="No messages yet" description="Say hello to start the conversation." />}
                {messages.map((m) => {
                  const mine = m.sender_id === me;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                          mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                        }`}
                        title={formatDateTime(m.created_at)}
                      >
                        {!mine && (
                          <p className="mb-0.5 text-[11px] font-semibold text-brand-600">{m.sender?.full_name ?? 'User'}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`mt-1 text-right text-[10px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                          {timeAgo(m.created_at)}
                          {mine && m.read_at && <span className="ml-1.5">Seen</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-slate-200 p-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={4000}
                  placeholder={`Message ${activeConversation?.counterpart?.full_name ?? ''}…`}
                  className="input flex-1"
                />
                <button type="submit" disabled={sending || !input.trim()} className="btn-primary !px-3" title="Send">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      <Modal open={newChatOpen} onClose={() => setNewChatOpen(false)} title="Start a new chat" size="md">
        {!contacts && <Spinner label="Loading contacts…" />}
        {(contacts?.contacts.length ?? 0) === 0 && (
          <EmptyState
            title="No contacts available"
            description="There are no other active users to chat with right now."
            action={
              <button type="button" className="btn-secondary" onClick={() => { setNewChatOpen(false); }}>
                <X className="h-4 w-4" /> Close
              </button>
            }
          />
        )}
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {(contacts?.contacts ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={starting === c.id}
                onClick={() => handleStartChat(c)}
                className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {c.full_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.full_name}</p>
                  <p className="truncate text-xs text-slate-500">{c.email}</p>
                </div>
                {c.role === 'admin' ? <Badge tone="blue">Admin</Badge> : <Badge>Member</Badge>}
                <MessageSquare className="h-4 w-4 shrink-0 text-brand-500" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </AppShell>
  );
}