import React, { useState } from 'react';
import { Meta, Story } from '@storybook/react';
import RCarousel, { useCursor, RCarouselProps } from 'recycling-react-carousel';
import Card from './Card';
import ArrowLeft from './arrows/left.svg';
import ArrowRight from './arrows/right.svg';
import IconBtn from './IconBtn';

export default {
  title: 'RCarousel',
  component: RCarousel,
  parameters: {
    docs: {
      source: {
        type: 'code',
      },
    },
  },
  decorators: [
    (story) => (
      <div className="container d-flex align-items-center justify-content-center">
        {story()}
      </div>
    ),
  ],
} as Meta;

const Template: Story<RCarouselProps> = (args) => {
  const [items] = useState(
    Array(6)
      .fill(undefined)
      .map((_, i) => i + 1)
  );

  const { props, nextBtnProps, backBtnProps } = useCursor();
  const slides = items.map((data) => <Card key={data}>{data}</Card>);

  return (
    <>
      <IconBtn {...backBtnProps}>
        <ArrowLeft width={32} height={32} />
      </IconBtn>
      <RCarousel {...args} {...props}>
        {slides}
      </RCarousel>
      <IconBtn {...nextBtnProps}>
        <ArrowRight width={32} height={32} />
      </IconBtn>
    </>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  displayAtOnce: 3,
  style: { height: 250 },
  itemWrapperStyle: { padding: 10 },
  userSelect: false,
};

export const BasicInfinite = Template.bind({});
BasicInfinite.args = { ...Basic.args, infinite: true };
