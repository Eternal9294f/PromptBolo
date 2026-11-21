import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve frontend static files
const clientDistCandidates = [
  path.resolve(process.cwd(), "artifacts/promptbolo/dist/public"),
  path.resolve(__dirname, "../../promptbolo/dist/public"),
  path.resolve(__dirname, "../promptbolo/dist/public"),
];
const clientDistPath = clientDistCandidates.find((dir) => fs.existsSync(dir));

if (clientDistPath) {
  logger.info({ clientDistPath }, "Serving frontend static assets");
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.resolve(clientDistPath, "index.html"));
    }
    next();
  });
}

export default app;
