import { fetchSourceRfcHtml, rfcBucketHtmlToRfcDocument } from './rfc-html.ts'
import { rfcBucketPdfToRfcDocument } from './rfc-pdf.ts'
import { rfcJSONPathBuilder, saveToS3 } from './utilities/s3.ts'
import { validateRfcBucketHtmlDocument } from './utilities/validate-doc.ts'

export const processRfc = async (rfcNumber: number): Promise<boolean> => {
  const html = await fetchSourceRfcHtml(rfcNumber)
  if (html !== null) {
    const rfcDocFromHtml = await rfcBucketHtmlToRfcDocument(html, rfcNumber)
    validateRfcBucketHtmlDocument(rfcDocFromHtml)
    await saveToS3(rfcJSONPathBuilder(rfcNumber), JSON.stringify(rfcDocFromHtml))
    return true
  }

  console.log(' - trying PDF instead')
  // Some RFCs don't have HTML eg RFC418, so try PDF
  // Note that this will upload page images
  const rfcDocFromPdf = await rfcBucketPdfToRfcDocument(rfcNumber, true)
  if (rfcDocFromPdf) {
    validateRfcBucketHtmlDocument(rfcDocFromPdf)
    await saveToS3(rfcJSONPathBuilder(rfcNumber), JSON.stringify(rfcDocFromPdf))
    console.log(` - uploaded rfcDoc for ${rfcNumber}`)
    return true
  }
  console.error(` - nothing else to try after PDF for RFC ${rfcNumber}`)
  return false
}
