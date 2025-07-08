// @vitest-environment node
import { test, expect } from 'vitest'
import { processRfcBucketHtml } from './utils'

const RFC_WITH_PREFORMATTED_HTML = 1234
const RFC_WITH_HTML = 9000

test(`processRfcBucketHtml(${RFC_WITH_PREFORMATTED_HTML}) RFC without TOC`, async () => {
  const rfcBucketHtmlDocument = await processRfcBucketHtml(RFC_WITH_PREFORMATTED_HTML)
  expect(
    rfcBucketHtmlDocument
  ).toMatchSnapshot()

  expect(rfcBucketHtmlDocument.tableOfContents).toBeUndefined()
})

test(`processRfcBucketHtml(${RFC_WITH_HTML}) RFC with TOC`, async () => {
  const rfcBucketHtmlDocument = await processRfcBucketHtml(RFC_WITH_HTML)
  expect(rfcBucketHtmlDocument).toMatchSnapshot()
  expect(rfcBucketHtmlDocument.tableOfContents).toBeTruthy()
})
