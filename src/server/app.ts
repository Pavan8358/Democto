import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { createDatabase, DatabaseConnection } from "./db";
import { ExamSessionRepository } from "./repositories/examSessionRepository";
import { MediaChunkRepository } from "./repositories/mediaChunkRepository";
import { RecordingRepository } from "./repositories/recordingRepository";
import { ExamSessionService } from "./services/examSessionService";
import { MediaChunkService } from "./services/mediaChunkService";
import { RecordingService } from "./services/recordingService";
import { createExamSessionRouter } from "./routes/examSessions";
import { createS3ServiceFromEnv, IS3Service } from "./services/s3Service";
import { RateLimiter } from "./util/rateLimiter";

export interface AppDependencies {
  database?: DatabaseConnection;
  s3Service?: IS3Service;
  bucketName?: string;
}

export const createApp = (deps: AppDependencies = {}) => {
  const database = deps.database ?? createDatabase();
  const s3Service = deps.s3Service ?? createS3ServiceFromEnv();
  const bucketName = deps.bucketName ?? process.env.MEDIA_RECORDING_BUCKET ?? "exam-media-recordings";

  const examSessionRepository = new ExamSessionRepository(database);
  const mediaChunkRepository = new MediaChunkRepository(database);
  const recordingRepository = new RecordingRepository(database);

  const examSessionService = new ExamSessionService(examSessionRepository);
  const mediaChunkService = new MediaChunkService(
    mediaChunkRepository,
    examSessionRepository,
    s3Service,
    new RateLimiter(60, 60_000),
    bucketName
  );
  const recordingService = new RecordingService(examSessionRepository, mediaChunkRepository, recordingRepository);

  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: "10mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/exam-sessions", createExamSessionRouter({
    examSessions: examSessionService,
    mediaChunks: mediaChunkService,
    recordings: recordingService
  }));

  return { app, services: { examSessionService, mediaChunkService, recordingService } };
};
