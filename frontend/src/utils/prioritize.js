import { daysFromToday } from './taskMetrics.js';

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
 * Computes a priority score for a single task object.
 */
export function computeScore(task, now = new Date()) {
  const urgencyScore = URGENCY_SCORE[task.urgency] ?? 5;
  const days = daysFromToday(task.deadline, now);

  let deadlineScore;
  if (days !== null && days < 0) {
    deadlineScore = 50; // overdue
  } else if (days === 0) {
    deadlineScore = 30; // due today
  } else if (days !== null && days <= 3) {
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
export function prioritize(tasks, now = new Date()) {
  return tasks
    .map((task) => ({
      ...task,
      score: computeScore(task, now),
      daysFromToday: daysFromToday(task.deadline, now),
    }))
    .sort((a, b) => b.score - a.score);
}
