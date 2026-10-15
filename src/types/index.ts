export type ItemType = 'folder' | 'notebook' | 'note' | 'file';

export type NoteFormat = 'md' | 'xopp';

export interface FileItem {
  id: string;
  name: string;
  type: ItemType;
  parentId: string | null; // null represents root
  createdAt: number;
  updatedAt: number;
  size?: number; // in bytes
  mimeType?: string;
  extension?: string; // 'pdf', 'xopp', 'xoj', 'md', etc.
  content?: string; // for .md notes or raw XML for simulated .xopp
  blobKey?: string; // key in IndexedDB for binary files (PDFs, .xopp)
  tags: string[];
  starred: boolean;
  trashed: boolean;
  trashedAt?: number;
  color?: string; // e.g. 'orange', 'yellow', 'green', 'blue', 'purple'
  description?: string;
  driveFileId?: string; // linked Google Drive file ID if synced
  metadata?: {
    notebookSubject?: string;
    paperFormat?: string; // e.g. 'A5 · Amarelo claro · Pontilhado'
    pageStyle?: 'pautado' | 'pontilhado' | 'quadriculado' | 'em_branco';
    paperColor?: string;
    paperSize?: string;
    author?: string;
    pdfAnnotations?: PdfAnnotationsData;
    [key: string]: any;
  };
}

export interface PdfHighlight {
  id: string;
  pageNumber: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
  color: string; // e.g. '#fef08a'
  text?: string;
  createdAt: number;
}

export interface PdfComment {
  id: string;
  pageNumber: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  author: string;
  text: string;
  color?: string; // badge color theme
  resolved?: boolean;
  createdAt: number;
}

export interface PdfDrawingPoint {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface PdfDrawingStroke {
  id: string;
  pageNumber: number;
  tool: 'pen' | 'highlighter';
  points: PdfDrawingPoint[];
  color: string;
  width: number; // base thickness in px
  opacity: number;
  createdAt: number;
}

export interface PdfTextAnnotation {
  id: string;
  pageNumber: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  text: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  createdAt: number;
}

export interface PdfAnnotationsData {
  highlights: PdfHighlight[];
  comments: PdfComment[];
  drawings: PdfDrawingStroke[];
  textNotes: PdfTextAnnotation[];
}

export type ViewMode = 'grid' | 'table';

export type SortField = 'name' | 'updatedAt' | 'size';
export type SortDirection = 'asc' | 'desc';

export type FilterCategory = 'all' | 'starred' | 'trash';

export type FileTypeFilter = 'all' | 'notebook' | 'pdf' | 'xopp' | 'md';

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  category: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
  type?: ItemType | 'root';
}
