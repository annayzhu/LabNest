export type PostCommitCleanupTask = {
  name: string;
  run: () => Promise<void>;
};

/**
 * Runs cleanup after a database mutation has committed. A cleanup failure must
 * never turn the truthful committed response into a false API failure; callers
 * receive warnings and can persist a retry/audit record through onFailure.
 */
export async function runPostCommitCleanup(
  tasks: PostCommitCleanupTask[],
  onFailure: (taskName: string, error: unknown) => Promise<void>,
  options: { attempts?: number; retryDelayMs?: number } = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 40);
  const warnings: string[] = [];
  for (const task of tasks) {
    let unresolved: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await task.run();
        unresolved = undefined;
        break;
      } catch (error) {
        unresolved = error;
        if (attempt < attempts && retryDelayMs) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
    if (unresolved !== undefined) {
      warnings.push(`${task.name} failed after ${attempts} attempts; manual cleanup is required.`);
      console.error(`[post-commit cleanup] ${task.name} failed after ${attempts} attempts`, unresolved);
      await onFailure(task.name, unresolved).catch((logError) => {
        console.error(`[post-commit cleanup] failed to log ${task.name}`, logError);
      });
    }
  }
  return warnings;
}

export function cleanupErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
