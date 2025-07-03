import { getDOMParser, isHtmlElement, isTextNode } from "./dom.ts";
import { blankRfcCommon } from "./rfc.ts";
import type { RfcCommon, RfcEditorToc, RfcBucketHtmlDocument } from "./rfc.ts";

export const PUBLIC_SITE = "https://www.rfc-editor.org";
export const apiRfcBucketHtmlURLBuilder = (rfcNumber: number) => {
  // Intentionally not a relative url, the PUBLIC_SITE prefix is because this URL is served
  // from a bucket on prod; it's not something that a localhost Nuxt can serve.
  // The CORS headers of the prod URL should allow access from localhost:3000 as well as staging,
  // etc. sites.
  return `${PUBLIC_SITE}/rfc-neue/rfc${rfcNumber}.html` as const;
};

export const rfcBucketHtmlToRfcDocument = async (
  rfcBucketHtml: string,
): Promise<RfcBucketHtmlDocument> => {
  const parser = await getDOMParser();
  const dom = parser.parseFromString(rfcBucketHtml, "text/html");

  let tableOfContents: RfcEditorToc | undefined;

  const rfc: RfcCommon = {
    ...blankRfcCommon,
  };

  // Parse useful stuff from <head>
  const headNodes = Array.from(dom.head.childNodes);
  headNodes.forEach((node) => {
    if (isHtmlElement(node)) {
      let name: string | null,
        content: string | null,
        rel: string | null,
        href: string | null;

      switch (node.nodeName.toLowerCase()) {
        case "meta":
          name = node.getAttribute("name");
          content = node.getAttribute("content");
          if (content) {
            switch (name) {
              case "author":
                rfc.authors.push({
                  name: content,
                });
                break;
              case "description":
                rfc.abstract = content;
                break;
              case "rfc.number":
                if (rfc.number === blankRfcCommon.number) {
                  rfc.number = parseInt(content, 10);
                }
                break;
              case "keyword":
                if (rfc.keywords === undefined) {
                  rfc.keywords = [];
                }
                rfc.keywords.push(content);
                break;
            }
          }
          break;
        case "title":
          // don't try to parse the <title> because it has both the RFC title and RFC number in it,
          // so we'll use other parts of the HTML (the title in the <body>) which are easier to use
          break;
        case "link":
          rel = node.getAttribute("rel");
          href = node.getAttribute("href");
          if (href && rel) {
            if (rel === "alternate") {
              if (rfc.identifiers === undefined) {
                rfc.identifiers = [];
              }

              if (href.includes("doi.org")) {
                rfc.identifiers.push({
                  type: "doi",
                  value: href,
                });
              } else if (href.includes("urn:issn:")) {
                rfc.identifiers.push({
                  type: "issn",
                  value: href,
                });
              }
            }
          }
          break;
      }
    }
  });

  // Parse useful stuff from <body>
  const bodyNodes = Array.from(dom.body.childNodes);
  const rfcDocument = bodyNodes.filter((node) => {
    if (isHtmlElement(node)) {
      switch (node.nodeName.toLowerCase()) {
        case "script":
          return false;
        case "table":
          if (node.classList.contains("ears")) {
            return false;
          }
          break;
      }

      if (node.id === "rfcnum" && rfc.number === blankRfcCommon.number) {
        rfc.number = parseInt(node.innerText.replace(/[^0-9]/gi, ""), 10);
      } else if (node.id === "title") {
        rfc.title = node.innerText;
      } else if (node.id === "toc") {
        tableOfContents = parseRfcBucketHtmlToc(node);
      }

      const idsToRemove = ["toc", "external-metadata", "internal-metadata"];
      if (idsToRemove.includes(node.id)) {
        return false;
      }
    }
    return true;
  });

  const documentHtml = rfcDocument
    .map((node): string => {
      if (isHtmlElement(node)) {
        return node.outerHTML;
      } else if (isTextNode(node)) {
        return node.textContent ?? "";
      }
      return "";
    })
    .join("")
    .trim();

  return {
    rfc,
    tableOfContents,
    documentHtml,
  };
};

type TocSections = RfcEditorToc["sections"];
type TocSection = TocSections[number];

const parseRfcBucketHtmlToc = (toc: HTMLElement): RfcEditorToc => {
  const walk = (node: Node): TocSection | undefined => {
    if (isHtmlElement(node)) {
      if (node.nodeName.toLowerCase() === "li") {
        const newSection: TocSection = {
          links: [],
        };
        Array.from(node.childNodes)
          .filter((childNode) => {
            if (isHtmlElement(childNode)) {
              if (childNode.nodeName.toLowerCase() === "ul") {
                newSection.sections = Array.from(childNode.childNodes)
                  .map(walk)
                  .filter(isTocSection);
                return false;
              }
              return true;
            }
            return false;
          })
          .forEach((childNode) => {
            if (isHtmlElement(childNode)) {
              childNode.querySelectorAll("a.internal").forEach((anchor) => {
                if (isHtmlElement(anchor)) {
                  const href = anchor.getAttribute("href");
                  const title = anchor.innerHTML;
                  if (typeof href === "string" && typeof title === "string") {
                    newSection.links.push({
                      id: href,
                      title,
                    });
                  } else {
                    throw Error(
                      `Expected to find href and innerText of TOC anchor but was id="${href}" (typeof ${typeof href}), title="${title}" (typeof ${typeof title}) `,
                    );
                  }
                } else {
                  throw Error(
                    `Unexpected querySelectorAll result of ${anchor} ${anchor.nodeType} ${anchor.nodeValue}`,
                  );
                }
              });
            }
          });

        return newSection;
      }
    }
  };

  const root = toc.querySelector("ul");

  if (!root) {
    throw Error("Couldn't find root node");
  }

  const sections: TocSections = Array.from(root.childNodes)
    .map(walk)
    .filter(isTocSection);

  return {
    title: "Table of Contents",
    sections,
  };
};

export const isTocSection = (
  maybeTocSection?: TocSection,
): maybeTocSection is TocSection => {
  return Boolean(
    maybeTocSection &&
      typeof maybeTocSection === "object" &&
      "links" in maybeTocSection,
  );
};

export const rfcBucketHtmlFilenameBuilder = (rfcNumber: number) =>
  `rfc${rfcNumber}-html.json`;
