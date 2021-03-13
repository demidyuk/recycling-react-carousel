const cloneDeep = require('lodash.clonedeep');
const path = require('path');

const addSvgrSupport = (config) => {
  const fileLoaderRule = config.module.rules.find(
    (rule) => !Array.isArray(rule.test) && rule.test.test('.svg')
  );
  fileLoaderRule.exclude = /\.svg$/;
  config.module.rules.push({
    test: /\.svg$/,
    use: [
      {
        loader: '@svgr/webpack',
        options: {
          svgoConfig: {
            plugins: {
              removeViewBox: false,
            },
          },
        },
      },
    ],
  });
};

const addScssSupport = (config) => {
  config.module.rules.push({
    test: /\.scss$/,
    use: ['style-loader', 'css-loader', 'sass-loader'],
    include: path.resolve(__dirname, '../'),
  });
};

const addCssModulesSupport = (config) => {
  const ruleCssIndex = config.module.rules.findIndex(
    (rule) => rule.test.toString() === '/\\.css$/'
  );
  const originalStyleRule = config.module.rules[ruleCssIndex];
  const modulesRule = cloneDeep(originalStyleRule);

  modulesRule.use.map((item) => {
    if (
      item.loader &&
      (item.loader === 'css-loader' || /\Wcss-loader\W/.test(item.loader))
    ) {
      // use more recent version of css-loader
      item.loader = 'css-loader';
      item.options.modules = {
        exportLocalsConvention: 'camelCase',
      };
    }
    return item;
  });

  originalStyleRule.exclude = /\.module\.css$/;
  modulesRule.include = /\.module\.css$/;
  config.module.rules.push(modulesRule);
};

module.exports = {
  stories: ['../stories/**/*.stories.@(ts|tsx|js|jsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-essentials'],
  // https://storybook.js.org/docs/react/configure/typescript#mainjs-configuration
  typescript: {
    check: true, // type-check stories during Storybook build
  },
  webpackFinal(config) {
    addSvgrSupport(config);
    addScssSupport(config);
    addCssModulesSupport(config);
    return config;
  },
};
