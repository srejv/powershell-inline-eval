import type * as vscode from 'vscode';
import type { PowerShellContextSettings } from './configurationModel';
import type { PowerShellSessionLike } from './powershell/PowerShellSession';

export type SessionFactory = (
  outputChannel: vscode.OutputChannel,
  getSettings: () => PowerShellContextSettings
) => PowerShellSessionLike;

let sessionFactoryForTests: SessionFactory | undefined;

export function setSessionFactoryForTests(factory: SessionFactory): void {
  sessionFactoryForTests = factory;
}

export function clearSessionFactoryForTests(): void {
  sessionFactoryForTests = undefined;
}

export function getSessionFactoryForTests(): SessionFactory | undefined {
  return sessionFactoryForTests;
}
