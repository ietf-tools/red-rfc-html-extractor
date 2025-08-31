// @vitest-environment node
import { test, expect, vi } from 'vitest'
import { rfcBucketPdfToRfcDocument } from './rfc-pdf.ts'

vi.setConfig({ testTimeout: 20 * 1000 })

const RFC_PDF_EXAMPLE = 418

test(`rfcBucketPdfToRfcDocument(${RFC_PDF_EXAMPLE})`, async () => {
  const rfcBucketPdfDocument = await rfcBucketPdfToRfcDocument(RFC_PDF_EXAMPLE)
  expect(rfcBucketPdfDocument).toMatchSnapshot()
})
