const multer = require('multer');

/**
 * Global error handler — catches all unhandled errors.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    user: req.user?.id,
  });

  // Multer file upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  // Multer filter rejection
  if (err.message && err.message.includes('Only')) {
    return res.status(400).json({ error: err.message });
  }

  // Operational errors (our custom errors)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Joi validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details?.map((d) => d.message) || [err.message],
    });
  }

  // Supabase errors
  if (err.code && err.message) {
    return res.status(400).json({
      error: err.message,
    });
  }

  // Unknown errors
  res.status(500).json({
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error',
  });
};

module.exports = { errorHandler };
