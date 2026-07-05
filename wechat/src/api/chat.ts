/**
 * 聊天 API 封装
 * 对应 CONTRACT.md 3.10 节
 */
import type {
  ChatLog,
  ChatSession,
  ChatMessageType,
  SendMessageResponse,
  ApiError,
} from '../types';

const BASE = '/api/chat';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let err: ApiError;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      err = { error: 'http_error', message: `HTTP ${res.status}` };
    }
    throw new Error(err.message || err.error);
  }
  return (await res.json()) as T;
}

/** 获取会话列表 */
export function getSessions(): Promise<ChatSession[]> {
  return request<ChatSession[]>(`${BASE}/sessions`);
}

/** 获取某会话的全部消息 */
export function getSessionMessages(sessionId: string): Promise<ChatLog[]> {
  return request<ChatLog[]>(`${BASE}/sessions/${encodeURIComponent(sessionId)}/messages`);
}

/** 老板发消息 */
export function sendMessage(
  sessionId: string,
  type: ChatMessageType,
  content: string,
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>(`${BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message_type: type, content }),
  });
}
