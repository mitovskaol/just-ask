import {
  createAppAuth,
} from "@octokit/auth";
import { request } from "@octokit/request";
import { readFileSync } from 'fs';
import {  every, intersectionBy, isArray,  isObject, isString } from "lodash";
import path from 'path';
import { getConfig, getSSO } from "./config";
import log from 'log';
import { getOidcDiscovery } from "./sso";


const file = readFileSync(path.join(__dirname, '../config/github-private-key.pem'));

// cached value
const installationApps = {
  initialized: null,
  apps: {}
};



const auth = createAppAuth({
  appId: process.env.APP_ID,
  privateKey: file.toString(),
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});

const requestWithAuth = request.defaults({
  request: {
    hook: auth.hook,
  },
  mediaType: {
    previews: ["machine-man"],
  },
});



export const getInstallations = async () => {
  log.info('getInstallations');
  const response = await requestWithAuth('GET /app/installations');
  return response.data;
}

export const getOrgInstallations = async () => {
  const config = getConfig();

  if(!isObject(config) || !isArray(config.orgs) || !every(config.orgs, isString) || config.orgs.length === 0) {
    throw new Error('Configuration is invalid. config.orgs is invalid or misconfigured');
  }
  const installations = await getInstallations();

    
  const matchedInstallations = intersectionBy( installations, config.orgs.map(org => ({ account: {login: org}})), 'account.login')
  .filter(installation => installation.target_type === 'Organization')
  if(matchedInstallations.length === 0) {
    log.info(`This github app has no public org installations yet`);
  }
  return matchedInstallations;
}

const newAuthorizedApp = installationId => {
  const app =  createAppAuth({
    appId: process.env.APP_ID,
    privateKey: file.toString(),
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    installationId,
  });
  log.info(`authorized application created for installation ${installationId}`);
  return {
    initialized: Date.now(),
    app,
    id: installationId,
    authenticatedRequest:  request.defaults({
      request: {
        hook: app.hook,
      },
      mediaType: {
        previews: ["machine-man"],
      },
    })
  }
}
/**
 * a new authenticated app must be created for every installation in order to invite users
 */
const getAuthenticatedApps = async () => {
  if(!installationApps.initialized) {
    log.info('Initializing Authenticated Apps');
    installationApps.initialized = Date.now();
    const installations = await getOrgInstallations();
    
    installations.forEach(installation => {
      const name = installation.account.login.toLowerCase();
      if(!installationApps.apps[name]) {
        installationApps.apps[name] = newAuthorizedApp(installation.id);
      }
  
    });
  } else {
    log.info(`Authenticated Apps were cached, reusing the ones initialized on ${installationApps.initialized}`);
  }


  return installationApps;
}



/**
 * initializes and validates SSO config as well as github applications
 * all errors bubble to top to quit process
 */
export const init = async () => {
  // check SSO Config
  log.info('Checking SSO Configuration');
  let ssoConfig;
  try {
    ssoConfig = getSSO();
  } catch(e) {
    log.warn("Unable to get sso config. Does it exist? ");
    log.warn(e.message);
    throw e;
  }
  log.info('Checking OIDC Discovery');
  await getOidcDiscovery(ssoConfig.discovery);
  log.info('Checking Authenticated Apps');
  await getAuthenticatedApps();
}

export default init;