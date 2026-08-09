import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import type { ConversationRow, UserProfile } from '../types.js';

export const chatRouter = Router();

const createConversationSchema = z.object({
  userId: z.string().uuid()
});

const messageSchema = z.object({
  content: z.string().min(1).max(4000).trim()
});

function ipOf(req: AuthRequest): string | null {
  const f = req.headers['x-forwarded-for'];
  return (Array.isArray(f) ? f[0] : f) ?? req.socket?.remoteAddress ?? null;
}

function param(req: AuthRequest, key: string): string {
  const value = req.params[key];
  return typeof value === 'string' ? value : '';
}

function participantsOf(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function findConversation(a: string, b: string): Promise<ConversationRow | null> {
  const [pa, pb] = participantsOf(a, b);
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_a', pa)
    .eq('participant_b', pb)
    .maybeSingle();
  if (error) throw error;
  return (data as ConversationRow | null) ?? null;
}

async function assertActiveUser(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone, role, status, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) throw AppError.notFound('User not found.');
  const profile = data as UserProfile;
  if (profile.status !== 'active') throw AppError.badRequest('You can only chat with active users.');
  return profile;
}

async function participantIdsOf(conversationId: string): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  if (error || !data) throw AppError.notFound('Conversation not found.');
  return data as ConversationRow;
}

async function profileMap(userIds: string[]): Promise<Map<string, { full_name: string; email: string; role: string }>> {
  const { data, error } = userIds.length
    ? await supabase.from('users').select('id, full_name, email, role').in('id', userIds)
    : { data: [] };
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.id, u]));
}

// ============================================================================
// GET /api/chat/contacts - every active user the caller can start a chat with
// ============================================================================
chatRouter.get(
  '/contacts',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const me = req.user as UserProfile;
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('status', 'active')
      .neq('id', me.id)
      .order('full_name')
      .limit(500);
    if (error) throw error;
    res.json({ contacts: data ?? [] });
  })
);

// ============================================================================
// GET /api/chat/conversations - my conversations with counterpart + unread counts
// ============================================================================
chatRouter.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const me = req.user as UserProfile;
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${me.id},participant_b.eq.${me.id}`)
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = data as ConversationRow[];
    if (rows.length === 0) return res.json({ items: [] });

    const counterpartIds = rows.map((c) => (c.participant_a === me.id ? c.participant_b : c.participant_a));
    const profiles = await profileMap(counterpartIds);
    const conversationIds = rows.map((c) => c.id);

    const [{ data: messages }, { data: unreadRows }] = await Promise.all([
      supabase.from('chat_messages').select('id, conversation_id, sender_id, content, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('chat_messages').select('conversation_id, sender_id').in('conversation_id', conversationIds).neq('sender_id', me.id).is('read_at', null)
    ]);

    const lastByConversation = new Map<string, { content: string; created_at: string; sender_id: string }>();
    for (const m of messages ?? []) {
      if (!lastByConversation.has(m.conversation_id)) {
        lastByConversation.set(m.conversation_id, {
          content: m.content,
          created_at: m.created_at,
          sender_id: m.sender_id
        });
      }
    }
    const unreadCounts = new Map<string, number>();
    for (const row of unreadRows ?? []) {
      unreadCounts.set(row.conversation_id, (unreadCounts.get(row.conversation_id) ?? 0) + 1);
    }

    const items = rows.map((c) => {
      const counterpartId = c.participant_a === me.id ? c.participant_b : c.participant_a;
      const counterpart = profiles.get(counterpartId);
      return {
        id: c.id,
        counterpart: counterpart ? { id: counterpartId, full_name: counterpart.full_name, email: counterpart.email, role: counterpart.role } : { id: counterpartId, full_name: 'User', email: '', role: 'client' },
        last_message: lastByConversation.get(c.id) ?? null,
        unread: unreadCounts.get(c.id) ?? 0,
        last_message_at: c.last_message_at
      };
    });
    res.json({ items });
  })
);

// ============================================================================
// POST /api/chat/conversations - start (or resume) a chat with another user
// ============================================================================
chatRouter.post(
  '/conversations',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const me = req.user as UserProfile;
    const { userId } = createConversationSchema.parse(req.body ?? {});
    if (userId === me.id) throw AppError.badRequest('You cannot start a chat with yourself.');
    await assertActiveUser(userId);

    let conversation = await findConversation(me.id, userId);
    if (!conversation) {
      const [pa, pb] = participantsOf(me.id, userId);
      const { data, error } = await supabase
        .from('conversations')
        .insert({ participant_a: pa, participant_b: pb })
        .select('*')
        .single();
      if (error) throw error;
      conversation = data as ConversationRow;
    }
    const counterpart = await profileMap([userId]);
    res.status(201).json({
      success: true,
      conversation: {
        id: conversation.id,
        last_message_at: conversation.last_message_at,
        counterpart: counterpart.get(userId) ? { id: userId, ...counterpart.get(userId) } : null
      }
    });
  })
);

async function conversationFor(user: UserProfile, conversationId: string): Promise<ConversationRow> {
  const conversation = await participantIdsOf(conversationId);
  if (user.id !== conversation.participant_a && user.id !== conversation.participant_b) {
    throw AppError.forbidden('Access denied. You are not a participant of this conversation.');
  }
  return conversation;
}

// ============================================================================
// GET /api/chat/conversations/:id/messages - messages (marks the other side read)
// ============================================================================
chatRouter.get(
  '/conversations/:id/messages',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const me = req.user as UserProfile;
    const conversation = await conversationFor(me, param(req, 'id'));
    const counterpartId = conversation.participant_a === me.id ? conversation.participant_b : conversation.participant_a;

    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .neq('sender_id', me.id)
      .is('read_at', null);

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`id, conversation_id, sender_id, content, read_at, created_at, sender:users(id, full_name, role)`)
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(1000);
    if (error) throw error;

    const counterpart = await profileMap([counterpartId]);
    res.json({
      conversation: { id: conversation.id, counterpart: counterpart.get(counterpartId) ? { id: counterpartId, ...counterpart.get(counterpartId) } : null, last_message_at: conversation.last_message_at },
      items: data ?? []
    });
  })
);

// ============================================================================
// POST /api/chat/conversations/:id/messages - send a message
// ============================================================================
chatRouter.post(
  '/conversations/:id/messages',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const me = req.user as UserProfile;
    const conversation = await conversationFor(me, param(req, 'id'));
    const { content } = messageSchema.parse(req.body ?? {});

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversation.id, sender_id: me.id, content })
      .select(`id, conversation_id, sender_id, content, read_at, created_at, sender:users(id, full_name, role)`)
      .single();
    if (error) throw error;
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);
    res.status(201).json({ success: true, message });
  })
);