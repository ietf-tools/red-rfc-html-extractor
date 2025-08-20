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

  return nodes.flatMap((node) => fixNodeForMobile(node))
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
  isInsideHorizontalScrollable: boolean = false
): Node | Node[] => {
  const getHorizontalScrollable = (
    htmlElement: HTMLElement,
    absolute?: { childWidthPx: number; childHeightPx: number }
  ) => {
    const horizontalScrollable = htmlElement.ownerDocument.createElement('div')
    horizontalScrollable.setAttribute('data-component', 'HorizontalScrollable')
    if (absolute) {
      horizontalScrollable.setAttribute(
        'data-component-absolute',
        true.toString()
      )
      horizontalScrollable.setAttribute(
        'data-component-childwidth',
        absolute.childWidthPx.toString()
      )
      horizontalScrollable.setAttribute(
        'data-component-childheight',
        absolute.childHeightPx.toString()
      )
    }
    // these can be too wide, so we wrap them to make a scrollable area
    horizontalScrollable.classList.add(
      // see above docstring about Tailwind classes
      'w-full',
      'max-w-screen',
      'overflow-x-auto'
    )
    return horizontalScrollable
  }

  const listParents = (el: HTMLElement): void => {
    const parents: HTMLElement[] = []
    let pointer = el
    while (pointer.parentElement && pointer.parentElement.tagName.toLowerCase() !== 'body') {
      parents.push(pointer.parentElement)
      pointer = pointer.parentElement
    }
    console.log('SVG Parents', ...parents.map((el) => el.tagName.toLowerCase()))
  }

  if (isHtmlElement(node)) {
    const tagName = node.tagName.toLowerCase()

    if (isInsideHorizontalScrollable === false) {
      switch (tagName) {
        case 'ol':
        case 'ul':
        case 'pre':
        case 'table':
          const newChildren1 = Array.from(node.childNodes).flatMap((node) =>
            fixNodeForMobile(node, true)
          )
          // these can be too wide, so we wrap them in a scrollable area
          node.replaceChildren(...newChildren1)
          const horizontalScrollable1 = getHorizontalScrollable(node)
          horizontalScrollable1.appendChild(node)
          return horizontalScrollable1
        case 'svg':
          // these can be too wide, so we'll wrap them in a scrollable area
          // but because SVGs are often inline deeper in the document they
          // come with some indentation to the left, so we can't use the
          // full viewport width for the SVG. This indentation makes Red's
          // rendering in a <HorizontalScrollable> indented too.
          // <HorizontalScrollable> more affects mobile (it doesn't render
          // anything if the content is visible within the viewport, ie on
          // larger screens) and arguably the better mobile UX for that would
          // be full screen width.
          //
          // so we'll assist Red by suggesting a `position:absolute;left:0px`
          // HorizontalScrollable that is full width. Because this pulls the
          // SVG out of regular browser layout flow we'll also provide the
          // dimensions for a placeholder, taken from the SVG's dimensions.
          // This is so that Red can insert blank space where the SVG was in
          // the layout flow, so that following Nodes don't render under the
          // newly `position:absolute` SVG.
          listParents(node as unknown as HTMLElement)
          if (!node) {
            console.error({ node })
            throw Error(`Expected SVG but got node (see console) ${node}`)
          }
          const newChildren2 = Array.from(node.childNodes).flatMap((node) =>
            fixNodeForMobile(node, true)
          )
          node.replaceChildren(...newChildren2)
          const widthAttr = node.getAttribute('height')
          const widthPx = parseFloat(widthAttr ?? '')
          const heightAttr = node.getAttribute('height')
          const heightPx = parseFloat(heightAttr ?? '')
          if (Number.isNaN(widthPx) || Number.isNaN(heightPx)) {
            console.error(
              'Could not find width/height of SVG. This could break mobile layout',
              { widthAttr, heightAttr }
            )
            return node
          }
          const hs2 = getHorizontalScrollable(node, {
            childWidthPx: widthPx,
            childHeightPx: heightPx
          })
          hs2.appendChild(node)
          return hs2
      }
    }

    const newChildren = Array.from(node.childNodes).flatMap((node) =>
      fixNodeForMobile(node, isInsideHorizontalScrollable)
    )
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
