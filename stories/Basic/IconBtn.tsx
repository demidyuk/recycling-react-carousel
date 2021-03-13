import React from 'react';

const IconBtn = ({
  children,
  ...rest
}: React.HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button className="btn" style={{ zIndex: 1 }} {...rest}>
      {children}
    </button>
  );
};

export default IconBtn;
