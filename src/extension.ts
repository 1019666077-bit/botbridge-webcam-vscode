import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';

/**
 * Bot Bridge Webcam
 *
 * A thin VS Code wrapper around the local webcam MCP server
 * (https://github.com/1019666077-bit/webcam_mcp). It registers an MCP server
 * definition with VS Code over stdio, using the same launch chain as the
 * Cursor plugin (https://github.com/1019666077-bit/webcam-bridge-plugin):
 *
 *   uv run --no-project --with <packageSpec> python <ext>/scripts/webcam_stdio.py
 *
 * Nothing is captured by this extension. Opened pixels, JPEG encoding and
 * camera release all happen in the local `webcam_mcp` process. No image ever
 * leaves the machine.
 */

const PROVIDER_ID = 'botbridge-webcam';
const SERVER_LABEL = 'Bot Bridge Webcam';
const CONFIG_SECTION = 'botbridge-webcam';
// Pinned to an immutable commit (the commit behind tag v0.2.0) so a moved tag
// cannot silently change the code this extension executes.
const DEFAULT_PACKAGE_SPEC =
  'git+https://github.com/1019666077-bit/webcam_mcp@35f60e7123bae2ac66491192bb92c5ab43ddc363';
const HOMEPAGE = 'https://botbridge.dev/webcam';
const UV_INSTALL_URL = 'https://docs.astral.sh/uv/getting-started/installation/';

let outputChannel: vscode.OutputChannel | undefined;

function output(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Bot Bridge Webcam');
  }
  return outputChannel;
}

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

function bootstrapScriptPath(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(path.join('scripts', 'webcam_stdio.py'));
}

/**
 * Reads a setting that influences the launched command from user/machine scope
 * only, ignoring any workspace or workspace-folder value. The matching settings
 * are declared with `"scope": "machine"`, but we ignore workspace values here
 * too so a cloned repository can never inject the executable or package this
 * extension runs.
 */
function machineSetting<T>(key: string, fallback: T): T {
  const info = config().inspect<T>(key);
  const value = info?.globalValue ?? info?.defaultValue;
  return value === undefined || value === null ? fallback : value;
}

function uvPath(): string {
  const value = String(machineSetting('uvPath', 'uv')).trim();
  return value.length > 0 ? value : 'uv';
}

function packageSpec(): string {
  const value = String(machineSetting('packageSpec', DEFAULT_PACKAGE_SPEC)).trim();
  return value.length > 0 ? value : DEFAULT_PACKAGE_SPEC;
}

/** Builds the stdio MCP server definition from the current settings. */
function buildServerDefinition(
  context: vscode.ExtensionContext,
  version: string,
): vscode.McpStdioServerDefinition {
  const cfg = config();
  const env: Record<string, string> = {
    // Read by scripts/webcam_stdio.py to build the ServerConfig.
    BB_WEBCAM_CAMERA_INDEX: String(cfg.get<number>('cameraIndex', 0)),
    BB_WEBCAM_PHOTO_WIDTH: String(cfg.get<number>('photoWidth', 1920)),
    BB_WEBCAM_PHOTO_HEIGHT: String(cfg.get<number>('photoHeight', 1080)),
    BB_WEBCAM_JPEG_QUALITY: String(cfg.get<number>('jpegQuality', 90)),
    PYTHONUNBUFFERED: '1',
  };

  const args = [
    'run',
    '--no-project',
    '--with',
    packageSpec(),
    'python',
    bootstrapScriptPath(context),
  ];

  return new vscode.McpStdioServerDefinition(SERVER_LABEL, uvPath(), args, env, version);
}

interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

function run(command: string, args: string[], timeoutMs = 20_000): Promise<RunResult> {
  return new Promise<RunResult>((resolve) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? ((error as { code: number }).code)
            : error
              ? 1
              : 0;
        resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr), code });
      },
    );
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const version = String(context.extension.packageJSON.version ?? '0.0.0');
  const didChange = new vscode.EventEmitter<void>();

  const provider: vscode.McpServerDefinitionProvider = {
    onDidChangeMcpServerDefinitions: didChange.event,
    provideMcpServerDefinitions: () => {
      if (!config().get<boolean>('enabled', true)) {
        return [];
      }
      return [buildServerDefinition(context, version)];
    },
    resolveMcpServerDefinition: async (server) => {
      const uv = uvPath();
      const probe = await run(uv, ['--version']);
      if (!probe.ok) {
        const choice = await vscode.window.showErrorMessage(
          `Bot Bridge Webcam could not find "uv" to start the local webcam MCP server. ` +
            `Install uv, or set "botbridge-webcam.uvPath" to its full path.`,
          'Install uv',
          'Open Settings',
        );
        if (choice === 'Install uv') {
          void vscode.env.openExternal(vscode.Uri.parse(UV_INSTALL_URL));
        } else if (choice === 'Open Settings') {
          void vscode.commands.executeCommand(
            'workbench.action.openSettings',
            CONFIG_SECTION,
          );
        }
        return undefined;
      }

      const script = bootstrapScriptPath(context);
      if (!fs.existsSync(script)) {
        void vscode.window.showErrorMessage(
          `Bot Bridge Webcam: bootstrap script is missing at ${script}. Reinstall the extension.`,
        );
        return undefined;
      }

      output().appendLine(
        `[start] ${uv} run --no-project --with ${packageSpec()} python ${script}`,
      );
      return server;
    },
  };

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, provider),
    didChange,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        didChange.fire();
      }
    }),
    vscode.commands.registerCommand('botbridge-webcam.checkEnvironment', () =>
      checkEnvironment(context, version),
    ),
    vscode.commands.registerCommand('botbridge-webcam.refresh', () => {
      didChange.fire();
      void vscode.window.showInformationMessage(
        'Bot Bridge Webcam: refreshed the MCP server definition. Open the MCP servers view to start it.',
      );
    }),
    vscode.commands.registerCommand('botbridge-webcam.openHomepage', () =>
      vscode.env.openExternal(vscode.Uri.parse(HOMEPAGE)),
    ),
  );
}

async function checkEnvironment(
  context: vscode.ExtensionContext,
  version: string,
): Promise<void> {
  const channel = output();
  channel.show(true);
  channel.appendLine('Bot Bridge Webcam — environment check');
  channel.appendLine(`  Extension version : ${version}`);
  channel.appendLine(`  VS Code           : ${vscode.version}`);
  channel.appendLine(`  Bootstrap script  : ${bootstrapScriptPath(context)}`);
  channel.appendLine(`  Homepage          : ${HOMEPAGE}`);

  const uv = uvPath();
  channel.appendLine(`  uv executable     : ${uv}`);
  const uvProbe = await run(uv, ['--version']);
  if (!uvProbe.ok) {
    channel.appendLine(
      `  ✗ uv is not runnable (${uvProbe.stderr.trim() || `exit ${uvProbe.code}`}).`,
    );
    channel.appendLine(`    Install uv: ${UV_INSTALL_URL}`);
    return;
  }
  channel.appendLine(`  ✓ ${uvProbe.stdout.trim()}`);

  const spec = packageSpec();
  channel.appendLine(`  Package spec      : ${spec}`);
  channel.appendLine('  Resolving webcam MCP and listing tools (first run may download dependencies)...');

  const probeScript = [
    'from webcam_mcp.server import create_server',
    'from webcam_mcp.config import ServerConfig',
    'from webcam_mcp import __version__',
    'import asyncio',
    'server = create_server(ServerConfig())',
    'tools = [t.name for t in asyncio.run(server.list_tools())]',
    'print(f"webcam_mcp {__version__} tools: {tools}")',
  ].join('; ');

  const probe = await run(
    uv,
    ['run', '--no-project', '--with', spec, 'python', '-c', probeScript],
    180_000,
  );
  if (probe.stdout.trim()) {
    channel.appendLine(`  ${probe.stdout.trim()}`);
  }
  if (probe.stderr.trim()) {
    channel.appendLine(`  [stderr] ${probe.stderr.trim()}`);
  }
  channel.appendLine(
    probe.ok
      ? '  ✓ webcam MCP is ready. Ask Copilot Chat for a photo; "Bot Bridge Webcam" appears in the MCP servers view.'
      : '  ✗ Could not start the webcam MCP server. See the output above.',
  );
}

export function deactivate(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}
