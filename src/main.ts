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

      const groupedAnnotations: Annotation[][] =
        annotations.length > MAX_ANNOTATIONS_PER_REQUEST
          ? splitEvery(MAX_ANNOTATIONS_PER_REQUEST, annotations)
          : [annotations]

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
  const head_sha = core.getInput('ref', {required: true})
  const req = {
    ...context.repo,
    ref: head_sha
  }

  const run_id = Number(process.env['GITHUB_RUN_ID'])

  const workflowRun = await octokit.actions.getWorkflowRun({
    ...context.repo,
    run_id
  })

  console.log('Workflow run: %o', workflowRun.data)

  // Gotta love Github's crippled API
  const checkSuiteUrl = workflowRun.data.check_suite_url
  const checkSuiteId = Number(
    checkSuiteUrl.substring(checkSuiteUrl.lastIndexOf('/') + 1)
  )

  core.info(`Posting check result for ${head_sha}`)

  const suitesRes = await octokit.checks.listSuitesForRef(req)
  // const suitesById = indexBy(
  //   suite => String(suite.id),
  //   suitesRes.data.check_suites
  // )

  const res = await octokit.checks.listForRef(req)
  const existingCheckRun = res.data.check_runs.find(
    check => check.name === name && check.check_suite.id === checkSuiteId
  )

  if (existingCheckRun) {
    console.log('Found existing check run %o', existingCheckRun)
  } else {
    console.log(' The check suites are %o', suitesRes.data.check_suites)
  }

  if (!existingCheckRun) {
    const createRequest = {
      ...context.repo,
      head_sha,
      name,
      status: <const>'completed',
      conclusion: numErrors === 0 ? <const>'success' : <const>'neutral',
      check_suite : {
        id : checkSuiteId
      },
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
      conclusion: numErrors === 0 ? <const>'success' : <const>'neutral',
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
