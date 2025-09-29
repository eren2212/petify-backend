const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Petfiy API",
      version: "1.0.0",
      description: "Pet management and veterinary appointment system API",
      contact: {
        name: "Petfiy Team",
        email: "info@petfiy.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Development server",
      },
      {
        url: "https://api.petfiy.com/api",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            code: {
              type: "integer",
              example: 400,
            },
            error: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  example: "Bad Request",
                },
                description: {
                  type: "string",
                  example: "Invalid input parameters",
                },
              },
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            code: {
              type: "integer",
              example: 200,
            },
            data: {
              type: "object",
              description: "Response data",
            },
          },
        },
      },
    },
  },
  apis: ["./routes/*.js"], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = specs;


