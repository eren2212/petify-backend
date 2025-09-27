class Response {
  static successResponse(code=200, data) {
        return{
            code,
            data
        }
  }

  static errorResponse(code, message) {
    return{
        code,
        error:{
            message:error.message,
            description:error.description
        }
    }
  }
}

module.exports = Response;