import { createContext, useContext, useEffect, useState } from 'react';

import isEqual from 'lodash/isEqual';

import { IUser } from '../types';

import { useCurrentCircleContext } from './CurrentCircleContext';

interface IAllocationContext {
  localTeammates: IUser[];
  setLocalTeammates?: (newTeammates: IUser[]) => void;
  localTeammatesChanged: boolean;
}

const defaultState: IAllocationContext = {
  localTeammates: [],
  localTeammatesChanged: false,
};

const AllocationContext = createContext<IAllocationContext>(defaultState);

export const AllocationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [localTeammates, setLocalTeammates] = useState<IUser[]>(
    defaultState.localTeammates
  );

  const [localTeammatesChanged, setLocalTeammatesChanged] =
    useState<boolean>(false);
  const { baseTeammates } = useCurrentCircleContext();

  useEffect(() => {
    setLocalTeammatesChanged(
      !isEqual(
        localTeammates.map(tm => tm.id),
        baseTeammates
      )
    );
  }, [baseTeammates, localTeammates]);

  return (
    <>
      <AllocationContext.Provider
        value={{
          localTeammates,
          setLocalTeammates,
          localTeammatesChanged,
        }}
      >
        {children}
      </AllocationContext.Provider>
    </>
  );
};

export const useAllocationContext = () =>
  useContext<IAllocationContext>(AllocationContext);
