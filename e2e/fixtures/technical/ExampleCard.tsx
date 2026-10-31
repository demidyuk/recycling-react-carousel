import React from 'react';
import styles from './Examples.module.css';

const landscape = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120"><rect width="480" height="120" fill="#dcebe7"/><path d="M0 120 130 18 240 120 350 34 480 120" fill="#5c8a7b"/><circle cx="395" cy="27" r="14" fill="#f3c871"/></svg>'
)}`;

const ExampleCard = ({
  children,
  index,
  rich = false,
  intrinsic = false,
  tall = false,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  index?: number;
  rich?: boolean;
  intrinsic?: boolean;
  tall?: boolean;
}) => {
  return (
    <div
      className={[
        styles.card,
        intrinsic && styles.intrinsic,
        tall && styles.tall,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {rich && (
        <img
          src={landscape}
          alt="Illustrated mountain landscape"
          draggable={false}
        />
      )}
      <h2>{children}</h2>
      {rich && <p>A place to explore</p>}
      {intrinsic && !tall && <p>A short field note.</p>}
      {rich && (
        <dl>
          <dt>Collection</dt>
          <dd>Field notes</dd>
          <dt>Edition</dt>
          <dd>{(index ?? 0) + 1}</dd>
          <dt>Format</dt>
          <dd>Illustrated guide</dd>
        </dl>
      )}
      {tall && (
        <>
          <p>
            A longer field note gives this slide its natural height. Content can
            be a mixture of headings, images, and text.
          </p>
          <p>
            Autosize follows the visible content and makes room for a taller
            incoming slide.
          </p>
          <p>Navigate to the last slide to return to shorter content.</p>
        </>
      )}
    </div>
  );
};
export default ExampleCard;
