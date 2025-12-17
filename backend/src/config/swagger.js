const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Base URL helper
const buildServerUrl = () => {
  if (process.env.SWAGGER_BASE_URL) return process.env.SWAGGER_BASE_URL;
  if (process.env.CLOUD_RUN_SERVICE_URL) return process.env.CLOUD_RUN_SERVICE_URL;
  return `http://localhost:${process.env.PORT || 8080}`;
};

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ITERARY API',
      version: '1.0.0',
      description: 'ITERARY - Library Management System (Express + MySQL)',
    },
    servers: [
      { url: buildServerUrl() }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin@itera.ac.id' },
            password: { type: 'string', example: 'admin123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer', example: 1 },
                    username: { type: 'string', example: 'admin@itera.ac.id' },
                    role: { type: 'string', example: 'admin' }
                  }
                }
              }
            }
          }
        },
        Book: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            isbn: { type: 'string', example: '978-602-032-1234' },
            title: { type: 'string', example: 'Pengantar Teknologi Informasi' },
            author: { type: 'string', example: 'John Doe' },
            category: { type: 'string', example: 'Teknologi' },
            available_copies: { type: 'integer', example: 3 },
            total_copies: { type: 'integer', example: 5 }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Invalid credentials' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login admin',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' }
              }
            }
          },
          responses: {
            200: {
              description: 'Login sukses',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' }
                }
              }
            },
            401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/books': {
        get: {
          tags: ['Books'],
          summary: 'List buku (search, filter, pagination)',
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', example: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', example: 20 } },
            { in: 'query', name: 'search', schema: { type: 'string', example: 'database' } },
            { in: 'query', name: 'category', schema: { type: 'string', example: 'Teknologi' } }
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          books: { type: 'array', items: { $ref: '#/components/schemas/Book' } },
                          pagination: {
                            type: 'object',
                            properties: {
                              page: { type: 'integer' },
                              limit: { type: 'integer' },
                              total: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/books/{id}': {
        get: {
          tags: ['Books'],
          summary: 'Detail buku',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 } }],
          responses: {
            200: {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Book' } } }
            },
            404: { description: 'Book not found' }
          }
        }
      },
      '/api/borrowings': {
        get: {
          tags: ['Borrowings'],
          summary: 'List peminjaman (admin)',
          responses: {
            200: { description: 'OK' },
            401: { description: 'Unauthorized' }
          }
        },
        post: {
          tags: ['Borrowings'],
          summary: 'Create peminjaman (member)',
          responses: {
            200: { description: 'OK' },
            401: { description: 'Unauthorized' }
          }
        }
      },
      '/api/stats': {
        get: {
          tags: ['Stats'],
          summary: 'Dashboard stats (admin)',
          responses: {
            200: { description: 'OK' },
            401: { description: 'Unauthorized' }
          }
        }
      }
    }
  },
  apis: [] // We define paths inline; add route JSDoc here if needed.
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };
