export type RfcCommon = {
  number: number;
  title: string;
  published: string;
  area?: {
    acronym: string;
    name: string;
  };
  status: RfcCommonStatus;
  subseries?: {
    type: RfcCommonSubseriesType;
    number?: number;
    subseriesLength?: number;
  };
  pages?: number | null;
  authors: {
    person?: number; // generally should be present except when parsed from HTML
    name: string;
    email?: string;
    affiliation?: string;
    country?: string;
  }[];
  group: {
    acronym: string;
    name: string;
  };
  stream: {
    slug: string;
    name: string;
    desc?: string;
  };
  identifiers?: {
    type: "doi" | "issn";
    value: string;
  }[];
  obsoletes?: {
    id: number;
    number: number;
    title: string;
  }[];
  obsoleted_by?: {
    id: number;
    number: number;
    title: string;
  }[];
  updates?: {
    id: number;
    number: number;
    title: string;
  }[];
  updated_by?: {
    id: number;
    number: number;
    title: string;
  }[];
  is_also?: string[];
  see_also?: string[];
  draft?: {
    id?: number;
    name: string;
    title: string;
  };
  abstract?: string;
  formats: ("xml" | "txt" | "html" | "htmlized" | "pdf" | "ps")[];
  keywords?: string[];
  errata?: string[];
  text: string | null;
};

export const blankRfcCommon: RfcCommon = {
  number: 0,
  title: "",
  published: "1950-1-1",
  pages: 0,
  status: "Unknown",
  authors: [],
  group: {
    acronym: "",
    name: "",
  },
  area: {
    acronym: "",
    name: "",
  },
  stream: {
    slug: "",
    name: "",
    desc: "",
  },
  identifiers: [],
  obsoleted_by: [],
  updated_by: [],
  formats: [],
  abstract: "",
  text: "",
};

export type RfcCommonStatus =
  | "Best Current Practice"
  | "Experimental"
  | "Historic"
  | "Informational"
  | "Not Issued"
  | "Internet Standard"
  | "Unknown"
  | "Proposed Standard"
  | "Draft Standard";

export type RfcCommonSubseriesType = "bcp" | "fyi" | "std";

type Section = {
  links: {
    id: string;
    title: string;
  }[];
  sections?: Section[];
};

export type RfcEditorToc = {
  title: string;
  sections: Section[];
};

export type RfcBucketHtmlDocument = {
  rfc: RfcCommon;
  tableOfContents?: RfcEditorToc;
  documentHtml: string;
};
