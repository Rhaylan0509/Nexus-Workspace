const API_BASE = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  reminders?: { useDefault?: boolean; overrides?: Array<{ method: string; minutes: number }> };
}

async function calendarRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message || `Google Agenda respondeu com erro ${response.status}.`;
    throw new Error(response.status === 401 ? 'A autorização do Google Agenda expirou. Conecte a conta novamente.' : message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listGoogleCalendarEvents(token: string, from: Date, to: Date): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });
  const result = await calendarRequest<{ items?: GoogleCalendarEvent[] }>(
    token,
    `${API_BASE}/calendars/primary/events?${params}`
  );
  return result.items || [];
}

export async function createGoogleCalendarEvent(
  token: string,
  input: { title: string; kind: 'task' | 'event'; date: Date; reminderDays: number }
): Promise<GoogleCalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const end = new Date(input.date.getTime() + 60 * 60 * 1000);
  const description = input.kind === 'task' ? 'Tarefa criada no Nexus Workspace.' : 'Evento criado no Nexus Workspace.';
  const body = {
    summary: input.title,
    description,
    start: { dateTime: input.date.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: input.reminderDays * 24 * 60 }],
    },
  };
  return calendarRequest<GoogleCalendarEvent>(
    token,
    `${API_BASE}/calendars/primary/events`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function deleteGoogleCalendarEvent(token: string, eventId: string): Promise<void> {
  await calendarRequest<void>(
    token,
    `${API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  );
}
