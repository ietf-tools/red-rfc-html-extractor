import { extractText, getDocumentProxy } from 'unpdf'
import { blankRfcCommon } from './rfc.ts'
import { PUBLIC_SITE } from './utilities/url.ts'
import { BLANK_HTML, getDOMParser, rfcDocumentToPojo } from './utilities/dom.ts'
import { DEFAULT_WIDTH_PX } from './utilities/layout.ts'
import { rfcImagePathBuilder } from './utilities/s3.ts'
import type { TableOfContents } from './utilities/rfc-validators.ts'
import type { RfcBucketHtmlDocument } from './rfc.ts'

export const fetchRfcPDF = async (
  rfcNumber: number
): Promise<ArrayBuffer | null> => {
  const url = `${PUBLIC_SITE}/rfc/rfc${rfcNumber}.pdf`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(
      `Unable to fetch ${rfcNumber} PDF response was ${response.status} ${response.statusText} at ${url}`
    )
    return null
  }
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer
}

type PdfPage = {
  filename: string
  buffer: Buffer<ArrayBufferLike>
  altText: string
}

export const rfcBucketPdfToRfcDocument = async (
  pdfBuffer: ArrayBuffer,
  rfcNumber: number
): Promise<[RfcBucketHtmlDocument, PdfPage[]]> => {
  const pdfBytes = new Uint8Array(pdfBuffer)
  const pdfDocument = await getDocumentProxy(pdfBytes)

  const pdfPages: PdfPage[] = []

  const domParser = await getDOMParser()

  const dom = domParser.parseFromString(BLANK_HTML, 'text/html')

  const tableOfContents: TableOfContents = { title: '', sections: [] }

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum)
    const pageTitle = `Page ${pageNum}`

    const domId = `page${pageNum}`

    // Extract alt text
    const altText = await getPageText(page)

    // Create canvas for rendering
    const scale = 1
    const viewport = page.getViewport({ scale })
    const viewportRatio = viewport.height / viewport.width
    const newHeightPx = DEFAULT_WIDTH_PX * viewportRatio

    const canvas = dom.createElement('canvas')
    dom.body.append(canvas)
    canvas.width = DEFAULT_WIDTH_PX
    canvas.height = newHeightPx
    canvas.style.width = Math.floor(DEFAULT_WIDTH_PX) + 'px'
    canvas.style.height = Math.floor(newHeightPx) + 'px'

    const canvasContext = canvas.getContext('2d')

    if (canvasContext === null) {
      throw Error(`Unable to canvas.getContext('2d')`)
    }

    await page.render({ canvasContext, canvas: null, viewport }).promise

    // Convert canvas to buffer
    const maybeBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    )
    if (maybeBlob === null) {
      throw Error(`Unable to extract blob`)
    }
    const arrayBuffer = await maybeBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const filename = `${rfcNumber}-page${pageNum}.png`

    pdfPages.push({ filename, buffer, altText })

    tableOfContents.sections.push({
      links: [
        {
          title: pageTitle,
          id: domId
        }
      ]
    })

    dom.body.removeChild(canvas)

    const pageNode = dom.createElement('div')
    const pageHeading = dom.createElement('h2')
    pageHeading.textContent = pageTitle
    pageHeading.id = domId
    pageNode.appendChild(pageHeading)
    const pageImg = dom.createElement('img')
    pageImg.setAttribute('src', rfcImagePathBuilder(filename))
    pageImg.setAttribute('width', DEFAULT_WIDTH_PX.toString())
    pageImg.setAttribute('height', newHeightPx.toString())
    pageImg.setAttribute('alt', altText)
    if (pageNum > 1) {
      // for pages 2+ we'll lazy load images
      // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#loading
      pageImg.setAttribute('loading', 'lazy')
    }
    pageNode.appendChild(pageImg)
    dom.body.append(pageNode)
  }

  const doc: RfcBucketHtmlDocument = {
    rfc: structuredClone(blankRfcCommon),
    tableOfContents,
    documentHtmlType: 'pdf-or-ps',
    documentHtmlObj: rfcDocumentToPojo(Array.from(dom.body.childNodes)),
    maxPreformattedLineLength: {
      // won't be used for a PDF document
      max: 80,
      maxWithAnchorSuffix: 80
    }
  }

  return [doc, pdfPages]
}
