import { fetchSourceRfcHtml, rfcBucketHtmlToRfcDocument } from './red-rfc-html-extractor-shared/index.ts'
import { saveToS3 } from './s3.ts'
import { setTimeout } from 'node:timers/promises'

const main = async (minRfcNumber: number, maxRfcNumber: number): Promise<void> => {
  for (let rfcNumber = minRfcNumber; rfcNumber <= maxRfcNumber; rfcNumber++) {
    console.log(`Processing RFC ${rfcNumber}...`)
    try {
      const html = await fetchSourceRfcHtml(rfcNumber)
      if (html) {
        const rfcDoc = await rfcBucketHtmlToRfcDocument(html)
        await saveToS3(rfcNumber, JSON.stringify(rfcDoc))
        console.log(`Pushed RFC ${rfcNumber} to bucket successfully.`)
      } else {
        console.log(`Failed to fetch RFC ${rfcNumber}, skipping...`)
        continue
      }
      await setTimeout(80)
    } catch (err) {
      console.warn(`Failed to process ${rfcNumber}: ${(err as Error).message}`)
    }
  }
}

if (!process.argv[2] || !process.argv[3]) {
  throw Error(`Script requires min and max RFC Number args but argv was ${JSON.stringify(process.argv)}`)
}

main(parseInt(process.argv[2], 10), parseInt(process.argv[3], 10))