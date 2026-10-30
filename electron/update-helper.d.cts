import type { ChildProcess } from 'node:child_process'
export interface UpdateConfig {
  userData: string
  parentPid: number
  token: string
  version: string
  appPath: string
  stagingRoot: string
  stagedApp: string
  backupPath: string
  receiptPath: string
  resultPath: string
}
export function validateConfig(config: unknown): void
export function runUpdate(
  config: UpdateConfig,
  ports?: {
    waitForExit?: (pid: number) => Promise<void>
    launch?: (path: string, args?: string[]) => Promise<ChildProcess>
    waitForReady?: (receipt: string, version: string, child: ChildProcess) => Promise<void>
    terminate?: (child: ChildProcess) => Promise<void>
  },
): Promise<boolean>
