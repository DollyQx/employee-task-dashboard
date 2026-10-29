const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  draftTaskDescription,
  summarizeProgress,
  suggestNextSteps,
} = require('../services/aiAssistant');

function createAiRoutes() {
  const router = express.Router();
  router.use(requireAuth);

  // 1. Draft task description & acceptance criteria
  router.post('/draft-task', async (req, res) => {
    const { title, category, department } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    try {
      const result = await draftTaskDescription({
        title: title.trim(),
        category,
        department,
      });
      return res.json({ result });
    } catch (err) {
      console.error('AI draft task error:', err.message);
      return res.status(500).json({ error: 'Failed to draft task description.' });
    }
  });

  // 2. Summarize task progress notes
  router.post('/summarize-progress', async (req, res) => {
    const { taskTitle, progress = 0, status = 'in_progress', updates = [], blockers } = req.body || {};
    if (!taskTitle) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    try {
      const result = await summarizeProgress({
        taskTitle,
        progress: Number(progress) || 0,
        status,
        updates,
        blockers,
      });
      return res.json({ result });
    } catch (err) {
      console.error('AI summarize progress error:', err.message);
      return res.status(500).json({ error: 'Failed to summarize progress.' });
    }
  });

  // 3. Suggest next actionable steps
  router.post('/suggest-next-steps', async (req, res) => {
    const { taskTitle, status, progress = 0, blockers } = req.body || {};
    if (!taskTitle) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    try {
      const result = await suggestNextSteps({
        taskTitle,
        status,
        progress: Number(progress) || 0,
        blockers,
      });
      return res.json({ result });
    } catch (err) {
      console.error('AI next steps error:', err.message);
      return res.status(500).json({ error: 'Failed to generate next steps.' });
    }
  });

  return router;
}

module.exports = { createAiRoutes };
