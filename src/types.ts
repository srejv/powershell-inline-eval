export type SessionOutputKind = 'empty' | 'scalar' | 'dictionary' | 'object' | 'collection';

export interface SessionOutputMetadata {
  kind: SessionOutputKind;
  preview: string;
  itemCount: number;
}

export interface SessionExecutionResult {
  code: string;
  output: string;
  isError: boolean;
  durationMs: number;
  metadata?: SessionOutputMetadata;
}

export interface InlinePresentation {
  text: string;
  revealOutputChannel: boolean;
}
