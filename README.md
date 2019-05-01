# google-cloud-build-slack

Slack integration for Google Cloud Build, using Google Cloud Functions to post messages to Slack when a build reaches a specific state.

## Configuration

The webhook needs configuration parameters that are given setting the following environment variables: 

1. `SLACK_WEBHOOK_URL`: you can find it in here: https://growkudos.slack.com/services/B68AXU94J#service_setup.
2. `GCP_REGION`
3. `GITHUB_TOKEN`: you can find it in the info.txt file in gocrypto-fs looking for the word `GITHUB_CI_TOKEN_GCB`

## Deploy

Terraform has been used to create the Cloud Function and set up the environment to run it (note: it will also set the environment variables). Also, a Google Cloud Build trigger has been manually set up to automatically run the tests and the terraform script to create or update the Cloud Function when changes are pushed to this repository. The manual configuration of the trigger includes setting up the configuration parameters described in the [previous section](#configuration).  

## FAQ

### How much does it cost?
Each build invokes 3 times the function:
- when the build is queued
- when the build starts
- when the build reaches a final status.

Here is the [GCF pricing](https://cloud.google.com/functions/pricing) for calculation.

### How can I update the function?
Just change the function code, update the tests as needed and push it to master. The Google Cloud Function will be automatically updated if the pipeline runs successfully.

<a name="limitations"/></a>

### What are the limitations of using github token to get github commit author info?

For github commit author info to be displayed, the cloud source repositories must be in the form of `github_<OWNER>_<REPO>` and there cannot be underscores in either `<OWNER>` or `<REPO>`. A possible solution to bypass this limitation would be to retrieve owner and repo info directly from [GitHubEventsConfig](https://cloud.google.com/cloud-build/docs/api/reference/rest/v1/projects.triggers#githubeventsconfig).
