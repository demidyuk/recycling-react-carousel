import '@testing-library/jest-dom';
import './setupPointerEvent';
import snapshotDiff, { toMatchDiffSnapshot } from 'snapshot-diff';

expect.extend({ toMatchDiffSnapshot });
expect.addSnapshotSerializer(snapshotDiff.getSnapshotDiffSerializer());
