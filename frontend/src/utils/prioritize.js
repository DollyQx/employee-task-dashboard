/**
 * prioritize.js
 *
 * Assigns a numeric priority score to each task and sorts the list
 * so the most urgent / most overdue tasks appear first.
 *
 * Score = urgencyScore + deadlineScore
 *
 * urgencyScore:
 *   high   → 30
 *   medium → 15
 *   low    →  5
 *
 * deadlineScore (based on calendar days from today):
 *   overdue        (days < 0) → 50
 *   today          (days = 0) → 30
 *   within 3 days  (days ≤ 3) → 15
 *   future                    →  0
 *
 * Max possible score = 80 (high urgency + overdue) → always at the top.
 * Min possible score =  5 (low urgency + future deadline) → sinks to bottom.
 */

const URGENCY_SCORE = {
  high: 30,
  medium: 15,
  low: 5,
};

/**
 * Returns the number of calendar days from today to a given deadline string.
 * Negative = overdue, 0 = today, positive = future.
 */
export function daysFromToday(deadlineStr) {
  const today = new Date();
  // Strip time component so comparison is purely date-based
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr + 'T00:00:00');
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((deadline - today) / msPerDay);
}

/**
 * Computes a priority score for a single task object.
 */
export function computeScore(task) {
  const urgencyScore = URGENCY_SCORE[task.urgency] ?? 5;
  const days = daysFromToday(task.deadline);

  let deadlineScore;
  if (days < 0) {
    deadlineScore = 50; // overdue
  } else if (days === 0) {
    deadlineScore = 30; // due today
  } else if (days <= 3) {
    deadlineScore = 15; // due within 3 days
  } else {
    deadlineScore = 0;  // future
  }

  return urgencyScore + deadlineScore;
}

/**
 * Adds a `score` and `daysFromToday` field to each task, then sorts
 * descending (highest score first).
 */
export function prioritize(tasks) {
  return tasks
    .map((task) => ({
      ...task,
      score: computeScore(task),
      daysFromToday: daysFromToday(task.deadline),
    }))
    .sort((a, b) => b.score - a.score);
}
