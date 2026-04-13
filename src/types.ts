export interface SessionExecutionResult {
  code: string;
  output: string;
  isError: boolean;
  durationMs: number;
}

export interface InlinePresentation {
  text: string;
  revealOutputChannel: boolean;
}
