import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const localBinary = new URL('../.tools/livekit/livekit-server.exe', import.meta.url);
const { fileURLToPath } = await import('node:url');
const executable = process.platform === 'win32' && existsSync(localBinary) ? fileURLToPath(localBinary) : 'livekit-server';
const child = spawn(executable, ['--dev', '--bind', '127.0.0.1', '--node-ip', '127.0.0.1', '--rtc.enable_loopback_candidate', '--logging.level', 'info'], { stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(`Could not start LiveKit: ${error.message}`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
