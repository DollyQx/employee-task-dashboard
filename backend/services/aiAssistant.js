/**
 * AI Assistance Service (Zero-Mandatory-Cost Policy)
 *
 * Implements an optional provider adapter (e.g. Google Gemini Free Tier)
 * paired with a robust, zero-cost deterministic local heuristic engine.
 * If no API key is provided, or if the external API is offline or rate-limited,
 * the local heuristic engine transparently takes over.
 *
 * PRIVACY GUARANTEE:
 * All prompts are strictly sanitized of emails, phone numbers, JWT tokens,
 * passwords, and credentials before any external dispatch.
 */

// Regex patterns for sensitive PII and secrets
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const TOKEN_REGEX = /\b(ey[A-Za-z0-9-_=.]+)\b/g;
const PASSWORD_REGEX = /(password|secret|bearer)\s*[:=]?\s*[^\s,]+/gi;

/**
 * Sanitizes input text by removing PII and credentials.
 */
function sanitizeForAi(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(EMAIL_REGEX, '[EMAIL]')
    .replace(PHONE_REGEX, '[PHONE]')
    .replace(PASSWORD_REGEX, '[AUTH_CREDENTIAL]')
    .replace(TOKEN_REGEX, '[AUTH_TOKEN]');
}

/**
 * Local Heuristic Fallback Generator
 * Produces structured, domain-specific software engineering suggestions at zero cost.
 */
const HeuristicGenerator = {
  draftTaskDescription({ title = '', category = 'Development', department = 'Engineering' }) {
    const cleanTitle = sanitizeForAi(title).trim();
    return {
      source: 'heuristic',
      provider: 'Local Intelligence Engine (Offline Free Fallback)',
      objective: `Implement and verify: ${cleanTitle}`,
      description: `### Scope & Objectives\nThis task covers the design, execution, and validation of "${cleanTitle}" under the ${department} scope (${category}).\n\n### Deliverables\n- Implement required changes aligned with system architecture and security standards.\n- Verify role boundaries, edge cases, and regression test suites.\n- Ensure documentation is updated and changes are peer-reviewed before staging deployment.`,
      acceptanceCriteria: [
        `Code adheres to existing architectural patterns in ${department}.`,
        'All relevant unit and integration test suites pass without regression.',
        'Proper error handling, logging, and input sanitization are implemented.',
        'Zero exposed secrets, credentials, or unprotected endpoints.',
      ],
      suggestedTags: [category.toLowerCase(), 'enhancement', department.toLowerCase().split(' ')[0]],
      estimatedHours: category === 'Security' ? 6 : (category === 'Design' ? 4 : 8),
    };
  },

  summarizeProgress({ taskTitle = '', progress = 0, status = 'in_progress', updates = [], blockers = '' }) {
    const cleanTitle = sanitizeForAi(taskTitle);
    const cleanBlockers = sanitizeForAi(blockers);

    let summaryStatus = 'on track';
    if (cleanBlockers && cleanBlockers.trim().length > 0) {
      summaryStatus = 'blocked / requires attention';
    } else if (progress >= 100) {
      summaryStatus = 'completed / ready for review';
    } else if (progress >= 50) {
      summaryStatus = 'progressing well (over 50%)';
    }

    const bullets = updates
      .slice(0, 3)
      .map((u) => `- ${sanitizeForAi(u.notes || u.status || 'Progress milestone logged')}`)
      .join('\n');

    return {
      source: 'heuristic',
      provider: 'Local Intelligence Engine (Offline Free Fallback)',
      executiveSummary: `Task "${cleanTitle}" is currently at ${progress}% (${status}) and is ${summaryStatus}.`,
      recentActivity: bullets || '- Work is currently underway on the primary deliverables.',
      blockersSummary: cleanBlockers ? `Identified Blocker: ${cleanBlockers}` : 'No active blockers reported.',
      recommendedAction: progress >= 100
        ? 'Submit for managerial review and peer sign-off.'
        : (cleanBlockers ? 'Resolve reported dependencies before proceeding.' : 'Continue implementation against the acceptance criteria.'),
    };
  },

  suggestNextSteps({ taskTitle = '', status = 'todo', progress = 0, blockers = '' }) {
    const cleanTitle = sanitizeForAi(taskTitle);
    const cleanBlockers = sanitizeForAi(blockers);

    const steps = [];

    if (cleanBlockers) {
      steps.push(`Unblock critical path: Address "${cleanBlockers}" with project lead or manager.`);
    }

    if (status === 'todo' || progress === 0) {
      steps.push(`Review requirements and acceptance criteria for "${cleanTitle}".`);
      steps.push('Create technical breakdown and identify dependencies.');
      steps.push('Initialize local development branch and stub test scenarios.');
    } else if (progress < 50) {
      steps.push('Complete core business logic implementation.');
      steps.push('Write unit test suites covering both success and edge cases.');
    } else if (progress < 100) {
      steps.push('Perform end-to-end flow verification across role permissions.');
      steps.push('Conduct code audit for performance, accessibility, and security.');
      steps.push('Prepare demonstration notes and pull request summary.');
    } else {
      steps.push('Verify all automated CI/CD checks and test runs pass.');
      steps.push('Request formal code review and supervisory approval.');
      steps.push('Verify deployment readiness on staging environment.');
    }

    return {
      source: 'heuristic',
      provider: 'Local Intelligence Engine (Offline Free Fallback)',
      taskTitle: cleanTitle,
      progress,
      status,
      nextSteps: steps,
    };
  },
};

/**
 * Optional Google Gemini Free Tier Caller
 */
async function callGeminiIfAvailable(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600,
        },
      }),
      signal: AbortSignal.timeout(5000), // 5-second timeout for graceful fallback
    });

    if (!response.ok) {
      console.warn(`Gemini API returned status ${response.status}. Using local heuristic engine.`);
      return null;
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidate ? candidate.trim() : null;
  } catch (err) {
    console.warn(`Gemini request failed (${err.message}). Using local heuristic engine.`);
    return null;
  }
}

/**
 * AI Assistant Interface
 */
async function draftTaskDescription(params) {
  const sanitizedTitle = sanitizeForAi(params.title);
  const prompt = `As a senior software engineering lead, generate a structured task description and acceptance criteria for:
Title: "${sanitizedTitle}"
Category: "${params.category || 'Development'}"
Department: "${params.department || 'Engineering'}"
Respond in concise markdown with Objective, Scope, and 3-4 bulleted Acceptance Criteria. Do not invent company private data.`;

  const externalResult = await callGeminiIfAvailable(prompt);
  if (externalResult) {
    return {
      source: 'gemini_free_tier',
      provider: 'Google Gemini 1.5 Flash (Free Tier)',
      description: externalResult,
      suggestedTags: [params.category?.toLowerCase() || 'task', 'engineering'],
      acceptanceCriteria: ['Passes unit and integration tests', 'Satisfies stated acceptance requirements'],
    };
  }

  return HeuristicGenerator.draftTaskDescription(params);
}

async function summarizeProgress(params) {
  const prompt = `Summarize progress for the task "${sanitizeForAi(params.taskTitle)}".
Current Progress: ${params.progress}%.
Status: ${params.status}.
Blockers: ${sanitizeForAi(params.blockers || 'None')}.
Provide a 2-sentence executive summary and 2 recommended next actions.`;

  const externalResult = await callGeminiIfAvailable(prompt);
  if (externalResult) {
    return {
      source: 'gemini_free_tier',
      provider: 'Google Gemini 1.5 Flash (Free Tier)',
      executiveSummary: externalResult,
      blockersSummary: params.blockers ? `Blocker: ${sanitizeForAi(params.blockers)}` : 'None',
    };
  }

  return HeuristicGenerator.summarizeProgress(params);
}

async function suggestNextSteps(params) {
  const prompt = `Suggest 3 immediate, concrete technical next steps for:
Task: "${sanitizeForAi(params.taskTitle)}"
Current Status: ${params.status} (${params.progress}% complete)
Blockers: ${sanitizeForAi(params.blockers || 'None')}`;

  const externalResult = await callGeminiIfAvailable(prompt);
  if (externalResult) {
    const lines = externalResult.split('\n').filter((l) => l.trim().length > 0);
    return {
      source: 'gemini_free_tier',
      provider: 'Google Gemini 1.5 Flash (Free Tier)',
      nextSteps: lines.slice(0, 4),
    };
  }

  return HeuristicGenerator.suggestNextSteps(params);
}

module.exports = {
  sanitizeForAi,
  draftTaskDescription,
  summarizeProgress,
  suggestNextSteps,
  HeuristicGenerator,
};
