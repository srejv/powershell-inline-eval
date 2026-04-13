import type { LineExecutionContext } from './commands/evaluateLineContext';
import type { SessionExecutionResult } from './types';

export interface EvaluationSnapshot {
  execution: LineExecutionContext;
  result: SessionExecutionResult;
}

let lastEvaluationSnapshot: EvaluationSnapshot | undefined;

export function setLastEvaluationSnapshot(snapshot: EvaluationSnapshot): void {
  lastEvaluationSnapshot = snapshot;
}

export function clearLastEvaluationSnapshot(): void {
  lastEvaluationSnapshot = undefined;
}

export function getLastEvaluationSnapshot(): EvaluationSnapshot | undefined {
  return lastEvaluationSnapshot;
}