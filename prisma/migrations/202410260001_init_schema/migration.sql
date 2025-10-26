-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PROCTOR', 'REVIEWER', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "ExamSessionStatus" AS ENUM ('SCHEDULED', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FLAGGED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RecordingType" AS ENUM ('WEBCAM', 'SCREEN', 'AUDIO', 'MANIFEST');

-- CreateEnum
CREATE TYPE "MediaChunkStatus" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "FlagEventType" AS ENUM ('IDENTITY_MISMATCH', 'MULTIPLE_PEOPLE', 'NO_FACE_DETECTED', 'SUSPICIOUS_AUDIO', 'SCREEN_SWITCH', 'BROWSER_ACTIVITY', 'NETWORK_INSTABILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_USE', 'PRIVACY_POLICY', 'RECORDING_NOTICE', 'DATA_SHARING');

-- CreateEnum
CREATE TYPE "IdImageType" AS ENUM ('DOCUMENT_FRONT', 'DOCUMENT_BACK', 'SELFIE', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "oauth_token_secret" TEXT,
    "oauth_token" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "requirements" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "candidateId" TEXT,
    "proctorId" TEXT,
    "status" "ExamSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledStart" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "flaggedAt" TIMESTAMP(3),
    "candidateName" TEXT,
    "candidateEmail" TEXT,
    "candidateExternalId" TEXT,
    "candidatePhone" TEXT,
    "timezone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "RecordingType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "uri" TEXT,
    "durationMs" INTEGER,
    "sizeBytes" BIGINT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaChunk" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "status" "MediaChunkStatus" NOT NULL DEFAULT 'PENDING',
    "byteSize" INTEGER,
    "checksum" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlagEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordingId" TEXT,
    "mediaChunkId" TEXT,
    "type" "FlagEventType" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlagEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "ConsentType" NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdImage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "IdImageType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "blurHash" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "examId" TEXT,
    "sessionId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "ExamSession_examId_status_idx" ON "ExamSession"("examId", "status");

-- CreateIndex
CREATE INDEX "ExamSession_candidateEmail_idx" ON "ExamSession"("candidateEmail");

-- CreateIndex
CREATE INDEX "Recording_session_type_idx" ON "Recording"("sessionId", "type");

-- CreateIndex
CREATE INDEX "MediaChunk_recording_status_idx" ON "MediaChunk"("recordingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaChunk_recording_index_key" ON "MediaChunk"("recordingId", "index");

-- CreateIndex
CREATE INDEX "FlagEvent_session_createdAt_idx" ON "FlagEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_session_type_key" ON "Consent"("sessionId", "type");

-- CreateIndex
CREATE INDEX "IdImage_session_capturedAt_idx" ON "IdImage"("sessionId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdImage_session_type_key" ON "IdImage"("sessionId", "type");

-- CreateIndex
CREATE INDEX "AuditLog_target_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_proctorId_fkey" FOREIGN KEY ("proctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaChunk" ADD CONSTRAINT "MediaChunk_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagEvent" ADD CONSTRAINT "FlagEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagEvent" ADD CONSTRAINT "FlagEvent_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagEvent" ADD CONSTRAINT "FlagEvent_mediaChunkId_fkey" FOREIGN KEY ("mediaChunkId") REFERENCES "MediaChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdImage" ADD CONSTRAINT "IdImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

