
const recentList = document.getElementById('recent-list');
const recentEmpty = document.getElementById('empty-state');
const toast = document.getElementById('toast');
const libraryView = document.getElementById('library-view');
const explorerList = document.getElementById('explorer-list');
const libraryModal = document.getElementById('library-modal');
let toastTimer;
let libraryData = { entries: [] };
let currentParentId = null;
let locationHistory = [null];
let modalMode = 'folder';
let selectedContainerColor = 'yellow';

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
}
function prettyName(file) { return file.split(/[\\/]/).pop(); }
function renderRecent(files) {
  recentList.replaceChildren();
  recentEmpty.hidden = files.length > 0;
  document.getElementById('recent-count').textContent = `${files.length} ${files.length === 1 ? 'arquivo' : 'arquivos'}`;
  for (const file of files) {
    const row = document.createElement('div'); row.className = 'recent-row'; row.tabIndex = 0;
    const icon = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = file.toLowerCase().endsWith('.pdf') ? '▧' : '▤';
    const info = document.createElement('div'); info.className = 'file-info';
    const name = document.createElement('b'); name.textContent = prettyName(file);
    const location = document.createElement('small'); location.textContent = file;
    const action = document.createElement('div'); action.className = 'file-action'; action.textContent = '↗';
    info.append(name, location); row.append(icon, info, action);
    row.addEventListener('click', () => run(() => window.xournal.openRecent(file)));
    row.addEventListener('contextmenu', event => { event.preventDefault(); window.xournal.revealFile(file); });
    recentList.append(row);
  }
}
async function refresh() {
  const state = await window.xournal.status();
  const ready = Boolean(state.executable);
  document.getElementById('sidebar-status').textContent = ready ? 'Xournal++ conectado' : 'Xournal++ não configurado';
  document.querySelector('.status-dot').classList.toggle('ready', ready);
  renderRecent(state.recent || []);
}
async function run(action) {
  const result = await action();
  if (result?.error) notify(result.error);
  else if (result?.ok) { notify('Documento aberto no Xournal++.'); await refresh(); }
}
document.getElementById('new-note').addEventListener('click', () => run(() => window.xournal.newNote()));
document.getElementById('top-open').addEventListener('click', () => run(() => window.xournal.openFile()));
document.getElementById('sync-drive').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.innerHTML = '↻ <span>Sincronizando com GitHub…</span>';
  try {
    const result = await window.xournal.syncGitHub();
    notify(result?.message || 'Sincronização com GitHub concluída.');
    await refreshGitHubStatus();
    await refreshLibrary();
  } catch (error) {
    notify(error.message || 'Não foi possível sincronizar com GitHub.');
  } finally {
    await refreshGitHubStatus();
  }
});
async function refreshGitHubStatus() {
  const state = await window.xournal.gitHubStatus();
  const button = document.getElementById('sync-drive');
  button.disabled = Boolean(state.syncing);
  button.querySelector('span').textContent = state.syncing ? 'Sincronizando…' : 'Sincronizar GitHub';
  document.getElementById('sidebar-status').textContent = state.syncing ? 'Sincronizando com GitHub…' : (state.message || 'GitHub sincronizado');
  document.querySelector('.status-dot').classList.toggle('ready', true);
}
setInterval(() => refreshGitHubStatus().catch(() => {}), 3000);
document.getElementById('browse-nav').addEventListener('click', () => run(() => window.xournal.openFile()));
document.getElementById('settings-button').addEventListener('click', async () => {
  const executable = await window.xournal.chooseExecutable();
  if (executable) notify(`Xournal++ definido: ${prettyName(executable)}`);
  await refresh();
});

document.getElementById('library-nav').addEventListener('click', () => refreshLibrary());

function findEntry(id) { return libraryData.entries.find(entry => entry.id === id) || null; }
function currentContainer() { return currentParentId ? findEntry(currentParentId) : null; }
function entriesAt(parentId) { return libraryData.entries.filter(entry => (entry.parentId || null) === parentId); }
function navigateTo(id, remember = true) {
  currentParentId = id;
  if (remember) locationHistory.push(id);
  renderExplorer();
}
function makeBreadcrumb() {
  const parts = [];
  let entry = currentContainer();
  while (entry) { parts.unshift(entry); entry = entry.parentId ? findEntry(entry.parentId) : null; }
  const crumb = document.getElementById('library-crumb'); crumb.replaceChildren();
  const root = document.createElement('button'); root.className = `crumb-link ${parts.length ? '' : 'current'}`; root.textContent = 'Biblioteca';
  root.addEventListener('click', () => navigateTo(null)); crumb.append(root);
  for (const [index, part] of parts.entries()) {
    const separator = document.createElement('span'); separator.textContent = '›'; crumb.append(separator);
    const link = document.createElement('button'); link.className = `crumb-link ${index === parts.length - 1 ? 'current' : ''}`; link.textContent = part.name;
    link.addEventListener('click', () => navigateTo(part.id)); crumb.append(link);
  }
}
function entryCounts(entry) {
  const children = entriesAt(entry.id);
  if (entry.type === 'folder') return `${children.length} ${children.length === 1 ? 'item' : 'itens'}`;
  if (entry.type === 'notebook') return `${children.filter(child => child.type === 'note').length} notas`;
  if (entry.imported) return `${(entry.extension || '').slice(1).toUpperCase()} · ${formatBytes(entry.fileSize || 0)}`;
  return `${entry.size} · ${entry.color} · ${entry.style}`;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function openEntry(entry) {
  if (entry.type === 'folder' || entry.type === 'notebook') navigateTo(entry.id);
  else run(async () => {
    const result = await window.xournal.openLibraryNote(entry.id);
    if (result.ok) notify(`“${entry.name}” aberto no Xournal++.`);
    return result;
  });
}
function renderExplorer() {
  const entries = entriesAt(currentParentId).sort((a, b) => {
    const order = { folder: 0, notebook: 1, note: 2 };
    return order[a.type] - order[b.type] || a.name.localeCompare(b.name, 'pt-BR');
  });
  explorerList.replaceChildren();
  for (const entry of entries) {
    const card = document.createElement('article'); card.className = `explorer-card ${entry.type}-card`;
    const main = document.createElement('button'); main.type = 'button'; main.className = 'card-main';
    if (entry.type === 'folder') {
      const art = document.createElement('div'); art.className = 'folder-art'; art.dataset.color = entry.color || 'yellow';
      art.innerHTML = '<span class="folder-back"></span><span class="folder-front"></span>';
      main.append(art);
    } else if (entry.type === 'notebook') {
      const art = document.createElement('div'); art.className = 'notebook-art'; art.dataset.color = entry.color || 'blue';
      art.innerHTML = '<span class="notebook-spine"></span><span class="notebook-pages"></span>';
      main.append(art);
    } else {
      const art = document.createElement('div'); art.className = `document-art ${entry.extension === '.pdf' ? 'pdf-art' : ''}`;
      const paper = document.createElement('span'); paper.className = 'document-paper';
      const lines = document.createElement('span'); lines.className = 'document-lines';
      paper.append(lines); art.append(paper); main.append(art);
    }
    const title = document.createElement('b'); title.className = 'card-title'; title.textContent = `${entry.name}${entry.extension || ''}`;
    main.append(title);
    const date = document.createElement('small'); date.className = 'card-date';
    date.textContent = entry.type === 'notebook' ? formatDate(entry.createdAt) : entry.type === 'note' ? entryCounts(entry) : '';
    main.append(date);
    main.addEventListener('click', () => openEntry(entry));
    card.append(main);
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const open = document.createElement('button'); open.className = 'open-entry'; open.type = 'button'; open.textContent = entry.type === 'note' ? 'Abrir' : 'Abrir caderno';
    open.addEventListener('click', () => openEntry(entry));
    if (entry.type === 'note') actions.append(open);
    const rename = document.createElement('button'); rename.className = 'row-action'; rename.type = 'button'; rename.title = 'Renomear'; rename.textContent = '✎';
    rename.addEventListener('click', () => openLibraryModal('rename', entry));
    const remove = document.createElement('button'); remove.className = 'row-action delete'; remove.type = 'button'; remove.title = 'Excluir'; remove.textContent = '⌫';
    remove.addEventListener('click', () => deleteEntry(entry));
    actions.append(rename, remove);
    card.append(actions);
    explorerList.append(card);
  }
  document.getElementById('explorer-empty').hidden = entries.length > 0;
  const parent = currentContainer();
  document.getElementById('back-location').disabled = locationHistory.length < 2;
  document.getElementById('up-location').disabled = !parent;
  document.getElementById('create-folder').disabled = parent?.type === 'notebook';
  document.getElementById('create-notebook').disabled = parent?.type === 'notebook';
  document.getElementById('create-library-note').disabled = false;
  makeBreadcrumb();
}
function formatDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('pt-BR');
}
async function refreshLibrary() {
  libraryData = await window.xournal.getLibrary();
  renderExplorer();
}
document.getElementById('back-location').addEventListener('click', () => {
  if (locationHistory.length > 1) { locationHistory.pop(); currentParentId = locationHistory.at(-1); renderExplorer(); }
});
document.getElementById('up-location').addEventListener('click', () => {
  const parent = currentContainer();
  if (parent) {
    const destination = parent.parentId || null;
    locationHistory = [...locationHistory.slice(0, -1), destination];
    currentParentId = destination; renderExplorer();
  }
});

function openLibraryModalFor(mode, entry) {
  modalMode = mode;
  const parent = currentContainer();
  const location = parent ? ` em “${parent.name}”` : ' na Biblioteca';
  const settings = {
    folder: ['PASTA', 'Nova pasta', `Crie uma pasta${location}.`, 'Criar pasta', 'Ex.: Projetos'],
    notebook: ['CADERNO', 'Novo caderno', `Crie um caderno${location}.`, 'Criar caderno', 'Ex.: Estudos'],
    note: ['NOTA', 'Nova nota', `A nota será criada${location}, sem precisar pertencer a um caderno.`, 'Criar e abrir nota', 'Ex.: Aula 01'],
    import: ['ADICIONAR ARQUIVO', 'Adicionar à Biblioteca', `O arquivo será copiado${location}.`, 'Adicionar arquivo', ''],
    rename: ['EDITAR ITEM', 'Renomear', `Altere o nome de “${entry?.name || ''}”.`, 'Salvar nome', '']
  }[mode];
  document.getElementById('modal-eyebrow').textContent = settings[0];
  document.getElementById('modal-title').textContent = settings[1];
  document.getElementById('modal-description').textContent = settings[2];
  document.getElementById('modal-submit').textContent = settings[3];
  const name = document.getElementById('entity-name');
  document.getElementById('entity-name-field').hidden = mode === 'import';
  document.getElementById('entity-name').required = mode !== 'import';
  document.getElementById('import-options').hidden = mode !== 'import';
  name.placeholder = settings[4]; name.value = mode === 'rename' ? `${entry.name}${entry.extension || ''}` : '';
  document.getElementById('import-path').value = '';
  document.getElementById('note-options').hidden = mode !== 'note';
  const canChooseColor = mode === 'folder' || mode === 'notebook' || (mode === 'rename' && ['folder', 'notebook'].includes(entry?.type));
  document.getElementById('container-color-options').hidden = !canChooseColor;
  if (canChooseColor) renderColorChoices(entry?.color || (mode === 'notebook' ? 'blue' : 'yellow'));
  libraryModal.hidden = false;
  if (mode === 'import') document.getElementById('import-path').focus(); else name.focus();
}
const folderColors = [
  { id: 'yellow', name: 'Amarelo' }, { id: 'blue', name: 'Azul' },
  { id: 'purple', name: 'Roxo' }, { id: 'green', name: 'Verde' },
  { id: 'pink', name: 'Rosa' }, { id: 'orange', name: 'Laranja' }
];
function renderColorChoices(selected) {
  selectedContainerColor = selected;
  const choices = document.getElementById('color-choices'); choices.replaceChildren();
  for (const color of folderColors) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `color-choice ${color.id === selected ? 'selected' : ''}`;
    button.dataset.color = color.id; button.title = color.name; button.setAttribute('aria-label', color.name); button.setAttribute('aria-pressed', String(color.id === selected));
    button.addEventListener('click', () => renderColorChoices(color.id));
    choices.append(button);
  }
  document.getElementById('color-selected-label').textContent = `Selecionada: ${folderColors.find(color => color.id === selected)?.name || 'Amarelo'}`;
}
function closeLibraryModal() { libraryModal.hidden = true; }
document.getElementById('create-folder').addEventListener('click', () => openLibraryModal('folder'));
document.getElementById('create-notebook').addEventListener('click', () => openLibraryModal('notebook'));
document.getElementById('create-library-note').addEventListener('click', () => openLibraryModal('note'));
document.getElementById('import-library-file').addEventListener('click', () => openLibraryModal('import'));
document.getElementById('modal-close').addEventListener('click', closeLibraryModal);
document.getElementById('modal-cancel').addEventListener('click', closeLibraryModal);
libraryModal.addEventListener('click', event => { if (event.target === libraryModal) closeLibraryModal(); });
document.getElementById('choose-import-file').addEventListener('click', async () => {
  const paths = await window.xournal.chooseLibraryFiles();
  if (paths.length) document.getElementById('import-path').value = paths[0];
});
document.getElementById('library-form').addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.getElementById('entity-name').value.trim();
  if (modalMode === 'import') {
    const sourcePath = document.getElementById('import-path').value.trim().replace(/^"|"$/g, '');
    if (!sourcePath) return notify('Indique ou escolha o caminho de um arquivo.');
    const result = await window.xournal.importLibraryFile({ sourcePath, parentId: currentParentId });
    if (result.error) return notify(result.error);
    libraryData = result.library; closeLibraryModal(); renderExplorer();
    notify(`“${result.entry.name}${result.entry.extension}” adicionado à Biblioteca.`);
    return;
  }
  if (modalMode === 'rename') {
    if (!name) return;
    const item = findEntry(editingEntryId);
    const result = await window.xournal.renameLibraryEntry({ entryId: editingEntryId, name, color: ['folder', 'notebook'].includes(item?.type) ? selectedContainerColor : undefined });
    if (result.error) return notify(result.error);
    libraryData = result.library; closeLibraryModal(); renderExplorer(); notify('Nome atualizado.');
    return;
  }
  if (!name) return;
  const data = { type: modalMode, name, parentId: currentParentId };
  if (modalMode === 'folder' || modalMode === 'notebook') data.color = selectedContainerColor;
  if (modalMode === 'note') {
    data.size = document.getElementById('note-size').value;
    data.color = document.getElementById('note-color').value;
    data.style = document.getElementById('note-style').value;
  }
  const result = await window.xournal.createLibraryEntry(data);
  if (result.error) return notify(result.error);
  libraryData = result.library;
  closeLibraryModal();
  if (result.entry.type === 'folder' || result.entry.type === 'notebook') {
    notify(`${result.entry.type === 'folder' ? 'Pasta' : 'Caderno'} criado.`);
    navigateTo(result.entry.id);
  } else {
    renderExplorer();
    const opened = await window.xournal.openLibraryNote(result.entry.id);
    if (opened.error) notify(`Nota criada em ${result.entry.filePath}, mas não abriu: ${opened.error}`);
    else { notify(`Nota criada e aberta: ${result.entry.name}.`); await refresh(); }
  }
});

let editingEntryId = null;
function openLibraryModal(mode, entry) {
  editingEntryId = entry?.id || null;
  openLibraryModalFor(mode, entry);
}
async function deleteEntry(entry) {
  const children = new Set([entry.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of libraryData.entries) if (children.has(child.parentId) && !children.has(child.id)) { children.add(child.id); changed = true; }
  }
  const count = children.size - 1;
  const message = entry.type === 'note'
    ? `Excluir “${entry.name}${entry.extension || ''}” e o arquivo da Biblioteca?`
    : `Excluir “${entry.name}” e ${count} ${count === 1 ? 'item' : 'itens'} dentro dele?`;
  if (!window.confirm(message)) return;
  const result = await window.xournal.deleteLibraryEntry(entry.id);
  if (result.error) return notify(result.error);
  libraryData = result.library; renderExplorer(); notify('Item excluído da Biblioteca.');
}

const explorerPanel = document.querySelector('.explorer-panel');
let dragDepth = 0;
function showDropTarget(show) {
  document.getElementById('drop-overlay').hidden = !show;
  explorerPanel.classList.toggle('drag-active', show);
  const container = currentContainer();
  document.getElementById('drop-location').textContent = container ? `Destino: ${container.name}` : 'Destino: Biblioteca';
}
libraryView.addEventListener('dragenter', event => {
  if (!Array.from(event.dataTransfer.types || []).includes('Files')) return;
  event.preventDefault(); dragDepth++; showDropTarget(true);
});
libraryView.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
libraryView.addEventListener('dragleave', event => {
  if (!event.relatedTarget || !libraryView.contains(event.relatedTarget)) { dragDepth = 0; showDropTarget(false); }
  else dragDepth = Math.max(0, dragDepth - 1);
});
libraryView.addEventListener('drop', async event => {
  event.preventDefault(); dragDepth = 0; showDropTarget(false);
  const files = Array.from(event.dataTransfer.files || []);
  let added = 0; const errors = [];
  for (const file of files) {
    const sourcePath = window.xournal.getPathForFile(file);
    const result = await window.xournal.importLibraryFile({ sourcePath, parentId: currentParentId });
    if (result.error) errors.push(`${file.name}: ${result.error}`);
    else { libraryData = result.library; added++; }
  }
  renderExplorer();
  if (added) notify(`${added} ${added === 1 ? 'arquivo adicionado' : 'arquivos adicionados'} à Biblioteca.`);
  if (errors.length) notify(errors[0]);
});

refresh();
refreshLibrary();