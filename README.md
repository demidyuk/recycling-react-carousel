# recycling-react-carousel

This carousel is designed to handle a large number of slides efficiently. It was originally created for my internal project and I decided to publish it. At the moment it almost fits my needs, but I will try to expand its functionality whenever possible.

Under the hood this component uses 2 awesome libraries: [react-spring](https://github.com/react-spring/react-spring) and [react-use-gesture](https://github.com/pmndrs/react-use-gesture).

### Installation

```bash
npm install recycling-react-carousel
```

### Basic usage

```jsx
import React, { useState } from 'react';
import RCarousel, { useCursor } from 'recycling-react-carousel';

const BasicCarousel = () => {
  const { props, nextBtnProps, backBtnProps } = useCursor();
  const slides = [1, 2, 3, 4, 5, 6].map((data) => <div key={data}>{data}</div>);

  return (
    <div>
      <button {...backBtnProps}>back</button>
      <RCarousel
        displayAtOnce={3}
        style={{ height: 250 }}
        itemWrapperStyle={{ padding: 10 }}
        {...props}
      >
        {slides}
      </RCarousel>
      <button {...nextBtnProps}>next</button>
    </div>
  );
};

export default BasicCarousel;
```

It is up to you how to style it.
