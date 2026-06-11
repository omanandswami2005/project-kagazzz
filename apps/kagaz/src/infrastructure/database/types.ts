/**
 * Typed entities for the V1 tables
 * (docs/architecture/09-database-design.md §4, camelCase mapping per §8).
 */

/** Origin of a document (documents.source_type CHECK constraint). */
export type DocumentSourceType =
  | 'camera'
  | 'scanner'
  | 'gallery'
  | 'file_picker'
  | 'ai_generated';

/** documents row (§4.1). */
export interface DocumentEntity {
  id: string;
  name: string;
  description?: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  fileHash?: string;
  thumbnailPath?: string;
  folderId?: string;
  isFavorite: boolean;
  isLocked: boolean;
  isArchived: boolean;
  language: string;
  ocrText?: string;
  sourceType: DocumentSourceType;
  originalFilename?: string;
  createdAt: string;
  updatedAt: string;
  /** When the document was last opened/previewed (F-32); null if never. */
  lastAccessedAt?: string;
  deletedAt?: string;
  metadataJson?: string;
  synced: boolean;
  version: number;
}

/** Caller-supplied fields when creating a document. */
export type NewDocument = Omit<
  DocumentEntity,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'synced' | 'version'
>;

/** folders row (§4.2). */
export interface FolderEntity {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Caller-supplied fields when creating a folder. */
export type NewFolder = Omit<FolderEntity, 'id' | 'createdAt' | 'updatedAt'>;

/** tags row (§4.3). */
export interface TagEntity {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

/** operations_history.operation_type CHECK constraint values (§4.5). */
export type OperationType =
  | 'merge'
  | 'split'
  | 'compress'
  | 'convert'
  | 'encrypt'
  | 'decrypt'
  | 'ocr'
  | 'watermark'
  | 'annotate'
  | 'resize';

/** operations_history.status lifecycle (§4.5). */
export type OperationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** operations_history row (§4.5). */
export interface OperationEntity {
  id: string;
  documentId?: string;
  operationType: OperationType;
  inputParamsJson?: string;
  outputDocumentId?: string;
  status: OperationStatus;
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
}

/** ai_conversations row (§4.6). */
export interface AiConversationEntity {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
}

/** ai_messages.role values (§4.7). */
export type AiMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** ai_messages row (§4.7). */
export interface AiMessageEntity {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content?: string;
  toolCallsJson?: string;
  toolCallId?: string;
  createdAt: string;
}
