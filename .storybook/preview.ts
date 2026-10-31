import type { Preview } from '@storybook/react-vite';
import './styles.css';

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: [
          'RCarousel',
          [
            'Docs',
            'Basic dragging',
            'Navigation buttons',
            'Pagination',
            'Loop',
            'Forward loop',
            'Multiple slides',
            'Scroll step',
            'Centered slides',
            'Auto sizing',
            'Container breakpoints',
            'Vertical axis',
            'Free dragging',
            'Wheel input',
            'Vertical wheel',
            'Content height',
            'Expandable content',
            'Fixed height',
            'Spring animation',
            'Duration animation',
            'Large collections',
            'Infinite loading',
          ],
        ],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
