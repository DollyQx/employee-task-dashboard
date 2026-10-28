/**
 * tasks.js — API helpers
 *
 * Fetches tasks from two separate mock REST API endpoints in parallel,
 * merges them into a single array, and returns them sorted by priority.
 *
 * Note: Both endpoints are MOCK integrations backed by the local Express
 * server — they do NOT call real external CRM or Helpdesk systems.
 */

import { prioritize } from '../utils/prioritize';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');
const BASE_URL = configuredBaseUrl
  ? `${configuredBaseUrl}/api`
  : (import.meta.env.DEV ? '/api' : null);

/**
 * Fetches from a single endpoint and returns the tasks array.
 * Throws a descriptive error if the request fails.
 */
async function fetchSource(endpoint, sourceName) {
  if (!BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured for this deployment.');
  }

  const res = await fetch(`${BASE_URL}${endpoint}`);
  if (!res.ok) {
    throw new Error(`${sourceName} API returned ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  return data.tasks ?? [];
}

/**
 * Fetches CRM and Helpdesk tasks in parallel, merges them,
 * and returns a priority-sorted combined list.
 */
export async function fetchAllTasks() {
  // Run both requests at the same time — no reason to wait for one before starting the other
  const [crmTasks, helpdeskTasks] = await Promise.all([
    fetchSource('/crm/tasks', 'CRM'),
    fetchSource('/helpdesk/tasks', 'Helpdesk'),
  ]);

  const combined = [...crmTasks, ...helpdeskTasks];
  return prioritize(combined);
}
