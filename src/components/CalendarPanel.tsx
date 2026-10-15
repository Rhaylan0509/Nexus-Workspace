import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  Cloud, LoaderCircle, Plus, RefreshCw, Trash2,
} from 'lucide-react';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  GoogleCalendarEvent,
  GoogleCalendarApiError,
  listGoogleCalendarEvents,
} from '../lib/googleCalendar';
import { getGoogleAuthErrorMessage } from '../lib/firebaseAuth';

type CalendarEntry = {
  id: string;
  title: string;
  kind: 'task' | 'event';
  date: string;
  reminderDays: number;
  notified?: boolean;
  googleEventId?: string;
};

interface CalendarPanelProps {
  accessToken: string | null;
  onConnectGoogleCalendar: () => Promise<string | null>;
  onCalendarTokenExpired: () => void;
}

const STORAGE_KEY = 'nexus_calendar_entries_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

function readEntries(): CalendarEntry[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatInputDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromGoogleEvent(event: GoogleCalendarEvent): CalendarEntry | null {
  const start = event.start.dateTime
    ? new Date(event.start.dateTime)
    : event.start.date
      ? new Date(`${event.start.date}T09:00:00`)
      : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const description = event.description || '';
  const reminderMinutes = event.reminders?.overrides?.find((reminder) => reminder.method === 'popup')?.minutes;
  return {
    id: event.id,
    googleEventId: event.id,
    title: event.summary || '(Sem título)',
    kind: description.startsWith('Tarefa criada no Nexus') ? 'task' : 'event',
    date: formatInputDate(start),
    reminderDays: reminderMinutes === undefined ? 0 : Math.max(0, Math.min(5, Math.round(reminderMinutes / 1440))),
  };
}

export const CalendarPanel: React.FC<CalendarPanelProps> = ({ accessToken, onConnectGoogleCalendar, onCalendarTokenExpired }) => {
  const [entries, setEntries] = useState<CalendarEntry[]>(readEntries);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'task' | 'event'>('task');
  const [date, setDate] = useState(() => formatInputDate(new Date(Date.now() + 60 * 60 * 1000)));
  const [reminderDays, setReminderDays] = useState(1);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const reportCalendarError = (error: unknown, fallback: string) => {
    if (error instanceof GoogleCalendarApiError && error.status === 401) {
      onCalendarTokenExpired();
      setErrorMessage(error.message);
      return;
    }
    const authCode = (error as { code?: string } | null)?.code;
    if (authCode?.startsWith('auth/')) {
      setErrorMessage(getGoogleAuthErrorMessage(error));
      return;
    }
    setErrorMessage(error instanceof Error ? error.message : fallback);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    const checkLocalReminders = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = Date.now();
      setEntries((current) => {
        let changed = false;
        const next = current.map((entry) => {
          if (entry.googleEventId || entry.notified) return entry;
          const start = new Date(entry.date).getTime();
          const reminderAt = start - entry.reminderDays * DAY_MS;
          const deadline = entry.reminderDays === 0 ? start + 5 * 60_000 : start;
          if (Number.isFinite(start) && now >= reminderAt && now <= deadline) {
            new Notification(entry.kind === 'task' ? 'Lembrete de tarefa' : 'Lembrete de evento', {
              body: `${entry.title} — ${new Date(entry.date).toLocaleString('pt-BR')}`,
              tag: `nexus-calendar-${entry.id}`,
            });
            changed = true;
            return { ...entry, notified: true };
          }
          return entry;
        });
        return changed ? next : current;
      });
    };
    checkLocalReminders();
    const timer = window.setInterval(checkLocalReminders, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  }, [month]);

  const selectedDayEvents = useMemo(
    () => entries.filter((entry) => {
      const eventDate = new Date(entry.date);
      return eventDate.getFullYear() === selectedDay.getFullYear() && eventDate.getMonth() === selectedDay.getMonth() && eventDate.getDate() === selectedDay.getDate();
    }).sort((a, b) => a.date.localeCompare(b.date)),
    [entries, selectedDay]
  );

  const syncCalendar = async (token: string) => {
    setIsSyncing(true);
    setErrorMessage('');
    try {
      // Upload local entries once, then keep Google as the source for synced items.
      const pending = entries.filter((entry) => !entry.googleEventId);
      for (const entry of pending) {
        const created = await createGoogleCalendarEvent(token, {
          title: entry.title,
          kind: entry.kind,
          date: new Date(entry.date),
          reminderDays: entry.reminderDays,
        });
        const synced = fromGoogleEvent(created);
        if (synced) {
          setEntries((current) => current.map((item) => item.id === entry.id ? synced : item));
        }
      }

      const from = days[0];
      const to = new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate() + 1);
      const remote = await listGoogleCalendarEvents(token, from, to);
      const remoteEntries = remote.map(fromGoogleEvent).filter((entry): entry is CalendarEntry => !!entry);
      setEntries((current) => {
        const unsynced = current.filter((entry) => !entry.googleEventId);
        const syncedOutsideView = current.filter((entry) => entry.googleEventId && !remoteEntries.some((remoteEntry) => remoteEntry.googleEventId === entry.googleEventId));
        const combined = [...unsynced, ...syncedOutsideView, ...remoteEntries];
        return combined;
      });
      setStatusMessage(`Google Agenda sincronizado · ${remoteEntries.length} compromisso(s) neste mês`);
      window.setTimeout(() => setStatusMessage(''), 4000);
    } catch (error) {
      reportCalendarError(error, 'Não foi possível sincronizar com o Google Agenda.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (accessToken) void syncCalendar(accessToken);
    // Refresh when the visible month changes or the user grants Calendar access.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, month.getFullYear(), month.getMonth()]);

  const handleConnect = async () => {
    setErrorMessage('');
    try {
      await onConnectGoogleCalendar();
    } catch (error) {
      reportCalendarError(error, 'Não foi possível conectar ao Google Agenda.');
    }
  };

  const addEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date) return;
    const entry: CalendarEntry = {
      id: `calendar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(), kind, date, reminderDays, notified: false,
    };
    setIsSaving(true);
    setErrorMessage('');
    try {
      if (accessToken) {
        const remote = await createGoogleCalendarEvent(accessToken, {
          title: entry.title,
          kind: entry.kind,
          date: new Date(entry.date),
          reminderDays: entry.reminderDays,
        });
        const synced = fromGoogleEvent(remote);
        setEntries((current) => synced ? [...current, synced] : [...current, entry]);
        setStatusMessage('Compromisso adicionado ao Google Agenda.');
      } else {
        setEntries((current) => [...current, entry]);
        setStatusMessage('Salvo neste navegador. Conecte o Google Agenda para sincronizar.');
      }
      setTitle('');
      setDate(formatInputDate(selectedDay));
      window.setTimeout(() => setStatusMessage(''), 4000);
    } catch (error) {
      reportCalendarError(error, 'Não foi possível adicionar o compromisso.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeEntry = async (entry: CalendarEntry) => {
    setErrorMessage('');
    try {
      if (entry.googleEventId && !accessToken) {
        setErrorMessage('Reconecte ao Google Agenda para remover este compromisso sincronizado.');
        return;
      }
      if (entry.googleEventId && accessToken) await deleteGoogleCalendarEvent(accessToken, entry.googleEventId);
      setEntries((current) => current.filter((item) => item.id !== entry.id && (!entry.googleEventId || item.googleEventId !== entry.googleEventId)));
    } catch (error) {
      reportCalendarError(error, 'Não foi possível remover o compromisso.');
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  };

  const goToMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDay(next);
  };

  return <section className="w-full min-h-[calc(100vh-8rem)] space-y-5">
    <header className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarDays className="w-6 h-6" /></div>
        <div><h1 className="text-2xl font-bold tracking-tight text-neutral-900">Calendário</h1><p className="mt-1 text-sm text-neutral-500">Organize tarefas e eventos com o Google Agenda.</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleConnect} disabled={isSyncing} title={accessToken ? 'Renovar a autorização do Google Agenda' : undefined} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-60">
          <Cloud className="w-4 h-4" />{accessToken ? 'Reconectar Google Agenda' : 'Conectar Google Agenda'}
        </button>
        <button onClick={() => accessToken && void syncCalendar(accessToken)} disabled={!accessToken || isSyncing} className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isSyncing ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}{isSyncing ? 'Sincronizando' : 'Sincronizar'}
        </button>
      </div>
    </header>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
      <section className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xs sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => goToMonth(-1)} className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => { const today = new Date(); setMonth(startOfMonth(today)); setSelectedDay(today); }} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Hoje</button>
            <button onClick={() => goToMonth(1)} className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <h2 className="text-lg font-semibold capitalize text-neutral-900">{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
          <span className="hidden text-xs text-neutral-400 sm:inline">{accessToken ? 'Sincronizado com Google Agenda' : 'Somente neste navegador'}</span>
        </div>

        <div className="grid grid-cols-7 border-l border-t border-neutral-200">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((weekday) => <div key={weekday} className="border-b border-r border-neutral-200 bg-neutral-50 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-xs">{weekday}</div>)}
          {days.map((day) => {
            const dayEntries = entries.filter((entry) => {
              const value = new Date(entry.date);
              return value.getFullYear() === day.getFullYear() && value.getMonth() === day.getMonth() && value.getDate() === day.getDate();
            });
            const inMonth = day.getMonth() === month.getMonth();
            const isSelected = day.toDateString() === selectedDay.toDateString();
            const isToday = day.toDateString() === new Date().toDateString();
            return <button key={day.toISOString()} onClick={() => { setSelectedDay(day); setDate(formatInputDate(day)); }} className={`min-h-[78px] border-b border-r border-neutral-200 p-1.5 text-left transition-colors sm:min-h-[104px] sm:p-2 ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-neutral-50'} ${!inMonth ? 'text-neutral-300' : 'text-neutral-800'}`}>
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${isToday ? 'bg-blue-600 font-semibold text-white' : inMonth ? 'font-medium' : ''}`}>{day.getDate()}</span>
              <div className="mt-1 space-y-1">
                {dayEntries.slice(0, 2).map((entry) => <span key={entry.id} className={`block truncate rounded px-1 py-0.5 text-[9px] sm:text-[10px] ${entry.kind === 'task' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>{entry.title}</span>)}
                {dayEntries.length > 2 && <span className="block px-1 text-[9px] text-neutral-500">+{dayEntries.length - 2} mais</span>}
              </div>
            </button>;
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-500"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-300" />Tarefas</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue-300" />Eventos</span></div>
      </section>

      <aside className="space-y-4">
        <form onSubmit={addEntry} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900"><Plus className="w-4 h-4 text-blue-600" />Novo compromisso</h2>
          <div className="space-y-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome da tarefa ou evento" required className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            <div className="grid grid-cols-2 gap-2">
              <select value={kind} onChange={(event) => setKind(event.target.value as 'task' | 'event')} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"><option value="task">Tarefa</option><option value="event">Evento</option></select>
              <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 text-xs text-neutral-600"><Bell className="w-3.5 h-3.5 shrink-0" /><select value={reminderDays} onChange={(event) => setReminderDays(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent py-2.5 outline-none">{[0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value === 0 ? 'Na hora' : `${value} ${value === 1 ? 'dia' : 'dias'} antes`}</option>)}</select></label>
            </div>
            <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm" />
            <button disabled={isSaving} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"><Plus className="w-4 h-4" />{isSaving ? 'Salvando…' : accessToken ? 'Adicionar ao Google Agenda' : 'Adicionar ao calendário'}</button>
          </div>
          {statusMessage && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{statusMessage}</p>}
          {errorMessage && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800"><p>{errorMessage}</p>{!accessToken && <p className="mt-1">Confira se a API Google Calendar está habilitada e se este domínio está autorizado no Firebase.</p>}</div>}
        </form>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="font-semibold text-neutral-900">{selectedDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</h2><p className="text-xs text-neutral-500">Compromissos do dia</p></div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">{selectedDayEvents.length}</span></div>
          {!selectedDayEvents.length ? <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-sm text-neutral-400">Nenhum compromisso neste dia.</p> : <ul className="space-y-2">
            {selectedDayEvents.map((entry) => <li key={entry.id} className="flex items-start gap-3 rounded-xl border border-neutral-100 p-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${entry.kind === 'task' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{entry.kind === 'task' ? <Check className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}</div>
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-neutral-900">{entry.title}</p><p className="mt-1 flex items-center gap-1 text-xs text-neutral-500"><Clock3 className="w-3 h-3" />{new Date(entry.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {entry.reminderDays === 0 ? 'na hora' : `${entry.reminderDays} ${entry.reminderDays === 1 ? 'dia' : 'dias'} antes`}</p>{entry.googleEventId && <p className="mt-1 text-[10px] text-emerald-700">Google Agenda</p>}</div>
              <button onClick={() => void removeEntry(entry)} className="rounded p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Excluir ${entry.title}`}><Trash2 className="w-4 h-4" /></button>
            </li>)}
          </ul>}
          {permission !== 'granted' && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-900"><span className="flex items-center gap-2"><Bell className="w-4 h-4 shrink-0" />{permission === 'unsupported' ? 'Notificações não suportadas' : permission === 'denied' ? 'Permissão negada no navegador' : 'Ative avisos para itens locais'}</span>{permission === 'default' && <button type="button" onClick={enableNotifications} className="shrink-0 font-semibold underline">Ativar</button>}</div>}
        </section>
      </aside>
    </div>
  </section>;
};
