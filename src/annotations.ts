import * as core from '@actions/core'
import {File, PMDReport} from './pmd'
import {XMLParser} from 'fast-xml-parser'
import fs from 'fs'
import BufferEncoding from 'buffer'
import * as path from 'path'
import {Annotation, AnnotationLevel} from './github'
import {chain, map} from 'ramda'
import decode from 'unescape'

const XML_PARSE_OPTIONS = {
  allowBooleanAttributes: true,
  ignoreAttributes: false,
  attributeNamePrefix: ''
}

function asArray<T>(arg: T[] | T | undefined): T[] {
  return !arg ? [] : Array.isArray(arg) ? arg : [arg]
}

function getWarningLevel(arg: string | number): AnnotationLevel {
  switch (arg) {
    case '1':
      return AnnotationLevel.failure
    case '2':
    case '3':
      return AnnotationLevel.warning
    default:
      return AnnotationLevel.notice
  }
}

export function annotationsForPath(resultFile: string): Annotation[] {
  core.info(`Creating annotations for ${resultFile}`)
  const root: string = process.env['GITHUB_WORKSPACE'] || ''

  const parser = new XMLParser(XML_PARSE_OPTIONS)
  const result: PMDReport = parser.parse(
    fs.readFileSync(resultFile, 'UTF-8' as BufferEncoding)
  )

  return chain(
    file => {
      return map(violation => {
        const annotation: Annotation = {
          annotation_level: getWarningLevel(violation.priority),
          path: path.relative(root, file.name),
          start_line: Number(violation.beginline || 1),
          end_line: Number(violation.endline || violation.beginline || 1),
          title: `${violation.ruleset} ${violation.rule}`,
          message: decode(violation['#text'])
        }

        return annotation
      }, asArray(file.violation))
    },
    asArray<File>(result.pmd?.file)
  )
}
