import { createElement as h } from 'react';
import Carousel, { useCarousel } from 'recycling-react-carousel';

function ControllerProbe() {
  const carousel = useCarousel();
  return h(
    'section',
    null,
    h('output', { id: 'probe-absolute-index' }, carousel.absoluteIndex),
    h('output', { id: 'probe-local-index' }, carousel.index),
    h(
      'button',
      { type: 'button', onClick: () => carousel.goTo(2) },
      'Select local slide 2'
    ),
    h(
      'button',
      { type: 'button', onClick: () => carousel.moveBy(1) },
      'Advance absolute index'
    ),
    h(Carousel, {
      controller: carousel,
      defaultAbsoluteIndex: 100,
      mode: 'forward-loop',
      'aria-label': 'Loop navigation probe',
      crossAxisSize: 'container',
      style: { width: 320, height: 80 },
      animation: false,
      items: [0, 1, 2],
      getItemKey: (index) => index,
      renderItem: (index) => h('span', null, `Probe ${index}`),
    })
  );
}

export function App() {
  const carousel = useCarousel();
  return h(
    'main',
    null,
    h('button', carousel.getPrevButtonProps(), 'Previous'),
    h(
      Carousel,
      {
        controller: carousel,
        id: 'carousel',
        'aria-label': 'Photo gallery',
        mode: 'finite',
        axis: 'horizontal',
        slidesPerView: 1,
        gap: 16,
        crossAxisSize: 'container',
        style: { width: 320, height: 160 },
        animation: { type: 'duration', duration: 80 },
      },
      h('div', { key: 'first', id: 'first-slide' }, 'First slide'),
      h('div', { key: 'second', id: 'second-slide' }, 'Second slide'),
      h('div', { key: 'third', id: 'third-slide' }, 'Third slide')
    ),
    h('button', carousel.getNextButtonProps(), 'Next'),
    h('output', { id: 'cursor' }, carousel.absoluteIndex),
    h(ControllerProbe)
  );
}
