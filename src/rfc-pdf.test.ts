// @vitest-environment node
import { test, expect, vi } from 'vitest'
import { rfcBucketPdfToRfcDocument } from './rfc-pdf.ts'

const RFC_PDF_EXAMPLE = 418

test(`rfcBucketPdfToRfcDocument(${RFC_PDF_EXAMPLE}, false)`, async () => {
  const rfcBucketPdfDocument = await rfcBucketPdfToRfcDocument(RFC_PDF_EXAMPLE, false)
  expect(rfcBucketPdfDocument).toMatchSnapshot()
})
