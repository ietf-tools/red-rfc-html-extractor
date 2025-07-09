import { fetchSourceRfcHtml, rfcBucketHtmlToRfcDocument } from './utils.ts'
import { saveToS3 } from './s3.ts'
import { setTimeout } from 'node:timers/promises'

const main = async (maxRfcNumber: number): Promise<void> => {
  for (let rfcNumber = 1; rfcNumber <= maxRfcNumber; rfcNumber++) {
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
      await setTimeout(100)
    } catch (err) {
      console.warn(`Failed to process ${rfcNumber}: ${(err as Error).message}`)
    }
  }
}

if (!process.argv[2]) {
  throw Error(`Script requires max RFC Number arg but argv was ${JSON.stringify(process.argv)}`)
}

main(parseInt(process.argv[2], 10))