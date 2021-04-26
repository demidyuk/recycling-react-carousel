import React from 'react';
import IconBtn from './IconBtn';
import ArrowRight from './arrows/right.svg';

const ExampleNextBtn = ({ ...props }) => (
  <IconBtn {...props}>
    <ArrowRight width={32} height={32} />
  </IconBtn>
);

export default ExampleNextBtn;
