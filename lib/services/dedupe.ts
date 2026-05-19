import type { TaskItem } from "@/lib/types";

export type DedupeResult = {
  duplicated: boolean;
  similarTaskIds: string[];
};

export function checkTaskSimilarity(candidate: string, existingTasks: TaskItem[]): DedupeResult {
  const normalizedCandidate = normalizeTaskText(candidate);
  const similarTaskIds = existingTasks
    .filter((task) => normalizeTaskText(task.promptContent) === normalizedCandidate)
    .map((task) => task.taskId);

  return {
    duplicated: similarTaskIds.length > 0,
    similarTaskIds,
  };
}

function normalizeTaskText(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}]/gu, "");
}
