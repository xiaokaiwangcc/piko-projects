export interface Note {
  id: number;
  content: string;
  created_at: string;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const RAW_BASE = import.meta.env?.VITE_API_BASE ?? '';
const API_BASE = RAW_BASE.replace(/\/+$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('NETWORK', '网络连接失败，请检查网络后重试', 0);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // 非 JSON 响应（如网关错误页）按通用错误处理
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `请求失败（HTTP ${response.status}）`,
      response.status,
    );
  }

  if (payload === null) {
    throw new ApiError('BAD_RESPONSE', '服务返回了无法解析的内容', response.status);
  }

  return payload as T;
}

export async function listNotes(signal?: AbortSignal): Promise<{ items: Note[] }> {
  const data = await request<{ items?: unknown }>('/api/notes', { signal });
  if (!Array.isArray(data.items)) {
    throw new ApiError('BAD_RESPONSE', '服务返回的留言列表格式不正确', 200);
  }
  return { items: data.items as Note[] };
}

export async function createNote(content: string): Promise<{ item: Note }> {
  const data = await request<{ item?: unknown }>('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  if (!data.item || typeof (data.item as Note).id !== 'number') {
    throw new ApiError('BAD_RESPONSE', '服务返回的留言格式不正确', 201);
  }
  return { item: data.item as Note };
}

export function deleteNote(id: number): Promise<{ ok: true }> {
  return request(`/api/notes/${id}`, { method: 'DELETE' });
}
