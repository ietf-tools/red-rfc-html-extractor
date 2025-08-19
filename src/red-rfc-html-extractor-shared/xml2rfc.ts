import { getDOMParser, getInnerText, isHtmlElement } from '../dom.ts'
import type { MaxPreformattedLineLengthSchemaType } from '../rfc-validators.ts'
import { blankRfcCommon } from '../rfc.ts'
import type { RfcEditorToc } from '../rfc.ts'
import type { RfcAndToc } from './index.ts'

type TocSections = RfcEditorToc['sections']
type TocSection = TocSections[number]
type TocLink = NonNullable<TocSection['links']>[number]

export const parseXml2RfcHead = (
  head: Document['head'],
  rfcAndToc: RfcAndToc
): void => {
  head.childNodes.forEach((node) => {
    if (isHtmlElement(node)) {
      let name: string | null
      let content: string | null
      let rel: string | null
      let href: string | null

      switch (node.nodeName.toLowerCase()) {
        case 'meta':
          name = node.getAttribute('name')
          content = node.getAttribute('content')
          if (content) {
            switch (name) {
              case 'author':
                if (!rfcAndToc.rfc.authors) {
                  rfcAndToc.rfc.authors = []
                }
                rfcAndToc.rfc.authors.push({
                  name: content
                })
                break
              case 'description':
                rfcAndToc.rfc.abstract = content
                break
              case 'rfc.number':
                if (rfcAndToc.rfc.number === blankRfcCommon.number) {
                  rfcAndToc.rfc.number = parseInt(content, 10)
                }
                break
              case 'keyword':
                if (rfcAndToc.rfc.keywords === undefined) {
                  rfcAndToc.rfc.keywords = []
                }
                rfcAndToc.rfc.keywords.push(content)
                break
            }
          }
          break
        case 'title':
          // don't try to parse the <title> because it has both the RFC title and RFC number in it,
          // so we'll use other parts of the HTML (the RFC title within the <body>) which are easier to use
          break
        case 'link':
          rel = node.getAttribute('rel')
          href = node.getAttribute('href')
          if (href && rel) {
            if (rel === 'alternate') {
              if (rfcAndToc.rfc.identifiers === undefined) {
                rfcAndToc.rfc.identifiers = []
              }

              if (href.includes('doi.org')) {
                rfcAndToc.rfc.identifiers.push({
                  type: 'doi',
                  value: href
                })
              } else if (href.includes('urn:issn:')) {
                rfcAndToc.rfc.identifiers.push({
                  type: 'issn',
                  value: href
                })
              }
            }
          }
          break
      }
    }
  })
}

export const parseXml2RfcBody = (
  body: Document['body'],
  rfcAndToc: RfcAndToc
): void => {
  body.childNodes.forEach((node) => {
    if (isHtmlElement(node)) {
      if (
        node.id === 'rfcnum' &&
        rfcAndToc.rfc.number === blankRfcCommon.number
      ) {
        rfcAndToc.rfc.number = parseInt(
          getInnerText(node).replace(/[^0-9]/gi, ''),
          10
        )
      } else if (node.id === 'title') {
        rfcAndToc.rfc.title = getInnerText(node)
      } else if (node.id === 'toc') {
        rfcAndToc.tableOfContents = parseXml2RfcToc(node)
      }
      const idsToRemove = ['toc', 'external-metadata', 'internal-metadata']
      if (idsToRemove.includes(node.id)) {
        return false
      }
    }
    return true
  })
}

const parseXml2RfcToc = (toc: HTMLElement): RfcEditorToc => {
  const isTocSection = (
    maybeTocSection?: TocSection
  ): maybeTocSection is TocSection => {
    return Boolean(
      maybeTocSection &&
        typeof maybeTocSection === 'object' &&
        'links' in maybeTocSection
    )
  }

  const walk = (node: Node): TocSection | undefined => {
    if (isHtmlElement(node)) {
      if (node.nodeName.toLowerCase() === 'li') {
        const links = Array.from(node.childNodes)
          .flatMap((childNode) => {
            if (
              isHtmlElement(childNode) &&
              childNode.nodeName.toLowerCase() !== 'ul'
            ) {
              const internalLinks = childNode.querySelectorAll('a')
              return Array.from(internalLinks)
                .filter((internalLink) => {
                  // RFC8881 has pilcrows in the TOC
                  // https://www.rfc-editor.org/rfc/rfc8881.html
                  return !internalLink.classList.contains('pilcrow')
                })
                .map((internalLink) => {
                  if (isHtmlElement(internalLink)) {
                    const href = internalLink.getAttribute('href')
                    if (
                      href?.startsWith('#')
                      // it's an internal link, assume a TOC link
                    ) {
                      const title = getInnerText(internalLink)
                      if (title.length > 0) {
                        return {
                          id: href.substring(1),
                          title
                        }
                      }
                    } else {
                      console.warn(
                        `Found non TOC link`,
                        href,
                        internalLink.outerHTML
                      )
                    }
                  } else {
                    throw Error(
                      `Didn't expect non-element. Was ${internalLink}`
                    )
                  }
                })
            }
          })
          .filter((link): link is TocLink => {
            return !!link
          })

        const subsections = Array.from(node.childNodes)
          .map((childNode) => {
            if (
              isHtmlElement(childNode) &&
              childNode.nodeName.toLowerCase() === 'ul'
            ) {
              return Array.from(childNode.childNodes)
                .map(walk)
                .filter(isTocSection)
            }
          })
          .filter(
            (
              subsections
            ): subsections is NonNullable<TocSection['sections']> => {
              return !!subsections
            }
          )

        const newSection: TocSection = {
          links
        }

        if (subsections.length > 0 && subsections[0].length > 0) {
          newSection.sections = subsections[0]
        }

        return newSection
      }
    }
  }

  const root = toc.querySelector('ul')

  if (!root) {
    throw Error("Couldn't find root node")
  }

  const sections: TocSections = Array.from(root.childNodes)
    .map(walk)
    .filter(isTocSection)

  return {
    title: 'Table of Contents',
    sections
  }
}

export const getXml2RfcRfcDocument = (dom: Document): Node[] => {
  const nodes = Array.from(dom.body.childNodes).filter((node) => {
    if (isHtmlElement(node)) {
      switch (node.nodeName.toLowerCase()) {
        case 'table':
          if (node.classList.contains('ears')) {
            return false
          }
          break
      }
      const idsToRemove = [
        'toc',
        'rfcnum',
        'title',
        'external-metadata',
        'internal-metadata'

        // 'section-abstract'
        // 'status-of-memo',
        // 'copyright'
      ]
      if (idsToRemove.includes(node.id)) {
        return false
      }
    }
    return true
  })

  return nodes.flatMap((node) => fixNodeForMobile(node, false))
}

/**
 * The HTML needs minor changes to ensure mobile rendering when rendered on
 * the rfc-editor site.
 *
 * Tailwind's grepper won't be able to see these CSS classes so we rely on
 * the same classes already existing in the generated CSS bundle (because they
 * were already used elsewhere, in Red).
 *
 * If using unpopular classes this would need a different approach.
 */
const fixNodeForMobile = (
  node: Node,
  isInsideHorizontalScrollable: boolean
): Node | Node[] => {
  const getHorizontalScrollable = (htmlElement: HTMLElement) => {
    const horizontalScrollable = htmlElement.ownerDocument.createElement('div')
    horizontalScrollable.setAttribute('data-component', 'HorizontalScrollable')
    // these can be too wide, so we wrap them to make a scrollable area
    horizontalScrollable.classList.add(
      // see above docstring about Tailwind classes
      'w-full',
      'max-w-screen',
      'overflow-x-auto'
    )
    return horizontalScrollable
  }

  const getPlaceholder = (htmlElement: HTMLElement, widthPx: number, heightPx: number) => {
    const placeholder = htmlElement.ownerDocument.createElement('div')
    placeholder.setAttribute('data-placeholder', 'true')
    placeholder.setAttribute('aria-hidden', 'true')
    placeholder.style.width = `${widthPx}px`
    placeholder.style.height = `${heightPx}px`
    return placeholder
  }

  if (isHtmlElement(node)) {
    const tagName = node.tagName.toLowerCase()

    const newChildren = Array.from(node.childNodes).flatMap((node) =>
      fixNodeForMobile(node, isInsideHorizontalScrollable)
    )

    if (!isInsideHorizontalScrollable) {
        
      switch (tagName) {
        case 'ol':
        case 'ul':
        case 'pre':
        case 'table':
          // these can be too wide, so we wrap them in a scrollable area
          node.replaceChildren(...newChildren)
          const hs = getHorizontalScrollable(node)
          hs.appendChild(node)
          return hs
        case 'svg':
          // these can be too wide, so we'll wrap them in a scrollable area
          // but these can also be indented ie an SVG displayed in a <li>
          // so the scrollable area would be offset too which doesn't look
          // nice.
          // so we'll pull the scrollable area out of Normal Flow using absolute
          // and put it on the left, but insert a placeholder of the same size
          // so as to not interupt the flow.
          //
          const svg = node instanceof SVGElement ? node : undefined
          if (!svg) {
            console.error({ node })
            throw Error(`Expected SVG but got node (see console) ${node}`)
          }
          
          svg.replaceChildren(...newChildren)
          const widthAttr = svg.getAttribute("width")
          const widthPx = parseFloat(widthAttr ?? '')
          const heightAttr = svg.getAttribute("height")
          const heightPx = parseFloat(heightAttr ?? '')
          console.log({
            widthAttr,
            heightAttr,
            widthPx,
            heightPx,
            widthownerSVGElement: svg.ownerSVGElement?.width,
            heightownerSVGElement: svg.ownerSVGElement?.height,
          })
          if(Number.isNaN(widthPx) || Number.isNaN(heightPx)) {
            console.warn("Could not find width/height", { widthAttr, heightAttr })
            return node
          }
          const hs2 = getHorizontalScrollable(node)
          hs2.appendChild(node)
          hs2.classList.add(
            // pull this out of the flow
            'absolute',
            'left-0',
          )
          // insert a placeholder to take up the same space within the flow
          const placeholder = getPlaceholder(node, widthPx, heightPx)
          return [placeholder, hs2]
      }
    }

    node.replaceChildren(...newChildren)
    return node
  }
  return node
}

/**
 * Unlike plaintext RFCs these HTML RFCs aren't entirely <pre>formatted text
 * but they can include preformatted sections (eg ASCII art) that should be
 * sized, so we still calculate the max line length of <pre>s within.
 */
export const getXml2RfcMaxLineLength = async (
  dom: Document
): Promise<MaxPreformattedLineLengthSchemaType> => {
  /**
   * The DEFAULT_MAX_LINE_LENGTH is less than the plaintext equivalent.
   *
   * This is because HTML RFC <pre> sections might be just ASCII art, and as such there's
   * without any
   * particular width conventions. Unlike plaintext RFCs we can't assume <pre> sections within
   * HTML are 80 chars by default. , so we'll
   * start off with a smaller number than 80.
   */
  const DEFAULT_MAX_LINE_LENGTH = 40

  const pres = Array.from(dom.body.querySelectorAll<HTMLElement>('pre'))
  const max = pres.reduce(
    (prevMaxLineLength, pre) =>
      Math.max(
        prevMaxLineLength,
        ...getInnerText(pre)
          .split('\n')
          .map((line) => line.length)
      ),
    DEFAULT_MAX_LINE_LENGTH
  )

  /**
   * Counts max line length, but also counts the number of <a> links
   * in the line so that we can account for Red's use of buttons following
   * links when in responsive/touch mode. We allocate ANCHOR_SUFFIX_CHAR_WIDTH
   * chars per link in a line.
   *
   * This means that the max line length can vary between touch and touchless
   * interfaces.
   */
  const ANCHOR_SUFFIX_CHAR_WIDTH = 3
  const domParser = await getDOMParser()
  const maxWithAnchorSuffix = pres.reduce(
    (prevMaxLineLength, pre) =>
      Math.max(
        prevMaxLineLength,
        ...pre.innerHTML.split('\n').map((lineHTML) => {
          const lineDom = domParser.parseFromString(
            `<div>${lineHTML}</div>`,
            'text/html'
          )
          const innerText = getInnerText(lineDom.documentElement)
          const anchors = lineDom.querySelectorAll('a')
          return innerText.length + anchors.length * ANCHOR_SUFFIX_CHAR_WIDTH
        })
      ),
    DEFAULT_MAX_LINE_LENGTH
  )

  return {
    max,
    maxWithAnchorSuffix
  }
}
