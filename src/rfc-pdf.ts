import { createCanvas } from 'canvas'
import pdfjsLib from 'pdfjs-dist'
import { blankRfcCommon, RfcBucketHtmlDocument } from './rfc.ts'
import { PUBLIC_SITE } from './utilities/url.ts'
import { BLANK_HTML, getDOMParser, rfcDocumentToPojo } from './utilities/dom.ts'
import { DEFAULT_WIDTH_PX } from './utilities/layout.ts'
import { rfcImagePathBuilder } from './utilities/s3.ts'
import { TableOfContents } from './utilities/rfc-validators.ts'

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
  pdf: ArrayBuffer,
  rfcNumber: number
): Promise<[RfcBucketHtmlDocument, PdfPage[]]> => {
  const pdfDocument = await pdfjsLib.getDocument({
    data: pdf
  }).promise

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
    const viewport = page.getViewport({ scale: 2 })
    const viewportRatio = viewport.height / viewport.width
    const newHeightPx = DEFAULT_WIDTH_PX * viewportRatio
    const canvas = createCanvas(DEFAULT_WIDTH_PX, newHeightPx)
    const context = canvas.getContext('2d')

    await page.render({
      // @ts-ignore
      canvasContext: context,
      viewport: viewport,
      continueCallback: null
    }).promise

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png')
    const filename = `${rfcNumber}-page${pageNum}.png`

    pdfPages.push({ filename, buffer, altText })

    tableOfContents.sections.push({
      links: [{
        title: pageTitle,
        id: domId,
      }]
    })

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

const getPageText = async (page: pdfjsLib.PDFPageProxy): Promise<string> => {
  const textContent = await page.getTextContent()
  return textContent.items
    .map((item) => {
      console.log(' - text in PDF', Object.keys(item), String(item), item)
      return String(item)
    })
    .join('')
}
