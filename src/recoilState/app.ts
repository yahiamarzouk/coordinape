// at 5k elements for filter-map-slice itiriri is more performant

import debug from 'debug';
import iti from 'itiriri';
import { DateTime } from 'luxon';
import {
  atom,
  selector,
  selectorFamily,
  useRecoilValue,
  RecoilValueReadOnly,
} from 'recoil';

import { extraProfile } from 'utils/modelExtenders';
import { neverEndingPromise } from 'utils/recoil';

import { rManifest, rFullCircle } from './db';
import { queryProfile } from './queries';

import { IUser, IMyUser, IEpoch, ICircle } from 'types';

const log = debug('recoil');

export const rSelectedCircleIdSource = atom<number | undefined>({
  key: 'rSelectedCircleIdSource',
  default: undefined,
});

// Suspend unless it has a value.
// This is set by fetchCircle in hooks/legacyApi
export const rSelectedCircleId = selector({
  key: 'rSelectedCircleId',
  get: async ({ get }) => {
    const id = get(rSelectedCircleIdSource);
    if (id === undefined) {
      log('rSelectedCircleId: neverEndingPromise...');
      return neverEndingPromise<number>();
    }
    return id;
  },
});

const rProfile = selectorFamily({
  key: 'rProfile',
  get: (address: string) => async () => {
    const profile = await queryProfile(address);
    return extraProfile(profile);
  },
});

const rCircle = selectorFamily<ICircleState, number | undefined>({
  key: 'rCircle',
  get:
    circleId =>
    ({ get }) => {
      if (!circleId) return neverEndingPromise();
      const circle = get(rManifest).circles.find(c => c.id === circleId);

      const myProfile = get(rManifest).myProfile;

      const myUser = myProfile.myUsers.find(u => u.circle_id === circleId);

      if (!myUser) {
        // eslint-disable-next-line no-console
        console.info('myUser is null for circleId:' + circleId);
      }
      const circleEpochsStatus = get(rCircleEpochsStatus(circleId));

      if (!circle) {
        throw new Error(`unable to load circle '${circleId}'`);
      }

      const me = myUser ? { ...myUser, profile: myProfile } : undefined;

      const users = Array.from(get(rFullCircle).usersMap.values())
        .filter(u => u.circle_id === circleId)
        .filter(u => !u.deleted_at);

      return {
        circleId,
        circle,
        myUser: me,
        users,
        circleEpochsStatus,
      };
    },
});

export const rSelectedCircle = selector({
  key: 'rSelectedCircle',
  get: ({ get }) => get(rCircle(get(rSelectedCircleId))),
});

const rCircleEpochs = selectorFamily<IEpoch[], number>({
  key: 'rCircleEpochs',
  get:
    (circleId: number) =>
    ({ get }) => {
      let lastNumber = 1;
      const epochsWithNumber = [] as IEpoch[];

      iti(get(rFullCircle).epochsMap.values())
        .filter(e => e.circle_id === circleId)
        .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date))
        .forEach(epoch => {
          lastNumber = epoch.number ?? lastNumber + 1;
          epochsWithNumber.push({ ...epoch, number: lastNumber });
        });

      return epochsWithNumber;
    },
});

export const rCircleEpochsStatus = selectorFamily({
  key: 'rCircleEpochsStatus',
  get:
    (circleId: number) =>
    ({ get }) => {
      const epochs = get(rCircleEpochs(circleId));
      const pastEpochs = epochs.filter(
        epoch => +new Date(epoch.end_date) - +new Date() <= 0
      );
      const futureEpochs = epochs.filter(
        epoch => +new Date(epoch.start_date) - +new Date() >= 0
      );
      const previousEpoch =
        pastEpochs.length > 0 ? pastEpochs[pastEpochs.length - 1] : undefined;
      const nextEpoch = futureEpochs.length > 0 ? futureEpochs[0] : undefined;
      const previousEpochEndedOn =
        previousEpoch &&
        previousEpoch.endDate
          .minus({ seconds: 1 })
          .toLocal()
          .toLocaleString(DateTime.DATE_MED);

      const currentEpoch = epochs.find(
        epoch =>
          +new Date(epoch.start_date) - +new Date() <= 0 &&
          +new Date(epoch.end_date) - +new Date() >= 0
      );

      const closest = currentEpoch ?? nextEpoch;
      const currentEpochNumber = currentEpoch?.number
        ? String(currentEpoch.number)
        : previousEpoch?.number
        ? String(previousEpoch.number + 1)
        : '1';
      let timingMessage = 'Epoch not Scheduled';
      let longTimingMessage = 'Next Epoch not Scheduled';

      if (closest && !closest.started) {
        timingMessage = `Epoch Begins in ${closest.labelUntilStart}`;
        longTimingMessage = `Epoch ${currentEpochNumber} Begins in ${closest.labelUntilStart}`;
      }
      if (closest && closest.started) {
        timingMessage = `Epoch ends in ${closest.labelUntilEnd}`;
        longTimingMessage = `Epoch ${currentEpochNumber} Ends in ${closest.labelUntilEnd}`;
      }

      return {
        epochs,
        pastEpochs,
        previousEpoch,
        currentEpoch,
        nextEpoch,
        futureEpochs,
        previousEpochEndedOn,
        epochIsActive: !!currentEpoch,
        timingMessage,
        longTimingMessage,
      };
    },
});

type ExtractRecoilType<P> = P extends (a: any) => RecoilValueReadOnly<infer T>
  ? T
  : never;

interface ICircleState {
  circleId: number;
  circle: ICircle;
  myUser: IMyUser | undefined;
  users: IUser[];
  circleEpochsStatus: ExtractRecoilType<typeof rCircleEpochsStatus>;
}

// DEPRECATED
export const useMyProfile = () => useRecoilValue(rManifest).myProfile;

// DEPRECATED
export const useSelectedCircle = () => {
  const circleId = useRecoilValue(rSelectedCircleId);
  return useRecoilValue(rCircle(circleId));
};

// DEPRECATED
export const useProfile = (address: string) =>
  useRecoilValue(rProfile(address));
