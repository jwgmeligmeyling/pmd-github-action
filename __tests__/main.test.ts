import * as process from 'process'
import fs from 'fs'
import * as path from 'path'
import {annotationsForPath} from '../src/annotations'

beforeAll(() => {
  jest.spyOn(fs, 'existsSync').mockReturnValue(true)
  process.env['GITHUB_WORKSPACE'] = __dirname
})

test('parses file', async () => {
  const spotBugsXml = path.resolve(__dirname, '..', 'reports', 'pmd.xml')
  const annotations = annotationsForPath(spotBugsXml)
  expect(annotations).toHaveLength(171)
})
