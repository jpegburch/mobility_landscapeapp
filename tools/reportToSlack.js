import rp from 'request-promise';
import _ from 'lodash';

export async function report({ returnCode, logs, slackChannel, icon_url, name, onlyErrors = false }) {
  const url = `https://hooks.slack.com/services/${slackChannel}`;
  const errorsAndWarnings = JSON.parse(require('fs').readFileSync('/tmp/landscape.json', 'utf-8'));
  console.info(errorsAndWarnings);
  const errorStatus = returnCode === 0 ? 'SUCCESS' : 'FAILURE'
  const fields = _.map(_.keys(errorsAndWarnings.warnings), function(key) {
    const value = errorsAndWarnings.warnings[key];
    const kind = errorsAndWarnings.errors[key] ? 'errors' : 'warnings';
    return {
      title: `${key} ${kind}:`,
      value: value,
      short: true
    }
  });

  if (returnCode === 0 && onlyErrors) {
    return
  }

  const logContent = (function() {
    const lines = logs.join('').split('\n');
    const lastYarnLine = lines.indexOf('Processing the tree while reporting to slack');
    const remainingLines = lines.slice(lastYarnLine);
    return remainingLines.join('\n');
  })();

  const checkLinksData = (function() {
    try {
      return JSON.parse(require('fs').readFileSync('/tmp/links.json', 'utf-8'));
    } catch(ex) {
      return {
        messages: '',
        numberOfErrors: 0
      }
    }
  })();

  const updateAttachment = {
    title: 'Log File: (update.log)',
    text: logContent,
    fields: fields,
    color: returnCode === 0 ? 'good' : 'danger'
  }

  const linksAttachment = {
    title: 'Check links result',
    text: checkLinksData.messages,
    color: checkLinksData.numberOfErrors > 0 ? 'danger' : 'good',
    fields: [{
      title: '# of Errors',
      value: checkLinksData.numberOfErrors
    }]
  }

  const attachments = [
    returnCode === 0 && onlyErrors ? null : updateAttachment,
    checkLinksData.numberOfErrors === 0 && onlyErrors ? null : linksAttachment
  ].filter(_ => _)

  if (attachments.length === 0) {
    return
  }

  const payload = {
    text: `Update from ${new Date().toISOString()} finished with ${errorStatus}`,
    username: `${name} Landscape Update`,
    icon_url,
    attachments
  };

  const result = await rp({
    method: 'POST',
    json: payload,
    url: url
  });
}
