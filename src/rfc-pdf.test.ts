// @vitest-environment node
import { test, expect } from 'vitest'
import { fetchRfcPDF, rfcBucketPdfToRfcDocument } from './rfc-pdf.ts'

const processRfcBucketHtml = async (rfcNumber: number) => {
  const pdf = await fetchRfcPDF(rfcNumber)
  if (pdf) {
    return rfcBucketPdfToRfcDocument(pdf, rfcNumber)
  }
}

const RFC_PDF_EXAMPLE = 418

test(`rfcBucketPdfToRfcDocument(${RFC_PDF_EXAMPLE})`, async () => {
  const rfcBucketPdfDocument = await processRfcBucketHtml(RFC_PDF_EXAMPLE)
  expect(rfcBucketPdfDocument).toMatchSnapshot()
})
