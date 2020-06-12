export interface PMDReport {
  pmd?: PMD
}

export interface PMD {
  file: File[] | File | undefined
}

export interface File {
  name: string
  violation: Violation[] | Violation | undefined
}

export interface Violation {
  beginline: string
  endline: string
  begincolumn: string
  endcolumn: string
  rule: string
  ruleset: string
  package: string
  class: string
  externalInfoUrl: string
  priority: string,
  '@text': string
}
