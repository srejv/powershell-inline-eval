import { DEFAULT_INLINE_OUTPUT_MAX_LENGTH } from '../constants';
import type { InlinePresentation, SessionOutputMetadata } from '../types';

const ELLIPSIS = '...';
const EMPTY_OUTPUT_LABEL = '(no output)';
const EMPTY_VALUE_LABEL = '(empty)';
const TABLE_MINIMUM_LINE_COUNT = 3;
const PROPERTY_LIST_MINIMUM_LINE_COUNT = 2;
const INLINE_PREVIEW_LINE_COUNT = 2;
const INLINE_PREVIEW_PROPERTY_COUNT = 3;

interface TableColumnRange {
  start: number;
  end: number;
}

export function formatInlineOutput(
  output: string,
  metadata?: SessionOutputMetadata,
  maxLength = DEFAULT_INLINE_OUTPUT_MAX_LENGTH
): InlinePresentation {
  const lines = getMeaningfulLines(output);

  if (shouldUseMetadataPreview(metadata, lines)) {
    return createBoundedPresentation(metadata.preview.trim(), maxLength, shouldRevealOutputChannel(metadata));
  }

  if (lines.length === 0) {
    return {
      text: EMPTY_OUTPUT_LABEL,
      revealOutputChannel: false
    };
  }

  const propertyListPresentation = tryFormatPropertyList(lines, maxLength);

  if (propertyListPresentation) {
    return propertyListPresentation;
  }

  const tablePresentation = tryFormatTable(lines, maxLength);

  if (tablePresentation) {
    return tablePresentation;
  }

  if (lines.length === 1) {
    return createBoundedPresentation(lines[0], maxLength, false);
  }

  return formatMultiLine(lines, maxLength);
}

function tryFormatPropertyList(lines: string[], maxLength: number): InlinePresentation | undefined {
  if (lines.length < PROPERTY_LIST_MINIMUM_LINE_COUNT) {
    return undefined;
  }

  const entries = lines.map(parsePropertyLine);

  if (entries.some(entry => entry === undefined)) {
    return undefined;
  }

  const definedEntries = entries.filter(isDefined);

  const previewEntries = definedEntries
    .slice(0, INLINE_PREVIEW_PROPERTY_COUNT)
    .map(entry => `${entry.name}: ${entry.value.length > 0 ? entry.value : EMPTY_VALUE_LABEL}`);
  const hasMoreEntries = definedEntries.length > INLINE_PREVIEW_PROPERTY_COUNT;
  const summary = `{ ${previewEntries.join(', ')}${hasMoreEntries ? ', ...' : ''} }`;

  return createBoundedPresentation(summary, maxLength, hasMoreEntries);
}

function tryFormatTable(lines: string[], maxLength: number): InlinePresentation | undefined {
  if (lines.length < TABLE_MINIMUM_LINE_COUNT) {
    return undefined;
  }

  const columnRanges = getTableColumnRanges(lines[1]);

  if (columnRanges.length === 0) {
    return undefined;
  }

  const headers = columnRanges.map(range => sliceRange(lines[0], range));

  if (headers.some(header => header.length === 0)) {
    return undefined;
  }

  const rowLines = lines.slice(2);
  const firstRow = rowLines[0];

  if (!firstRow) {
    return undefined;
  }

  const pairs = columnRanges.map((range, index) => {
    const value = sliceRange(firstRow, range);
    return `${headers[index]}=${value.length > 0 ? value : EMPTY_VALUE_LABEL}`;
  });
  const extraRowCount = Math.max(rowLines.length - 1, 0);
  const rowSuffix = extraRowCount > 0 ? ` (+${extraRowCount} more ${pluralize('row', extraRowCount)})` : '';

  return createBoundedPresentation(pairs.join(', ') + rowSuffix, maxLength, extraRowCount > 0);
}

function formatMultiLine(lines: string[], maxLength: number): InlinePresentation {
  const previewLines = lines.slice(0, INLINE_PREVIEW_LINE_COUNT);
  const extraLineCount = Math.max(lines.length - previewLines.length, 0);
  const summary = previewLines.join(' | ');
  const suffix = extraLineCount > 0 ? ` (+${extraLineCount} more ${pluralize('line', extraLineCount)})` : '';

  return createBoundedPresentation(summary + suffix, maxLength, true);
}

function createBoundedPresentation(
  text: string,
  maxLength: number,
  revealOutputChannel: boolean
): InlinePresentation {
  if (text.length <= maxLength) {
    return {
      text,
      revealOutputChannel
    };
  }

  return {
    text: truncate(text, maxLength),
    revealOutputChannel: true
  };
}

function getMeaningfulLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/\s{2,}/g, ' '));
}

function parsePropertyLine(line: string): { name: string; value: string } | undefined {
  const separatorIndex = line.indexOf(':');

  if (separatorIndex <= 0) {
    return undefined;
  }

  const name = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();

  if (name.length === 0) {
    return undefined;
  }

  return {
    name,
    value
  };
}

function getTableColumnRanges(separatorLine: string): TableColumnRange[] {
  const dashGroups = Array.from(separatorLine.matchAll(/-+/g));

  if (dashGroups.length === 0) {
    return [];
  }

  return dashGroups.map((group, index) => {
    const start = group.index ?? 0;
    const nextGroupStart = dashGroups[index + 1]?.index ?? Number.MAX_SAFE_INTEGER;

    return {
      start,
      end: nextGroupStart
    };
  });
}

function sliceRange(line: string, range: TableColumnRange): string {
  return line.slice(range.start, Math.min(range.end, line.length)).trim();
}

function truncate(text: string, maxLength: number): string {
  return `${text.slice(0, Math.max(maxLength - ELLIPSIS.length, 0))}${ELLIPSIS}`;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function shouldRevealOutputChannel(metadata: SessionOutputMetadata): boolean {
  return metadata.kind === 'collection' && metadata.itemCount > 1;
}

function shouldUseMetadataPreview(metadata: SessionOutputMetadata | undefined, lines: string[]): metadata is SessionOutputMetadata {
  if (!metadata?.preview.trim()) {
    return false;
  }

  const normalizedPreview = metadata.preview.trim();

  if (lines.length > 0 && (metadata.kind === 'empty' || normalizedPreview === EMPTY_OUTPUT_LABEL)) {
    return false;
  }

  return true;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
