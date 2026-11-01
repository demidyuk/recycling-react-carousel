import Carousel, { RCarousel, useCarousel } from 'recycling-react-carousel';
if (Carousel !== RCarousel || typeof useCarousel !== 'function') {
  throw new Error('ESM exports are invalid');
}
import * as library from 'recycling-react-carousel';
if (Object.keys(library).sort().join(',') !== 'RCarousel,default,useCarousel')
  throw new Error('Unexpected ESM exports');
