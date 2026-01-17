const Iyzipay = require("iyzipay");
require("dotenv").config();

const iyzico = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: process.env.IYZICO_BASE_URL,
});

module.exports = iyzico;
