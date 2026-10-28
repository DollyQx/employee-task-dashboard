/**
 * tasks.js — API helpers
 *
 * Fetches tasks from two separate mock REST API endpoints in parallel,
 * merges them into a single array, and returns them sorted by priority.
 *
 * Note: Both endpoints are MOCK integrations backed by the local Express
 * server — they do NOT call real external CRM or Helpdesk systems.
 */

import { prioritize } from '../utils/prioritize.js';

const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.replace(/\/+$/, '');
const BASE_URL = configuredBaseUrl
  ? `${configuredBaseUrl.replace(/\/api$/, '')}/api`
  : (import.meta.env?.DEV ? '/api' : null);
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Fetches from a single endpoint and returns the tasks array.
 * Throws a descriptive error if the request fails.
 */
async function fetchSource(baseUrl, endpoint, sourceName, fetchImpl, timeoutMs) {
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured for this deployment.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}${endpoint}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`${sourceName} API returned ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`);
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`${sourceName} API returned an invalid JSON response.`);
    }
    if (!data || !Array.isArray(data.tasks)) {
      throw new Error(`${sourceName} API response did not contain a tasks array.`);
    }
    if (data.tasks.some((task) => !task || typeof task !== 'object' || Array.isArray(task))) {
      throw new Error(`${sourceName} API response contained an invalid task record.`);
    }
    const stringFields = ['id', 'title', 'employee', 'status', 'deadline', 'urgency', 'source', 'sourceUrl'];
    if (data.tasks.some((task) => stringFields.some((field) => task[field] != null && typeof task[field] !== 'string'))) {
      throw new Error(`${sourceName} API response contained task fields with invalid types.`);
    }
    return data.tasks;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${sourceName} API request timed out after ${timeoutMs / 1000} seconds.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`${sourceName} API could not be reached. Check the network connection and CORS configuration.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches CRM and Helpdesk tasks in parallel, merges them,
 * and returns a priority-sorted combined list.
 */
export async function fetchAllTasks({ baseUrl = BASE_URL, fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  // Run both requests at the same time — no reason to wait for one before starting the other
  const [crmTasks, helpdeskTasks] = await Promise.all([
    fetchSource(baseUrl, '/crm/tasks', 'CRM', fetchImpl, timeoutMs),
    fetchSource(baseUrl, '/helpdesk/tasks', 'Helpdesk', fetchImpl, timeoutMs),
  ]);

  const combined = [...crmTasks, ...helpdeskTasks];
  return prioritize(combined);
}
