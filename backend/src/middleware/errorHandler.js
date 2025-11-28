// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.code || 'INTERNAL_ERROR';

  // MySQL specific errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Duplicate entry. Resource already exists.';
    errorCode = 'DUPLICATE_ENTRY';

    // Extract field name from error message
    if (err.message.includes('email')) {
      message = 'Email already exists';
    } else if (err.message.includes('isbn')) {
      message = 'ISBN already exists';
    } else if (err.message.includes('member_id')) {
      message = 'Member ID already exists';
    }
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced resource not found';
    errorCode = 'REFERENCE_ERROR';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }

  // Joi validation errors
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    errorCode = 'VALIDATION_ERROR';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: message,
    error: {
      code: errorCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// Not found handler
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: { code: 'NOT_FOUND' }
  });
};

module.exports = {
  errorHandler,
  notFound
};
