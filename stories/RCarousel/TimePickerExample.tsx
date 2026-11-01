import { useCallback, useEffect, useId, useRef, useState } from 'react';
import RCarousel, {
  useCarousel,
  type CarouselController,
  type RCarouselProps,
} from 'recycling-react-carousel';
import { Demo, demoViewportProps } from './Demo.js';
import styles from './TimePickerExample.module.css';

const hours = Array.from({ length: 24 }, (_, value) => value);
const minutes = Array.from({ length: 60 }, (_, value) => value);
const format = (value: number) => String(value).padStart(2, '0');
const FACE_ANGLE = 20;

function PickerWheel({
  args,
  controller,
  values,
  initial,
  selected,
  onValueChange,
  label,
  unit,
  hint,
  testId,
}: {
  args: RCarouselProps;
  controller: CarouselController;
  values: number[];
  initial: number;
  selected: number;
  onValueChange: (value: number) => void;
  label: string;
  unit: string;
  hint: string;
  testId: string;
}) {
  const column = useRef<HTMLDivElement>(null);
  const pressPoint = useRef<{ x: number; y: number } | null>(null);
  const liveValue = useRef(initial);
  const hasPosition =
    args.index !== undefined ||
    args.absoluteIndex !== undefined ||
    args.defaultIndex !== undefined ||
    args.defaultAbsoluteIndex !== undefined;
  const { key, ...viewport } = demoViewportProps({
    ...args,
    ...(hasPosition ? {} : { defaultIndex: initial }),
  });

  useEffect(() => {
    let anchor: number | undefined;
    let size: number | undefined;
    return controller.subscribeMotion((motion) => {
      const surface = column.current;
      if (!surface) return;
      const vertical = motion.axis === 'vertical';
      const radius =
        motion.slidePitch / (2 * Math.tan((FACE_ANGLE * Math.PI) / 360));
      const perspective = Math.max(1000, radius * 8);
      if (surface.dataset.axis !== motion.axis)
        surface.dataset.axis = motion.axis;
      if (anchor !== motion.anchor) {
        anchor = motion.anchor;
        surface.style.setProperty('--picker-anchor', anchor + 'px');
        surface.parentElement?.style.setProperty(
          '--picker-anchor',
          anchor + 'px'
        );
      }
      if (size !== motion.slideSize) {
        size = motion.slideSize;
        surface.parentElement?.style.setProperty(
          '--picker-band-size',
          size * 1.4 + 'px'
        );
      }
      const side = label === 'Hours' ? 1 : -1;
      let nearest: { value: number; distance: number } | undefined;
      for (const slide of motion.slides) {
        const face =
          slide.element.querySelector<HTMLElement>('[data-picker-face]');
        if (!face) continue;
        if (!nearest || Math.abs(slide.distance) < nearest.distance)
          nearest = {
            value: slide.index,
            distance: Math.abs(slide.distance),
          };
        const angle = slide.distance * FACE_ANGLE;
        const visible = Math.abs(angle) < 85;
        const visibility = visible ? 'visible' : 'hidden';
        if (face.style.visibility !== visibility)
          face.style.visibility = visibility;
        if (!visible) continue;
        // Cancel the flat row's translation, then project it onto a cylinder.
        const offset = -slide.distance * motion.slidePitch;
        face.style.transformOrigin = vertical
          ? `calc(50% + ${side * 130}px) center`
          : 'center';
        face.style.transform = `translateX(${vertical ? side * 27 : 0}px) translate${vertical ? 'Y' : 'X'}(${offset}px) perspective(${perspective}px) translateZ(${radius}px) rotate${vertical ? 'X' : 'Y'}(${angle * (vertical ? -1 : 1)}deg) translateZ(${radius}px)`;
      }
      if (nearest && nearest.value !== liveValue.current) {
        liveValue.current = nearest.value;
        onValueChange(nearest.value);
      }
    });
  }, [controller, label, onValueChange]);

  return (
    <div ref={column} className={styles.column} data-axis={args.axis}>
      <RCarousel
        key={key}
        {...viewport}
        className={`${viewport.className} ${styles.wheel}`}
        controller={controller}
        role="spinbutton"
        aria-roledescription="picker wheel"
        aria-label={label}
        aria-describedby={hint}
        aria-valuemin={0}
        aria-valuemax={values.length - 1}
        aria-valuenow={selected}
        aria-valuetext={`${selected} ${label.toLowerCase()}`}
        tabIndex={0}
        data-testid={testId}
        children={undefined}
        items={values}
        getItemKey={(value) => value}
        onPointerDownCapture={(event) => {
          args.onPointerDownCapture?.(event);
          pressPoint.current = { x: event.clientX, y: event.clientY };
        }}
        onKeyDown={(event) => {
          args.onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          switch (event.key) {
            case 'ArrowUp':
            case 'ArrowRight':
              controller.next();
              break;
            case 'ArrowDown':
            case 'ArrowLeft':
              controller.prev();
              break;
            case 'PageUp':
              controller.moveBy(5);
              break;
            case 'PageDown':
              controller.moveBy(-5);
              break;
            case 'Home':
              controller.goTo(0);
              break;
            case 'End':
              controller.goTo(values.length - 1);
              break;
            default:
              return;
          }
          event.preventDefault();
        }}
        onClick={(event) => {
          args.onClick?.(event);
          if (event.defaultPrevented) return;
          // A moved pointer still produces native clicks when dragging is disabled.
          const press = pressPoint.current;
          pressPoint.current = null;
          if (
            event.detail > 0 &&
            press &&
            Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8
          )
            return;
          const vertical = column.current?.dataset.axis === 'vertical';
          const coordinate = vertical ? event.clientY : event.clientX;
          const target = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              '[data-picker-face]'
            )
          )
            .filter((face) => face.style.visibility === 'visible')
            .map((face) => {
              const box = face.getBoundingClientRect();
              return {
                face,
                distance: Math.abs(
                  (vertical ? box.y + box.height / 2 : box.x + box.width / 2) -
                    coordinate
                ),
              };
            })
            .sort((a, b) => a.distance - b.distance)[0];
          if (target) controller.goTo(Number(target.face.dataset.pickerFace));
        }}
        renderItem={(value) => (
          <div
            className={styles.option}
            data-picker-option={value}
            aria-hidden="true"
          >
            <span className={styles.number} data-picker-face={value}>
              {value}
            </span>
          </div>
        )}
      />
      <span
        className={
          unit === 'min' ? `${styles.unit} ${styles.minuteUnit}` : styles.unit
        }
        aria-hidden="true"
      >
        {unit}
      </span>
    </div>
  );
}

export function TimePickerExample(args: RCarouselProps) {
  const hour = useCarousel();
  const minute = useCarousel();
  const hint = useId();
  const [selection, setSelection] = useState({ hour: 12, minute: 0 });
  const changeHour = useCallback(
    (value: number) =>
      setSelection((current) =>
        current.hour === value ? current : { ...current, hour: value }
      ),
    []
  );
  const changeMinute = useCallback(
    (value: number) =>
      setSelection((current) =>
        current.minute === value ? current : { ...current, minute: value }
      ),
    []
  );
  return (
    <Demo
      title="Time picker"
      description="Drag, scroll, or use the arrow keys to choose a time."
    >
      <div className={styles.picker}>
        <div className={styles.wheels}>
          <PickerWheel
            args={args}
            controller={hour}
            values={hours}
            initial={12}
            selected={selection.hour}
            onValueChange={changeHour}
            label="Hours"
            unit="hours"
            hint={hint}
            testId="carousel"
          />
          <PickerWheel
            args={args}
            controller={minute}
            values={minutes}
            initial={0}
            selected={selection.minute}
            onValueChange={changeMinute}
            label="Minutes"
            unit="min"
            hint={hint}
            testId="picker-minutes"
          />
        </div>
        <output
          className={styles.srOnly}
          aria-label="Selected time"
          aria-live="off"
          data-testid="selected-time"
        >
          {format(selection.hour)}:{format(selection.minute)}
        </output>
        <p className={styles.srOnly} id={hint}>
          Use arrow keys to adjust a focused wheel.
        </p>
      </div>
    </Demo>
  );
}
