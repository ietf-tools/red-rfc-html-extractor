import { fetchSourceRfcHtml, rfcBucketHtmlToRfcDocument } from './rfc-html.ts'
import { rfcBucketPdfToRfcDocument } from './rfc-pdf.ts'
import { rfcJSONPathBuilder, saveToS3 } from './utilities/s3.ts'

export const processRfc = async (rfcNumber: number): Promise<boolean> => {
  const html = await fetchSourceRfcHtml(rfcNumber)
  if (html !== null) {
    const rfcDoc = await rfcBucketHtmlToRfcDocument(html, rfcNumber)
    await saveToS3(rfcJSONPathBuilder(rfcNumber), JSON.stringify(rfcDoc))
    return true
  }

  console.log(' - trying PDF instead')
  // Some RFCs don't have HTML eg RFC418, so try PDF
  // Note that this will upload page images
  const rfcDoc = await rfcBucketPdfToRfcDocument(rfcNumber, true)
  if (rfcDoc) {
    await saveToS3(rfcJSONPathBuilder(rfcNumber), JSON.stringify(rfcDoc))
  }

  return false
}
