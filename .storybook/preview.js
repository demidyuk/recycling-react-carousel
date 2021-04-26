import './styles.scss';
import prettier from 'prettier/standalone';
import babylon from 'prettier/parser-babel';

const ARGS_VAR_NAME = 'args';
const prettierOptions = {
  semi: false,
  printWidth: 80,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
};

const getProps = ({ args, argTypes }) =>
  Object.entries(args)
    .filter(([propName, value]) => {
      if (
        typeof value !== 'function' &&
        value !== argTypes[propName].defaultValue
      ) {
        return true;
      }
      return false;
    })
    .map(([propName, value]) => {
      if (value === true) return propName;
      return `${propName}={${JSON.stringify(value)}}`;
    })
    .join(' ');

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  docs: {
    transformSource: (src, storyContext) => {
      const srcWithProps = src
        .replace(`(${ARGS_VAR_NAME})`, `()`)
        .replace(`{...${ARGS_VAR_NAME}}`, getProps(storyContext));

      return prettier.format(srcWithProps, {
        parser: 'babel',
        plugins: [babylon],
        ...prettierOptions,
      });
    },
  },
};
