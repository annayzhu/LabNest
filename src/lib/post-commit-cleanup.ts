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
) {
  const warnings: string[] = [];
  for (const task of tasks) {
    try {
      await task.run();
    } catch (error) {
      warnings.push(`${task.name} is pending retry.`);
      console.error(`[post-commit cleanup] ${task.name} failed`, error);
      await onFailure(task.name, error).catch((logError) => {
        console.error(`[post-commit cleanup] failed to log ${task.name}`, logError);
      });
    }
  }
  return warnings;
}

export function cleanupErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
