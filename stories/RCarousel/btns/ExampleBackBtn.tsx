import React from 'react';
import IconBtn from './IconBtn';
import ArrowLeft from './arrows/left.svg';

const ExampleBackBtn = ({ ...props }) => (
  <IconBtn {...props}>
    <ArrowLeft width={32} height={32} />
  </IconBtn>
);

export default ExampleBackBtn;
