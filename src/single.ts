import { processRfcBucketHtml } from './utils.ts'
import { saveToS3 } from './s3.ts'

const main = async (rfcNumber: number): Promise<void> => {
  const rfcBucketHtmlDocument = await processRfcBucketHtml(rfcNumber)

  await saveToS3(rfcNumber, JSON.stringify(rfcBucketHtmlDocument))
}

if (!process.argv[2]) {
  throw Error(`Script requires RFC Number arg but argv was ${JSON.stringify(process.argv)}`)
}

main(parseInt(process.argv[2], 10))
