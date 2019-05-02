const { IncomingWebhook } = require('@slack/client');
const humanizeDuration = require('humanize-duration');
const Octokit = require('@octokit/rest');

module.exports.webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);

module.exports.getGithubCommit = async (build, octokit) => {
  try {
    const cloudSourceRepo = build.source.repoSource.repoName;
    const { commitSha } = build.sourceProvenance.resolvedRepoSource;

    // format github_ownerName_repoName
    const [, githubOwner, githubRepo] = cloudSourceRepo.split('_');

    // get github commit
    const githubCommit = await octokit.git.getCommit({
      commit_sha: commitSha,
      owner: githubOwner,
      repo: githubRepo,
    });

    // return github commit
    return githubCommit;
  } catch (err) {
    console.log(err);
    return err;
  }
};

// subscribe is the main function called by GCF.
module.exports.subscribe = async (event) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const octokit = token && new Octokit({
      auth: `token ${token}`,
    });
    const build = module.exports.eventToBuild(event.data);

    // Skip if the current status is not in the status list.
    const status = module.exports.status || ['SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT'];
    if (status.indexOf(build.status) === -1) {
      return;
    }

    const githubCommit = await module.exports.getGithubCommit(build, octokit);

    const message = await module.exports.createSlackMessage(build, githubCommit);
    // Send message to slack.
    module.exports.webhook.send(message);
  } catch (err) {
    module.exports.webhook.send(`Error: ${err}`);
  }
};

// eventToBuild transforms pubsub event message to a build object.
module.exports.eventToBuild = data => JSON.parse(Buffer.from(data, 'base64').toString());

const DEFAULT_COLOR = '#4285F4'; // blue
const STATUS_COLOR = {
  QUEUED: DEFAULT_COLOR,
  WORKING: DEFAULT_COLOR,
  SUCCESS: '#34A853', // green
  FAILURE: '#EA4335', // red
  TIMEOUT: '#FBBC05', // yellow
  INTERNAL_ERROR: '#EA4335', // red
};

// createSlackMessage create a message from a build object.
module.exports.createSlackMessage = async (build, githubCommit) => {
  const buildFinishTime = new Date(build.finishTime);
  const buildStartTime = new Date(build.startTime);

  const isWorking = build.status === 'WORKING';
  const timestamp = Math.round(((isWorking) ? buildStartTime : buildFinishTime).getTime() / 1000);

  const text = (isWorking)
    ? `Build \`${build.id}\` started`
    : `Build \`${build.id}\` finished`;

  const fields = [{
    title: 'Status',
    value: build.status,
    short: true
  }];

  if (!isWorking) {
    const buildTime = humanizeDuration(buildFinishTime - buildStartTime);

    fields.push({
      title: 'Duration',
      value: buildTime,
      short: true
    });
  }

  const message = {
    text,
    mrkdwn: true,
    username: 'gcb-bot',
    icon_emoji: ':robot_face:',
    attachments: [
      {
        color: STATUS_COLOR[build.status] || DEFAULT_COLOR,
        title: 'Build logs',
        title_link: build.logUrl,
        fields,
        footer: 'Google Cloud Build',
        footer_icon: 'https://ssl.gstatic.com/pantheon/images/containerregistry/container_registry_color.png',
        ts: timestamp,
      },
    ],
  };

  // Add source information to the message.
  const source = build.source || null;
  if (source) {
    if (source.repoSource) {
      message.attachments[0].fields.push({
        title: 'Repository',
        value: build.source.repoSource.repoName,
        short: true
      });
    } 
    
    if (source.repoSource) {
      message.attachments[0].fields.push({
        title: 'Branch',
        value: source.repoSource.branchName,
        short: true
      });
    }

    if (githubCommit) { 
      try {  
        message.attachments[0].fields.push({
          title: 'Commit Author',
          value: githubCommit.data.author.name,
          short: true
        });
      } catch(err) {
        //cannot retrieve author name. Log it and do not display it. 
        console.log(err);
      }
    } 
  }

  // Show the build type if it is deploy
  if (build.tags && build.tags.includes('deploy')) {
    message.attachments[0].fields.push({
      title: 'Type',
      value: 'deploy',
      short: true
    });
  }

  return message;
};
