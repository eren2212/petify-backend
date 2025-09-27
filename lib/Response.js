const CustomError = require("./Error");
const Enum = require("../config/Enum");

class Response {
  static successResponse(code = 200, data) {
    return {
      code,
      data,
    };
  }

  static errorResponse(error) {
    if (error instanceof CustomError) {
      return {
        code: error.code,
        error: {
          message: error.message,
          description: error.description,
        },
      };
    }
    return {
      code: Enum.HTTP_CODES.INT_SERVER_ERROR,
      error: {
        message: "Unknown error",
        description: error.message,
      },
    };
  }
}
module.exports = Response;
