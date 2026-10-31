/* global require */
const library = require('recycling-react-carousel');
if (
  library.default !== library.RCarousel ||
  !library.RCarousel ||
  typeof library.useCarousel !== 'function'
) {
  throw new Error('CommonJS exports are invalid');
}
if (Object.keys(library).sort().join(',') !== 'RCarousel,default,useCarousel')
  throw new Error('Unexpected CommonJS exports');
