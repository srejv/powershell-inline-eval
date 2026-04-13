import {
  DEFAULT_INLINE_OUTPUT_MAX_LENGTH,
  DEFAULT_OUTPUT_CHANNEL_AUTO_OPEN,
  DEFAULT_POWER_SHELL_EXECUTABLE_PREFERENCE,
  DEFAULT_PREVIEW_DEPTH,
  DEFAULT_PREVIEW_ITEM_LIMIT,
  DEFAULT_PREVIEW_PANEL_AUTO_OPEN,
  MAX_PREVIEW_DEPTH,
  MAX_PREVIEW_ITEM_LIMIT,
  MIN_INLINE_OUTPUT_MAX_LENGTH,
  MIN_PREVIEW_DEPTH,
  MIN_PREVIEW_ITEM_LIMIT
} from './constants';

export type OutputChannelAutoOpenMode = 'never' | 'errors' | 'expandedOutput' | 'always';
export type PreviewPanelAutoOpenMode = 'never' | 'structured' | 'expandedOutput' | 'always';
export type PowerShellExecutablePreference = 'auto' | 'pwsh' | 'powershell';

export interface PowerShellContextSettings {
  inlineOutputMaxLength: number;
  previewItemLimit: number;
  previewDepth: number;
  outputChannelAutoOpen: OutputChannelAutoOpenMode;
  previewPanelAutoOpen: PreviewPanelAutoOpenMode;
  powerShellExecutablePreference: PowerShellExecutablePreference;
}

export interface ConfigurationValueReader {
  get<T>(section: string): T | undefined;
}

export function toPowerShellContextSettings(configuration: ConfigurationValueReader): PowerShellContextSettings {
  return {
    inlineOutputMaxLength: clampInteger(
      configuration.get<number>('preview.inlineMaxLength'),
      DEFAULT_INLINE_OUTPUT_MAX_LENGTH,
      MIN_INLINE_OUTPUT_MAX_LENGTH,
      Number.MAX_SAFE_INTEGER
    ),
    previewItemLimit: clampInteger(
      configuration.get<number>('preview.itemLimit'),
      DEFAULT_PREVIEW_ITEM_LIMIT,
      MIN_PREVIEW_ITEM_LIMIT,
      MAX_PREVIEW_ITEM_LIMIT
    ),
    previewDepth: clampInteger(
      configuration.get<number>('preview.depth'),
      DEFAULT_PREVIEW_DEPTH,
      MIN_PREVIEW_DEPTH,
      MAX_PREVIEW_DEPTH
    ),
    outputChannelAutoOpen: readEnumValue(
      configuration.get<string>('outputChannel.autoOpen'),
      ['never', 'errors', 'expandedOutput', 'always'],
      DEFAULT_OUTPUT_CHANNEL_AUTO_OPEN
    ),
    previewPanelAutoOpen: readEnumValue(
      configuration.get<string>('previewPanel.autoOpen'),
      ['never', 'structured', 'expandedOutput', 'always'],
      DEFAULT_PREVIEW_PANEL_AUTO_OPEN
    ),
    powerShellExecutablePreference: readEnumValue(
      configuration.get<string>('powerShellExecutable'),
      ['auto', 'pwsh', 'powershell'],
      DEFAULT_POWER_SHELL_EXECUTABLE_PREFERENCE
    )
  };
}

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  const integerValue = value as number;
  return Math.min(Math.max(integerValue, minimum), maximum);
}

function readEnumValue<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  fallback: T
): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}
