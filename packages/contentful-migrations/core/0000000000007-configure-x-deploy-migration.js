/* eslint-env node */
const { withHelpers } = require('@jungvonmatt/contentful-migrations');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const readJsonAsync = async (filepath, options) => {
  const content = await readFileAsync(filepath, options);
  return JSON.parse(content);
};

/**
 * Contentful migration to configure the deploy content type
 */
module.exports = withHelpers(async (migration, context, helpers) => {
  const { makeRequest } = context;
  const deploy = migration.editContentType('x-deploy');
  const defaultLocale = await helpers.locale.getDefaultLocale();

  // Remove default sidebar widgets
  const defaultWidgets = [
    {
      widgetId: 'publication-widget',
      widgetNamespace: 'sidebar-builtin',
    },
    {
      widgetId: 'content-workflows-tasks-widget',
      widgetNamespace: 'sidebar-builtin',
    },
    {
      widgetId: 'content-preview-widget',
      widgetNamespace: 'sidebar-builtin',
    },
    {
      widgetId: 'incoming-links-widget',
      widgetNamespace: 'sidebar-builtin',
    },
    {
      widgetId: 'translation-widget',
      widgetNamespace: 'sidebar-builtin',
    },
    {
      widgetId: 'versions-widget',
      widgetNamespace: 'sidebar-builtin',
    },
    {
      widgetId: 'users-widget',
      widgetNamespace: 'sidebar-builtin',
    },
  ];
  defaultWidgets.forEach(({ widgetId, widgetNamespace }) => deploy.removeSidebarWidget(widgetNamespace, widgetId));

  // Check if deploy-with-confirmation extension is installed
  const { items: extensions } = await makeRequest({
    method: 'GET',
    url: '/extensions',
  });
  // Add extension
  if (!extensions.flatMap((e) => [e.sys.id, e.extension.name]).includes('deploy-with-confirmation')) {
    const dir = path.join(__dirname, '../apps/deploy-with-confirmation');
    const { id, ...extension } = await readJsonAsync(path.join(dir, 'extension.json'));
    extension.srcdoc = await readFileAsync(path.join(dir, extension.srcdoc), 'utf8');

    await makeRequest({
      method: 'PUT',
      url: id ? `/extensions/${id}` : '/extensions',
      data: { extension },
    });
  }

  // Add deploy-with-confirmation sidebar widget
  deploy.addSidebarWidget('extension', 'deploy-with-confirmation');

  await makeRequest({
    method: 'PUT',
    url: `/entries/deploy-to-preview`,
    headers: { 'X-Contentful-Content-Type': 'x-deploy' },
    data: {
      fields: {
        internal_name: {
          [defaultLocale.code]: 'Deploy to preview',
        },
      },
    },
  });
  await makeRequest({
    method: 'PUT',
    url: `/entries/deploy-to-staging`,
    headers: { 'X-Contentful-Content-Type': 'x-deploy' },
    data: {
      fields: {
        internal_name: {
          [defaultLocale.code]: 'Deploy to staging',
        },
      },
    },
  });
  await makeRequest({
    method: 'PUT',
    url: `/entries/deploy-to-production`,
    headers: { 'X-Contentful-Content-Type': 'x-deploy' },
    data: {
      fields: {
        internal_name: {
          [defaultLocale.code]: 'Deploy to production',
        },
      },
    },
  });
});
