import { FileItem, QuickLink } from '../types';

/**
 * Empty initial items - starting from zero with no mock/example files.
 * The workspace is ready for the user to create their real folders, notebooks,
 * notes and upload their own files.
 */
export const INITIAL_FILES: FileItem[] = [];

export const INITIAL_QUICK_LINKS: QuickLink[] = [
  {
    id: 'link-drive',
    title: 'Google Drive',
    url: 'https://drive.google.com/',
    category: 'Nuvem',
  },
  {
    id: 'link-xopp',
    title: 'Xournal++ Oficial',
    url: 'https://xournalpp.github.io/',
    category: 'Anotações',
  },
  {
    id: 'link-notion',
    title: 'Notion',
    url: 'https://www.notion.so/',
    category: 'Produtividade',
  },
  {
    id: 'link-overleaf',
    title: 'Overleaf LaTeX',
    url: 'https://www.overleaf.com/',
    category: 'Acadêmico',
  },
  {
    id: 'link-excalidraw',
    title: 'Excalidraw',
    url: 'https://excalidraw.com/',
    category: 'Diagramas',
  },
];
