let app;

try {
  app = require('../Backend/src/server');
} catch (err) {
  console.error('Failed to load server:', err);
}

module.exports = async (req, res) => {
  if (!app) {
    res.status(500).json({ error: 'Server failed to initialize', detail: 'Check function logs for require errors.' });
    return;
  }
  try {
    await app(req, res);
  } catch (err) {
    console.error('Request handler error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
