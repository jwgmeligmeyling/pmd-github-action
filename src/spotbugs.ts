export interface FindbugsResult {
  BugCollection: BugCollection
}

export interface Project {
  SrcDir: string[] | string
}

export interface BugCollection {
  BugInstance: BugInstance[] | BugInstance | undefined
  BugPattern: BugPattern[] | BugPattern | undefined
  Project: Project
}

export interface BugInstance {
  LongMessage: string
  ShortMessage: string
  SourceLine: SourceLine
  priority: number
  type: string
}

export interface SourceLine {
  start?: string
  end?: string
  classname: string
  sourcepath: string
}

export interface BugPattern {
  category: string
  type: string
  ShortDescription: string
  Details: string
  cweid: string
}
