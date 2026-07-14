import { execFile } from 'node:child_process';
import { platform } from 'node:os';

/**
 * Open a native OS folder-selection dialog and resolve with the chosen
 * absolute path, or `null` if the user cancelled.
 *
 * This runs on the server machine. For a local dev tool the server runs on the
 * user's machine, so the dialog appears in front of them and we receive a real
 * absolute path — something a browser cannot provide.
 */
export function selectFolder(): Promise<string | null> {
  const os = platform();
  if (os === 'win32') return selectWindows();
  if (os === 'darwin') return selectMac();
  return selectLinux();
}

type ExecResult = { error: Error | null; stdout: string; stderr: string };

function exec(cmd: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { maxBuffer: 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          error: error ?? null,
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
        });
      },
    );
  });
}

function isEnoent(e: Error | null): boolean {
  return !!e && (e as NodeJS.ErrnoException).code === 'ENOENT';
}

async function selectWindows(): Promise<string | null> {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$d.Description = 'Select workspace folder'",
    '$d.ShowNewFolderButton = $true',
    'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.SelectedPath }',
  ].join('\n');
  const r = await exec('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (r.error) {
    if (isEnoent(r.error)) throw new Error('powershell is not available');
    throw new Error(r.stderr || r.error.message);
  }
  return r.stdout.length ? r.stdout : null;
}

async function selectMac(): Promise<string | null> {
  const script =
    'set theFolder to choose folder with prompt "Select workspace folder"\nPOSIX path of theFolder';
  const r = await exec('osascript', ['-e', script]);
  if (r.error) {
    const msg = (r.stderr || r.error.message || '').toLowerCase();
    if (msg.includes('user canceled') || msg.includes('error number -128')) return null;
    if (isEnoent(r.error)) throw new Error('osascript is not available');
    throw new Error(r.stderr || r.error.message);
  }
  return r.stdout.length ? r.stdout : null;
}

async function selectLinux(): Promise<string | null> {
  const zenity = await exec('zenity', [
    '--file-selection',
    '--directory',
    '--title=Select workspace folder',
  ]);
  if (!zenity.error) return zenity.stdout.length ? zenity.stdout : null;
  if (isEnoent(zenity.error)) {
    const kdialog = await exec('kdialog', [
      '--getexistingdirectory',
      '.',
      'Select workspace folder',
    ]);
    if (!kdialog.error) return kdialog.stdout.length ? kdialog.stdout : null;
    if (isEnoent(kdialog.error)) {
      throw new Error('No folder dialog available (install zenity or kdialog)');
    }
    return null; // kdialog cancelled
  }
  return null; // zenity cancelled
}
