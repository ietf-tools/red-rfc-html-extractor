import { fetchSourceRfcHtml, rfcBucketHtmlToRfcDocument } from './rfc-html.ts'
import { fetchRfcPDF } from './rfc-pdf.ts'
import { saveToS3 } from './utilities/s3.ts'

export const processRfc = async (rfcNumber: number): Promise<void> => {
  const html = await fetchSourceRfcHtml(rfcNumber)
  if (html !== null) {
    const rfcDoc = await rfcBucketHtmlToRfcDocument(html, rfcNumber)
    await saveToS3(rfcNumber, JSON.stringify(rfcDoc))
    console.log(`Pushed RFC ${rfcNumber} to bucket successfully.`)
    return
  }
  // Some RFCs don't have HTML eg RFC418
  const pdf = await fetchRfcPDF(rfcNumber)
  if (pdf !== null) { 

  }
  //
  return
}
