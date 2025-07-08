import { S3Client, PutObjectCommand, PutObjectCommandOutput } from "@aws-sdk/client-s3"

const s3Cli = new S3Client({
  endpoint: process.env.S3_OUT_ENDPOINT ?? '',
  region: 'auto',
  credentials: {
    accessKeyId: process.env.S3_OUT_ACCESS_ID ?? '',
    secretAccessKey: process.env.S3_OUT_ACCESS_KEY ?? ''
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
})

export async function saveToS3 (rfcNumber: number, contents: string): Promise<PutObjectCommandOutput> {
  return s3Cli.send(new PutObjectCommand({
    Bucket: process.env.S3_OUT_BUCKET,
    Key: `rfc/${rfcNumber}.json`,
    Body: contents
  }))
}
