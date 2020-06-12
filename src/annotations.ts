import * as core from '@actions/core'
import {File, PMDReport} from './pmd'
import parser from 'fast-xml-parser'
import fs from 'fs'
import * as path from 'path'
import {Annotation, AnnotationLevel} from './github'
import {chain, map} from 'ramda'

const XML_PARSE_OPTIONS = {
  allowBooleanAttributes: true,
  ignoreAttributes: false,
  attributeNamePrefix: ''
}

function asArray<T>(arg: T[] | T | undefined): T[] {
  return !arg ? [] : Array.isArray(arg) ? arg : [arg]
}

function getWarningLevel(arg : string | number) : AnnotationLevel {
  switch (arg) {
    case '1':
      return AnnotationLevel.failure;
    case '2':
    case '3':
      return AnnotationLevel.warning;
    default:
      return AnnotationLevel.notice;
  }
}

export function annotationsForPath(resultFile: string): Annotation[] {
  core.info(`Creating annotations for ${resultFile}`)
  const root: string = process.env['GITHUB_WORKSPACE'] || ''

  const result: PMDReport = parser.parse(
    fs.readFileSync(resultFile, <const>'UTF-8'),
    XML_PARSE_OPTIONS
  )

  return chain(file => {
    return map(violation => {
      const annotation: Annotation = {
        annotation_level: getWarningLevel(violation.priority),
        path: path.relative(
            root,
            file.name
        ),
        start_line: Number(violation.beginline || 1),
        end_line: Number(
            violation.endline || violation.beginline || 1
        ),
        title: `${violation.ruleset} ${violation.rule}`,
        message: violation["@text"]
      }

      return annotation;
    }, asArray(file.violation))
  }, asArray<File>(result.pmd?.file))

}
