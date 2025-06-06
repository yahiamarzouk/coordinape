import { useState, useMemo, useEffect } from 'react';

import { Role } from 'lib/users';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { Drawer } from 'components';
import { Filter, Collapse } from 'icons/__generated';
import { useDevMode } from 'recoilState';
import { useRoleInCircle } from 'routes/hooks';
import { IconButton, Text, Panel, Select, Flex } from 'ui';

import AMProfileCard from './AMProfileCard';
import {
  rMapEpochId,
  rMapSearch,
  rMapResults,
  rMapMetric,
  rMapEpochs,
  rMapMeasures,
} from './state';

import { MetricEnum } from 'types';

interface MetricOption {
  label: string;
  value: MetricEnum;
}

export const AMDrawer = ({
  circleId,
  showPending,
  epochId,
  setEpochId,
}: {
  circleId: number;
  showPending: boolean;
  epochId?: number;
  setEpochId: (epochId: number) => void;
}) => {
  const role = useRoleInCircle(circleId);

  const [open, setOpen] = useState<boolean>(true);
  const [showRank, setShowRank] = useState<boolean>(false);
  const setSearch = useSetRecoilState(rMapSearch);
  const metric = useRecoilValue(rMapMetric);
  const rawProfiles = useRecoilValue(rMapResults);
  const { measures } = useRecoilValue(rMapMeasures(metric));
  const showHiddenFeatures = useDevMode();
  const [metric2, setMetric2] = useRecoilState(rMapMetric);
  const [amEpochId, setAmEpochId] = useRecoilState(rMapEpochId);

  const allEpochs = useRecoilValue(rMapEpochs);
  const amEpochs =
    role !== Role.ADMIN && !showPending && !allEpochs[allEpochs.length]?.ended
      ? allEpochs.slice(0, allEpochs.length - 1)
      : allEpochs;

  useEffect(() => {
    if (amEpochs.length === 0) {
      setAmEpochId(-1);
      return;
    }
    if (epochId) {
      setAmEpochId(epochId);
    } else {
      setAmEpochId(amEpochs[amEpochs.length - 1]?.id);
    }
  }, [amEpochs.length, epochId]);

  const epochOptions = useMemo(() => {
    return amEpochs.length > 0
      ? [{ label: 'ALL', value: -1 }].concat(
          amEpochs.map(e => ({ label: e.labelGraph, value: e.id }))
        )
      : [{ label: 'No epochs yet', value: -1 }];
  }, [amEpochs]);

  const profiles = useMemo(
    () =>
      [...rawProfiles].sort((pa, pb) =>
        showRank
          ? (measures.get(pb.address) ?? 0) - (measures.get(pa.address) ?? 0)
          : (pa.users[0].profile?.name ?? '') <
              (pb.users[0].profile?.name ?? '')
            ? -1
            : 1
      ),
    [rawProfiles, measures, showRank]
  );

  const metricOptions = [
    {
      label: `Number of GIVE received`,
      value: 'give',
    },
    {
      label: 'In Degree (# incoming links)',
      value: 'in_degree',
    },
    {
      label: 'Out Degree (# outgoing links)',
      value: 'out_degree',
    },
    {
      label: `Degree Standardization (GIVE * #outDeg / #maxOutDeg)`,
      value: 'standardized',
    },
  ] as MetricOption[];

  const handleSetOpen = (value: boolean) => {
    if (!value) setSearch('');
    setOpen(value);
  };

  const onRankToggle = () => {
    setShowRank(!showRank);
  };

  return (
    <>
      <Drawer open={open} setOpen={handleSetOpen}>
        <Panel css={{ width: '100%', mb: '$md', zIndex: 2 }}>
          <Flex css={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Flex>
              <Text
                semibold
                css={{ color: '$headingText', pb: '$sm', pr: '$sm' }}
              >
                Filters
              </Text>
              {showHiddenFeatures && (
                <IconButton
                  onClick={onRankToggle}
                  css={{ height: 'auto', color: showRank ? '$cta' : '' }}
                >
                  <Filter size="lg" />
                </IconButton>
              )}
            </Flex>
            <IconButton onClick={() => setOpen(!open)} css={{ height: 'auto' }}>
              <Collapse size="lg" />
            </IconButton>
          </Flex>
          <Panel css={{ px: 0, gap: '$md', zIndex: 1 }}>
            <Select
              value={String(amEpochId)}
              options={epochOptions}
              onValueChange={value => setEpochId(Number(value))}
            />
            {showHiddenFeatures && (
              <Select
                defaultValue={metric2}
                options={metricOptions}
                onValueChange={value => setMetric2(value as MetricEnum)}
              />
            )}
          </Panel>
        </Panel>
        <Flex
          column
          css={{
            height: '100%',
            overflow: 'scroll',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {profiles.map(profile => (
            <AMProfileCard
              key={profile.id}
              profile={profile}
              summarize={showRank}
              circleId={circleId}
            />
          ))}
        </Flex>
      </Drawer>
    </>
  );
};

export default AMDrawer;
