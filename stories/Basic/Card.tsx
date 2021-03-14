import React from 'react';

const Card = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className="card shadow-sm h-100" {...rest}>
      <div className="d-flex align-items-center justify-content-center card-body p-2 user-select-none">
        <h1 className="text-dark m-0">{children}</h1>
      </div>
    </div>
  );
};
export default Card;
