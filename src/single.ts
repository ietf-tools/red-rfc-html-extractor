import {
  fetchSourceRfcHtml,
  rfcBucketHtmlToRfcDocument
} from './red-rfc-html-extractor-shared/index.ts'
import { saveToS3 } from './s3.ts'

const main = async (rfcNumber: number): Promise<void> => {
  console.log(`Processing RFC ${rfcNumber}...`)
  try {
    const html = await fetchSourceRfcHtml(rfcNumber)
    if (html) {
      const rfcDoc = await rfcBucketHtmlToRfcDocument(html)
      await saveToS3(rfcNumber, JSON.stringify(rfcDoc))
      console.log(`Pushed RFC ${rfcNumber} to bucket successfully.`)
    } else {
      throw new Error(`Failed to fetch RFC ${rfcNumber} html.`)
    }
  } catch (err) {
    console.warn(
      `Failed to process RFC ${rfcNumber}: ${(err as Error).message}`
    )
  }
}

if (!process.argv[2]) {
  throw Error(
    `Script requires RFC Number arg but argv was ${JSON.stringify(process.argv)}`
  )
}

main(parseInt(process.argv[2], 10))
