let app;

try {
  app = require('../Backend/src/server');
} catch (err) {
  console.error('Failed to load server:', err.message);
  console.error(err.stack);
}

module.exports = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/health') {
    res.status(200).json({ status: 'ok', appLoaded: !!app, node: process.version });
    return;
  }
  if (!app) {
    res.status(500).json({ error: 'Server failed to initialize', detail: 'See Vercel function logs for require errors.' });
    return;
  }
  try {
    app.handle(req, res);
  } catch (err) {
    console.error('Express handler error:', err.message);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
