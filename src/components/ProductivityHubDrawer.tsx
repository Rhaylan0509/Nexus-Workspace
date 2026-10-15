import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  PenTool,
  Clock,
  BookOpen,
  FilePlus,
  Check,
  Link as LinkIcon,
} from 'lucide-react';
import { QuickLink } from '../types';

interface ProductivityHubDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quickLinks: QuickLink[];
  onAddQuickLink: (link: Omit<QuickLink, 'id'>) => void;
  onDeleteQuickLink: (id: string) => void;
  onConvertScratchpadToNote: (title: string, content: string) => void;
}

export const ProductivityHubDrawer: React.FC<ProductivityHubDrawerProps> = ({
  isOpen,
  onClose,
  quickLinks,
  onAddQuickLink,
  onDeleteQuickLink,
  onConvertScratchpadToNote,
}) => {
  // Pomodoro State
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Scratchpad State
  const [scratchpad, setScratchpad] = useState<string>(() => {
    return localStorage.getItem('nexus_scratchpad') || '';
  });
  const [scratchpadNotice, setScratchpadNotice] = useState<string | null>(null);

  // New Link Form Modal/Accordion
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('Geral');

  // Pomodoro Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      // Play audio notification or tone if supported
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 587.33; // D5
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) {
        // ignore audio context restrictions
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  // Scratchpad persistence
  useEffect(() => {
    localStorage.setItem('nexus_scratchpad', scratchpad);
  }, [scratchpad]);

  const toggleTimer = () => setIsRunning(!isRunning);

  const resetTimer = (mode: 'focus' | 'break' = pomodoroMode) => {
    setIsRunning(false);
    setPomodoroMode(mode);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSaveScratchpadAsNote = () => {
    if (!scratchpad.trim()) return;
    const lines = scratchpad.trim().split('\n');
    const firstLine = lines[0].replace(/^[#\s*-]+/, '').trim() || 'Rascunho Rápido';
    onConvertScratchpadToNote(firstLine, scratchpad);
    setScratchpadNotice('Convertido em Nota no Explorador!');
    setTimeout(() => setScratchpadNotice(null), 2500);
  };

  const handleAddLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    let url = newUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    onAddQuickLink({
      title: newTitle.trim(),
      url,
      category: newCategory.trim() || 'Geral',
    });
    setNewTitle('');
    setNewUrl('');
    setIsAddingLink(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-neutral-200 shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-neutral-900">
                Utilidades & Links Úteis
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Pomodoro Focus Timer */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  Temporizador Pomodoro
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => resetTimer('focus')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                      pomodoroMode === 'focus'
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    Foco 25m
                  </button>
                  <button
                    onClick={() => resetTimer('break')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                      pomodoroMode === 'break'
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    Pausa 5m
                  </button>
                </div>
              </div>

              <div className="text-center py-2">
                <div className="text-4xl font-bold font-mono tabular-nums text-neutral-900 tracking-tight">
                  {formatTime(timeLeft)}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {pomodoroMode === 'focus' ? 'Bloco de foco profundo' : 'Hora de descansar os olhos'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={toggleTimer}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isRunning ? 'Pausar' : 'Iniciar'}</span>
                </button>
                <button
                  onClick={() => resetTimer(pomodoroMode)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-lg transition-colors cursor-pointer"
                  title="Reiniciar tempo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. Quick Scratchpad */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Rascunho Rápido
                </span>
                <button
                  onClick={handleSaveScratchpadAsNote}
                  disabled={!scratchpad.trim()}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <FilePlus className="w-3 h-3" />
                  <span>Salvar como Nota</span>
                </button>
              </div>

              {scratchpadNotice && (
                <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{scratchpadNotice}</span>
                </div>
              )}

              <textarea
                value={scratchpad}
                onChange={(e) => setScratchpad(e.target.value)}
                placeholder="Rascunhe pensamentos, ideias ou anotações rápidas aqui... Salva automaticamente."
                rows={5}
                className="w-full p-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white transition-all font-sans leading-relaxed resize-none"
              />
            </div>

            {/* 3. Quick Everyday Links */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Links Úteis do Dia a Dia
                </span>
                <button
                  onClick={() => setIsAddingLink(!isAddingLink)}
                  className="text-[11px] text-neutral-600 hover:text-neutral-900 font-medium cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar</span>
                </button>
              </div>

              {/* Add Link Form */}
              {isAddingLink && (
                <form
                  onSubmit={handleAddLinkSubmit}
                  className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2.5 text-xs animate-in fade-in duration-100"
                >
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">Título</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ex: Portal Acadêmico"
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">URL</label>
                    <input
                      type="text"
                      required
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingLink(false)}
                      className="px-2.5 py-1 text-neutral-600 hover:text-neutral-900"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-neutral-900 text-white rounded text-xs font-medium cursor-pointer"
                    >
                      Salvar Link
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 gap-2">
                {quickLinks.map((link) => (
                  <div
                    key={link.id}
                    className="group flex items-center justify-between p-2.5 bg-white border border-neutral-200/90 rounded-lg hover:border-neutral-300 hover:shadow-2xs transition-all"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 min-w-0 flex-1 hover:text-neutral-900"
                    >
                      <div className="w-7 h-7 rounded bg-neutral-100 flex items-center justify-center text-neutral-600 shrink-0">
                        <LinkIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium text-neutral-800 group-hover:text-neutral-900 flex items-center gap-1.5 truncate">
                          <span className="truncate">{link.title}</span>
                          <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                        </div>
                        <span className="text-[10.5px] text-neutral-400 font-mono">
                          {link.category}
                        </span>
                      </div>
                    </a>

                    <button
                      onClick={() => onDeleteQuickLink(link.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-600 transition-opacity cursor-pointer shrink-0 ml-2"
                      title="Remover atalho"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Xournal++ & Productivity Tips Box */}
            <div className="p-3.5 bg-blue-50/50 border border-blue-200/60 rounded-xl space-y-1.5 text-xs text-blue-900">
              <div className="font-semibold flex items-center gap-1.5 text-blue-950">
                <PenTool className="w-3.5 h-3.5 text-blue-600" />
                <span>Integração Xournal++ (.xopp)</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-blue-900/80">
                Ao exportar suas notas do Xournal++, você pode salvá-las como <strong>.xopp</strong> ou <strong>.pdf</strong> e arrastá-las direto para seus Cadernos neste portal. Todos os arquivos ficam disponíveis localmente no seu computador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
