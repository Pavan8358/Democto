import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export interface PresignedUrlRequest {
  bucket: string;
  key: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  expiresInSeconds?: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  expiresAt: Date;
}

export interface IS3Service {
  getPresignedUploadUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse>;
  deleteObject(bucket: string, key: string): Promise<void>;
}

export class AwsS3Service implements IS3Service {
  private readonly client: S3Client;

  constructor(options?: { region?: string; credentials?: { accessKeyId: string; secretAccessKey: string } }) {
    this.client = new S3Client({
      region: options?.region ?? process.env.AWS_REGION ?? "us-east-1",
      credentials: options?.credentials ?? (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : undefined)
    });
  }

  async getPresignedUploadUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const expires = request.expiresInSeconds ?? 900;
    const command = new PutObjectCommand({
      Bucket: request.bucket,
      Key: request.key,
      ContentType: request.contentType,
      ContentLength: request.byteSize,
      ChecksumSHA256: request.checksumSha256
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expires });
    const expiresAt = new Date(Date.now() + expires * 1000);
    return { uploadUrl, expiresAt };
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await this.client.send(command);
  }
}

export class MockS3Service implements IS3Service {
  private readonly objects = new Map<string, Buffer>();
  public readonly deletedKeys: string[] = [];

  async getPresignedUploadUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const token = crypto.randomUUID();
    const uploadUrl = `https://mock-s3/${request.bucket}/${encodeURIComponent(request.key)}?token=${token}`;
    const expiresAt = new Date(Date.now() + (request.expiresInSeconds ?? 900) * 1000);
    return { uploadUrl, expiresAt };
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    this.deletedKeys.push(`${bucket}/${key}`);
  }
}

export const createS3ServiceFromEnv = (): IS3Service => {
  if (process.env.MOCK_S3 === "true" || !process.env.AWS_ACCESS_KEY_ID) {
    return new MockS3Service();
  }
  return new AwsS3Service();
};
