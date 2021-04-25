import React from 'react';
import { Meta, Story } from '@storybook/react';
import RCarousel, { useCursor, RCarouselProps } from 'recycling-react-carousel';
import ExampleCard from './ExampleCard';
import { ExampleBackBtn, ExampleNextBtn } from './btns';

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

const Template: Story<RCarouselProps> = (args) => (
  <RCarousel {...args}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <ExampleCard key={i}>{i}</ExampleCard>
    ))}
  </RCarousel>
);

const TemplateControlled: Story<RCarouselProps> = (args) => {
  const { props, backBtnProps, nextBtnProps } = useCursor();

  return (
    <>
      <ExampleBackBtn {...backBtnProps} />
      <RCarousel {...args} {...props}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ExampleCard key={i}>{i}</ExampleCard>
        ))}
      </RCarousel>
      <ExampleNextBtn {...nextBtnProps} />
    </>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  style: { height: 250 },
  itemWrapperStyle: { padding: 10 },
  userSelect: false,
};

export const DisplayAtOnce = Template.bind({});
DisplayAtOnce.storyName = 'DisplayAtOnce hardcoded';
DisplayAtOnce.args = {
  displayAtOnce: 2,
  ...Basic.args,
};

export const Controlled = TemplateControlled.bind({});
Controlled.args = {
  displayAtOnce: 3,
  ...Basic.args,
};

export const Infinite = Template.bind({});
Infinite.args = { ...Basic.args, infinite: true };

export const Loop = Template.bind({});
Loop.args = { ...Basic.args, loop: true };
