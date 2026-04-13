import * as vscode from 'vscode';
import { SETTINGS_SECTION } from './constants';
import {
  toPowerShellContextSettings,
  type OutputChannelAutoOpenMode,
  type PowerShellContextSettings,
  type PowerShellExecutablePreference,
  type PreviewPanelAutoOpenMode
} from './configurationModel';

export type {
  OutputChannelAutoOpenMode,
  PowerShellContextSettings,
  PowerShellExecutablePreference,
  PreviewPanelAutoOpenMode
};

export function getPowerShellContextSettings(): PowerShellContextSettings {
  return toPowerShellContextSettings(vscode.workspace.getConfiguration(SETTINGS_SECTION));
}
