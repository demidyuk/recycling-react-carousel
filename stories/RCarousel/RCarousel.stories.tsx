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
Basic.storyName = 'basic usage';
Basic.args = {
  style: { height: 250 },
  itemWrapperStyle: { padding: 10 },
  userSelect: false,
};

export const Autosize = Template.bind({});
Autosize.storyName = 'autosize mode (autosize prop)';
Autosize.args = {
  autosize: true,
  displayAtOnce: 3,
  itemWrapperStyle: { padding: 10 },
  userSelect: false,
};

export const DisplayAtOnce = Template.bind({});
DisplayAtOnce.storyName = 'displayAtOnce prop hardcoded';
DisplayAtOnce.args = {
  displayAtOnce: 2,
  ...Basic.args,
};

export const DisplayAtOnceDynamic = Template.bind({});
DisplayAtOnceDynamic.storyName = 'displayAtOnce prop dynamic';
DisplayAtOnceDynamic.args = {
  displayAtOnce: [
    { value: 1 },
    { breakpoint: 576, value: 2 },
    { breakpoint: 768, value: 3 },
    { breakpoint: 992, value: 4 },
  ],
  ...Basic.args,
};

export const SlidesToSwipe = Template.bind({});
SlidesToSwipe.storyName = 'slidesToSwipe=3 (displayAtOnce prop)';
SlidesToSwipe.args = {
  displayAtOnce: [{ value: 3, slidesToSwipe: 3 }],
  ...Basic.args,
};

export const MaxItemSize = Template.bind({});
MaxItemSize.storyName = 'maxItemSize prop';
MaxItemSize.args = {
  maxItemSize: '200px',
  ...Basic.args,
};

export const Controlled = TemplateControlled.bind({});
Controlled.storyName = 'controlled mode';
Controlled.args = {
  displayAtOnce: 3,
  ...Basic.args,
};

export const Infinite = Template.bind({});
Infinite.storyName = 'infinite prop';
Infinite.args = { infinite: true, ...Basic.args };

export const Loop = Template.bind({});
Loop.storyName = 'loop prop';
Loop.args = { loop: true, ...Basic.args };

export const Vertical = Template.bind({});
Vertical.storyName = 'vertical mode (y prop)';
Vertical.args = { y: true, ...Basic.args };

export const swipeThreshold = Template.bind({});
swipeThreshold.storyName = 'swipeThreshold prop (always 20px)';
swipeThreshold.args = { swipeThreshold: '20px', ...Basic.args };

export const trimEnd = TemplateControlled.bind({});
trimEnd.storyName = 'no empty slots at the end (trimEnd prop)';
trimEnd.args = { trimEnd: true, ...Controlled.args };

export const SpringConfig = TemplateControlled.bind({});
SpringConfig.storyName = 'custom swipe animation (springConfig prop)';
SpringConfig.args = {
  springConfig: { mass: 1, tension: 180, friction: 12 },
  ...Controlled.args,
};

export const GesturesDisabled = TemplateControlled.bind({});
GesturesDisabled.storyName = 'gestures disabled';
GesturesDisabled.args = {
  gestures: false,
  ...Controlled.args,
};

export const FitContent = Template.bind({});
FitContent.storyName = 'fitContent prop';
FitContent.args = {
  displayAtOnce: 3,
  fitContent: true,
  ...Basic.args,
};

export const FitContentWithAlignCenter = Template.bind({});
FitContentWithAlignCenter.storyName = 'fitContent + alignCenter props';
FitContentWithAlignCenter.args = {
  displayAtOnce: 3,
  fitContent: true,
  alignCenter: true,
  ...Basic.args,
};
