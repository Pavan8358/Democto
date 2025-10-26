import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

let cachedClient: S3Client | null = null;

function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: env.S3_BUCKET_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      sessionToken: env.AWS_SESSION_TOKEN
    }
  });

  return cachedClient;
}

export type SignedUploadRequest = {
  key: string;
  contentType: string;
  metadata?: Record<string, string | undefined>;
};

export type SignedUploadResponse = {
  url: string;
  headers: Record<string, string>;
};

export async function createSignedUpload(request: SignedUploadRequest): Promise<SignedUploadResponse> {
  const client = getClient();

  const metadataEntries = Object.entries(request.metadata ?? {}).filter(([, value]) => typeof value === "string");
  const metadata = Object.fromEntries(metadataEntries) as Record<string, string>;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: request.key,
    ContentType: request.contentType,
    Metadata: metadata
  });

  const url = await getSignedUrl(client, command, { expiresIn: env.S3_SIGNED_URL_TTL });

  const headers: Record<string, string> = {
    "Content-Type": request.contentType
  };

  metadataEntries.forEach(([key, value]) => {
    if (value) {
      headers[`x-amz-meta-${key}`] = value;
    }
  });

  return {
    url,
    headers
  };
}
