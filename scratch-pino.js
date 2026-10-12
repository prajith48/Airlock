import pino from "pino";
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { destination: 2 }
  }
});
logger.info("This should go to stderr");
