// Save tf state in bucket
terraform {
  backend "gcs" {
    bucket = "growkudos-com-terraform-state"
    prefix  = "gcp/functions/subscribe"
    region = "europe-west2-a"
  }
}

provider "google" {
  project = "${var.project}"
  region   = "${var.region}"
}

data "archive_file" "index" {
  type        = "zip"
  output_path = "subscribe.zip"
  source {
    content = "${file("../index.js")}"
    filename = "index.js"
  }
  source {
    content = "${file("../package.json")}"
    filename = "package.json"
  }
}

resource "google_storage_bucket" "bucket" {
  name = "growkudos-com-gcp-functions-test"
  location = "US" # match the function region
}

resource "google_storage_bucket_object" "archive" {
  name   = "${data.archive_file.index.output_md5}.${data.archive_file.index.output_path}"
  bucket = "${google_storage_bucket.bucket.name}"
  source = "${data.archive_file.index.output_path}"
}

resource "google_cloudfunctions_function" "function" {
  name                  = "subscribe"
  description           = "Managed by Terraform"
  region                = "us-central1"
  runtime               = "nodejs8"
  entry_point           = "subscribe"
  event_trigger = {
    event_type = "providers/cloud.pubsub/eventTypes/topic.publish"
    resource = "cloud-builds"
  }
  source_archive_bucket = "${google_storage_bucket.bucket.name}"
  source_archive_object = "${google_storage_bucket_object.archive.name}"
  labels = {
    deployment-tool = "cli-gcloud"
  }
  environment_variables = {
    GITHUB_TOKEN = "${var.github_token}"
    SLACK_WEBHOOK_URL = "${var.slack_webhook_url}"
  }
}
