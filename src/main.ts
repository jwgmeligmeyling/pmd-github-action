import * as core from '@actions/core'
import {findResults} from './search'
import {Inputs} from './constants'
import {annotationsForPath} from './annotations'
import {chain, splitEvery} from 'ramda'
import {Annotation} from './github'
import {getOctokit, context} from '@actions/github'

const MAX_ANNOTATIONS_PER_REQUEST = 50

async function run(): Promise<void> {
  try {
    const path = core.getInput(Inputs.Path, {required: true})
    const name = core.getInput(Inputs.Name)
    const title = core.getInput(Inputs.Title)

    const searchResult = await findResults(path)
    if (searchResult.filesToUpload.length === 0) {
      core.warning(
        `No files were found for the provided path: ${path}. No results will be uploaded.`
      )
    } else {
      core.info(
        `With the provided path, there will be ${searchResult.filesToUpload.length} results uploaded`
      )
      core.debug(`Root artifact directory is ${searchResult.rootDirectory}`)

      const annotations: Annotation[] = chain(
        annotationsForPath,
        searchResult.filesToUpload
      )
      core.debug(
        `Grouping ${annotations.length} annotations into chunks of ${MAX_ANNOTATIONS_PER_REQUEST}`
      )

      const groupedAnnotations: Annotation[][] = splitEvery(
        MAX_ANNOTATIONS_PER_REQUEST,
        annotations
      )
      core.debug(`Created ${groupedAnnotations.length} buckets`)

      for (const annotationSet of groupedAnnotations) {
        await createCheck(name, title, annotationSet, annotations.length)
      }
    }
  } catch (error) {
    core.setFailed(error)
  }
}

async function createCheck(
  name: string,
  title: string,
  annotations: Annotation[],
  numErrors: number
): Promise<void> {
  const octokit = getOctokit(core.getInput(Inputs.Token))
  const req = {
    ...context.repo,
    ref: context.sha
  }

  const res = await octokit.checks.listForRef(req)
  const existingCheckRun = res.data.check_runs.find(
    check => check.name === name
  )

  if (!existingCheckRun) {
    const createRequest = {
      ...context.repo,
      head_sha: context.sha,
      name,
      status: <const>'completed',
      conclusion: <const>'neutral',
      output: {
        title,
        summary: `${numErrors} violation(s) found`,
        annotations
      }
    }

    await octokit.checks.create(createRequest)
  } else {
    const check_run_id = existingCheckRun.id

    const update_req = {
      ...context.repo,
      check_run_id,
      status: <const>'completed',
      conclusion: <const>'neutral',
      output: {
        title,
        summary: `${numErrors} violation(s) found`,
        annotations
      }
    }

    await octokit.checks.update(update_req)
  }
}

run()
