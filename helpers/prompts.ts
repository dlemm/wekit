import chalk from 'chalk';
import { resolve } from 'dns';
import inquirer, { QuestionCollection } from 'inquirer';
import { cosmiconfig, Loader } from 'cosmiconfig';
import type { CosmiconfigResult } from 'cosmiconfig/dist/types';
import { ClientOptions, getApiKey, getEnvironments, getPreviewApiKey, getSpaces } from './contentful';


const loadConfig = async (moduleName: string): Promise<CosmiconfigResult> => {
  const explorer = cosmiconfig(moduleName, {
    searchPlaces: [
      'package.json',
      `.${moduleName}rc`,
      `.${moduleName}rc.json`,
      `.${moduleName}rc.yaml`,
      `.${moduleName}rc.yml`,
      `.${moduleName}rc.js`,
      `${moduleName}.config.js`,
    ]
  });

  return explorer.search();
};

type ContentfulConfig = {
  managementToken: string;
  activeSpaceId?: string;
  activeEnvironmentId?: string;
  host?: string;
}

const getContentfulConfig = async ():Promise<ContentfulConfig> => {
  const contentfulConfig = await loadConfig('contentful');
  if (contentfulConfig && !contentfulConfig.isEmpty) {
    return contentfulConfig.config;
  }

  throw new Error('You need to login first. Run npx contentful login');
}

type Answers = {
  accessToken: string;
  spaceId: string;
  environmentId: string
  deliveryToken: string;
  previewToken: string;
}

type Questions = QuestionCollection<Answers>;

const getPromts = (data: ContentfulConfig): Questions => [
  {
    type: 'list',
    name: 'spaceId',
    message: 'Space ID',
    choices: async () => {
      const spaces = await getSpaces(data.managementToken || '');
      return spaces.map((space) => ({
        name: `${space.name} (${space.sys.id})`,
        value: space.sys.id,
      }));
    },
    default() {
      return data.activeSpaceId
    }
  },
  {
    type: 'list',
    name: 'environmentId',
    message: 'Environment Id',
    when(answers) {
      return Boolean(answers.spaceId);
    },
    choices: async (answers) => {
      const environments = await getEnvironments(answers.spaceId, data.managementToken || '');
      return environments.map((environment) => environment.sys.id);
    },
    default() {
      return data.activeEnvironmentId
    }
  },
  {
    type: 'input',
    name: 'deliveryToken',
    message: 'Content Delivery API - access token',
    when(answers) {
      return Boolean(answers.spaceId);
    },
    async default(answers:Answers) {
      return getApiKey(answers.spaceId, data.managementToken || '');
    },
  },
  {
    type: 'input',
    name: 'previewToken',
    message: 'Content Preview API - access token',
    when(answers) {
      return Boolean(answers.spaceId);
    },
    async default(answers:Answers) {
      return getPreviewApiKey(answers.spaceId, data.managementToken || '');
    },
  },
];

/**
 * Ask all promts and use values in data as default
 * @param {Object} data Data to check
 * @returns {Object} Object with the answers
 */
 export const ask = async (): Promise<Answers> => {
  console.log('Please verify the following options');

  const config = await getContentfulConfig();

  return inquirer.prompt(getPromts(config));
};