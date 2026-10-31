import {
  forwardRef,
  StrictMode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import RCarousel, {
  useCarousel,
  type RCarouselProps,
} from 'recycling-react-carousel';

const products = Array.from({ length: 8 }, (_, index) => ({ id: index }));
const renderProduct = ({ id: index }: { id: number }) => (
  <article
    key={index}
    data-api-index={index}
    style={{ height: index === 3 ? 240 : 120, background: '#ddd' }}
  >
    Product {index}
    <input aria-label={`Quantity ${index}`} defaultValue="1" />
    <button type="button" data-carousel-no-drag="">
      No drag {index}
    </button>
  </article>
);

const ProductCarousel = forwardRef<
  HTMLDivElement,
  RCarouselProps & { lazy: boolean }
>(function ProductCarousel({ lazy, ...props }, ref) {
  return lazy ? (
    <RCarousel
      {...props}
      ref={ref}
      children={undefined}
      items={products}
      getItemKey={(product) => product.id}
      renderItem={renderProduct}
    />
  ) : (
    <RCarousel {...props} ref={ref}>
      {products.map(renderProduct)}
    </RCarousel>
  );
});

function ApiExample({ lazy = false }: { lazy?: boolean }) {
  const carousel = useCarousel();
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [submissions, setSubmissions] = useState(0);
  const [settled, setSettled] = useState(0);
  const [actions, setActions] = useState(0);
  const [cancelDrag, setCancelDrag] = useState(false);
  const [alignment, setAlignment] = useState<'stretch' | 'center' | 'end'>(
    'stretch'
  );
  return (
    <StrictMode>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmissions((value) => value + 1);
        }}
        style={{ padding: 20 }}
      >
        <button {...carousel.getPrevButtonProps()}>API previous</button>
        <button {...carousel.getNextButtonProps()}>API next</button>
        <button
          {...carousel.getNextButtonProps({
            onClick: (event) => event.preventDefault(),
          })}
        >
          Cancel next
        </button>
        <button
          type="button"
          onClick={() => setWidth((value) => (value === 320 ? 640 : 320))}
        >
          Resize container
        </button>
        <button type="button" onClick={() => setCancelDrag((value) => !value)}>
          Cancel dragging
        </button>
        <button type="button" onClick={() => carousel.goTo(3)}>
          Tall content
        </button>
        <button type="button" onClick={() => setAlignment('center')}>
          Center content
        </button>
        <button type="button" onClick={() => setAlignment('end')}>
          End content
        </button>
        <div style={{ width }}>
          <ProductCarousel
            lazy={lazy}
            ref={root}
            controller={carousel}
            aria-label="API products"
            data-testid="api-carousel"
            slideAlign={alignment}
            slideStyle={{ padding: 8 }}
            breakpoints={{ 500: { slidesPerView: 2, slidesToScroll: 2 } }}
            animation={{ type: 'duration', duration: 100 }}
            onPointerDown={(event) => {
              if (cancelDrag) event.preventDefault();
            }}
            onSettle={() => setSettled((value) => value + 1)}
            onClick={() => setActions((value) => value + 1)}
          />
        </div>
        <output data-testid="api-index">{carousel.index}</output>
        <output data-testid="api-submissions">{submissions}</output>
        <output data-testid="api-settled">{settled}</output>
        <output data-testid="api-actions">{actions}</output>
      </form>
    </StrictMode>
  );
}

const meta = { title: 'Regression/Api', component: ApiExample } satisfies Meta<
  typeof ApiExample
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Contract: Story = {};
export const Items: Story = { render: () => <ApiExample lazy /> };

function VerticalContentExample() {
  const carousel = useCarousel();
  return (
    <>
      <button {...carousel.getPrevButtonProps()}>Vertical previous</button>
      <button {...carousel.getNextButtonProps()}>Vertical next</button>
      <RCarousel
        controller={carousel}
        axis="vertical"
        style={{ height: 200, userSelect: 'none' }}
        animation={false}
        aria-label="Vertical content"
        data-testid="vertical-content"
      >
        <div key="narrow" style={{ width: 120, height: '100%' }}>
          Narrow
        </div>
        <div key="wide" style={{ width: 240, height: '100%' }}>
          Wide
        </div>
      </RCarousel>
    </>
  );
}

export const VerticalContent: Story = {
  render: () => <VerticalContentExample />,
};

const paginationItems = Array.from({ length: 1000 }, (_, index) => index);

function PaginationExample() {
  const carousel = useCarousel();
  const [width, setWidth] = useState(600);
  const [count, setCount] = useState(8);
  const [mode, setMode] = useState<RCarouselProps['mode']>('finite');
  const [submissions, setSubmissions] = useState(0);
  const [requests, setRequests] = useState(0);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmissions((value) => value + 1);
      }}
    >
      <label>
        Pagination mode
        <select
          value={mode}
          onChange={(event) =>
            setMode(event.currentTarget.value as RCarouselProps['mode'])
          }
        >
          <option value="finite">Finite</option>
          <option value="loop">Loop</option>
          <option value="forward-loop">Forward loop</option>
        </select>
      </label>
      <button {...carousel.getPrevButtonProps()}>Previous page step</button>
      <button {...carousel.getNextButtonProps()}>Next page step</button>
      <button type="button" onClick={() => setWidth(800)}>
        Change pagination step
      </button>
      <button type="button" onClick={() => setWidth(1000)}>
        Resize pagination
      </button>
      <button type="button" onClick={() => setCount(4)}>
        Shrink pagination collection
      </button>
      <button type="button" onClick={() => setCount(1000)}>
        Large pagination collection
      </button>
      <button type="button" onClick={() => carousel.goToAbsolute(100)}>
        Jump pagination cycle
      </button>
      <button
        type="button"
        onClick={() => carousel.goToPage(carousel.pageCount - 1)}
      >
        Last page
      </button>
      <div style={{ width }}>
        <RCarousel
          id="pagination-carousel"
          controller={carousel}
          items={paginationItems.slice(0, count)}
          getItemKey={(item) => item}
          renderItem={(item) => <div>{item}</div>}
          slidesPerView={3}
          slidesToScroll={3}
          breakpoints={{
            700: { slidesToScroll: 1 },
            900: { slidesPerView: 4 },
          }}
          mode={mode}
          crossAxisSize="container"
          style={{ height: 200 }}
          animation={{ type: 'duration', duration: 100 }}
          onIndexChange={() => setRequests((value) => value + 1)}
        />
      </div>
      <div role="group" aria-label="Choose a page">
        {carousel.getPageIndexes().map((pageIndex) => (
          <button key={pageIndex} {...carousel.getPageButtonProps(pageIndex)}>
            {pageIndex + 1}
          </button>
        ))}
      </div>
      <button
        {...carousel.getPageButtonProps(2, {
          'aria-label': 'Cancel page',
          onClick: (event) => event.preventDefault(),
        })}
      >
        Cancelled
      </button>
      <button
        {...carousel.getPageButtonProps(1, {
          'aria-label': 'Disabled page',
          disabled: true,
        })}
      >
        Disabled
      </button>
      <output data-testid="pagination-page">
        {carousel.pageIndex === null ? 0 : carousel.pageIndex + 1}/
        {carousel.pageCount}
      </output>
      <output data-testid="pagination-index">{carousel.index}</output>
      <output data-testid="pagination-absolute-index">
        {carousel.absoluteIndex}
      </output>
      <output data-testid="pagination-submissions">{submissions}</output>
      <output data-testid="pagination-requests">{requests}</output>
    </form>
  );
}

export const Pagination: Story = {
  render: () => (
    <StrictMode>
      <PaginationExample />
    </StrictMode>
  ),
};

function PaginationEffectExample({
  useNavigate,
}: {
  useNavigate: typeof useEffect;
}) {
  const carousel = useCarousel();
  const [step, setStep] = useState(1);
  useNavigate(() => {
    if (step === 3) carousel.goToPage(2);
  }, [carousel, step]);
  return (
    <>
      <button type="button" onClick={() => setStep(3)}>
        Change step and select page
      </button>
      <RCarousel
        controller={carousel}
        slidesPerView={3}
        slidesToScroll={step}
        crossAxisSize="container"
        style={{ width: 600, height: 200 }}
        animation={false}
        aria-label="Effect-driven pagination"
      >
        {products.map(({ id }) => (
          <div key={id}>{id}</div>
        ))}
      </RCarousel>
      <output data-testid="effect-page">
        {carousel.pageIndex === null ? 0 : carousel.pageIndex + 1}/
        {carousel.pageCount}
      </output>
      <output data-testid="effect-index">{carousel.index}</output>
    </>
  );
}

export const PaginationPassiveEffect: Story = {
  render: () => (
    <StrictMode>
      <PaginationEffectExample useNavigate={useEffect} />
    </StrictMode>
  ),
};

export const PaginationLayoutEffect: Story = {
  render: () => (
    <StrictMode>
      <PaginationEffectExample useNavigate={useLayoutEffect} />
    </StrictMode>
  ),
};
