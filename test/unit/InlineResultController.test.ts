import * as assert from 'node:assert/strict';
import Module = require('node:module');

type ModuleLoad = (request: string, parent: NodeModule | null, isMain: boolean) => unknown;
type PatchedModule = typeof Module & { _load: ModuleLoad };

describe('InlineResultController', () => {
  it('uses open range behavior so inline results stay anchored when typing at line end', () => {
    const createdOptions: Array<{ rangeBehavior?: string }> = [];
    const moduleWithLoad = Module as PatchedModule;
    const originalLoad = moduleWithLoad._load;
    const inlineResultControllerModulePath = require.resolve('../../src/ui/InlineResultController');
    const fakeVscode = {
      window: {
        createTextEditorDecorationType: (options: { rangeBehavior?: string }) => {
          createdOptions.push(options);
          return {
            dispose: () => {}
          };
        }
      },
      ThemeColor: class ThemeColor {
        constructor(public readonly value: string) {}
      },
      DecorationRangeBehavior: {
        OpenOpen: 'OpenOpen'
      }
    };

    moduleWithLoad._load = ((
      request: string,
      parent: NodeModule | null,
      isMain: boolean
    ) => {
      if (request === 'vscode') {
        return fakeVscode;
      }

      return originalLoad(request, parent, isMain);
    }) as ModuleLoad;

    try {
      delete require.cache[inlineResultControllerModulePath];
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { InlineResultController } = require('../../src/ui/InlineResultController') as typeof import('../../src/ui/InlineResultController');
      const controller = new InlineResultController();
      controller.dispose();
    } finally {
      moduleWithLoad._load = originalLoad;
      delete require.cache[inlineResultControllerModulePath];
    }

    assert.equal(createdOptions.length, 2);
    assert.equal(createdOptions[0].rangeBehavior, 'OpenOpen');
    assert.equal(createdOptions[1].rangeBehavior, 'OpenOpen');
  });
});