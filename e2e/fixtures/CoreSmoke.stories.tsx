import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel from 'recycling-react-carousel';

const image = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><rect width="600" height="120" fill="#245ac4"/></svg>'
)}`;

function CoreSmoke() {
  const [cursor, setCursor] = useState(0);
  const [actions, setActions] = useState(0);

  return (
    <main style={{ width: '100%', maxWidth: 600, minHeight: 1800 }}>
      <button
        type="button"
        disabled={cursor === 0}
        onClick={() => setCursor((value) => value - 1)}
      >
        Previous slide
      </button>
      <button
        type="button"
        disabled={cursor === 3}
        onClick={() => setCursor((value) => value + 1)}
      >
        Next slide
      </button>
      <output data-testid="smoke-cursor">{cursor}</output>
      <output data-testid="smoke-actions">{actions}</output>
      <RCarousel
        crossAxisSize="container"
        aria-label="Image cards"
        data-testid="smoke-carousel"
        absoluteIndex={cursor}
        onAbsoluteIndexChange={setCursor}
        slidesPerView={1}
        style={{ height: 200, userSelect: 'none' }}
        animation={{ type: 'duration' as const, duration: 100 }}
      >
        {[0, 1, 2, 3].map((index) => (
          <article key={index} data-testid={`smoke-slide-${index}`}>
            <img
              src={image}
              alt={`Card ${index}`}
              style={{ display: 'block', width: '100%', height: 120 }}
            />
            <button
              type="button"
              style={{ display: 'block', width: '100%', height: 40 }}
              onClick={() => setActions((value) => value + 1)}
            >
              Card {index} action
            </button>
            <a
              href={`#card-${index}`}
              onClick={(event) => {
                event.preventDefault();
                setActions((value) => value + 1);
              }}
            >
              Card {index} details
            </a>
          </article>
        ))}
      </RCarousel>
      <p>Page content remains vertically scrollable below the carousel.</p>
    </main>
  );
}

const meta = {
  title: 'Regression/Core smoke',
  component: CoreSmoke,
} satisfies Meta<typeof CoreSmoke>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Content: Story = {};
