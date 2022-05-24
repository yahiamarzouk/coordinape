import { createContext, useContext, useState } from 'react';

import { useQuery } from 'react-query';

import { client } from '../lib/gql/client';

interface ICurrentCircleContext {
  // availableTeammates: IUser[];
  baseTeammates?: number[];
  isLoading: boolean;
  circleId: number;
  setCurrentCircleId?: (circleId: number) => void;
  circleError?: unknown;
}

const defaultState: ICurrentCircleContext = {
  // availableTeammates: [],
  baseTeammates: [],
  isLoading: true,
  circleId: -1,
};

const CurrentCircleContext = createContext<ICurrentCircleContext>(defaultState);

export const CurrentCircleProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // const [localTeammates, setLocalTeammates] = useState<number[]>(defaultState.baseTeammates);
  const [circleId, setCurrentCircleId] = useState<number>(
    defaultState.circleId
  );

  const {
    data: baseTeammates,
    isLoading,
    error: circleError,
  } = useQuery(
    ['tm'],
    async () => {
      const { circles_by_pk } = await client.query({
        circles_by_pk: [
          {
            id: circleId,
          },
          {
            users: [
              {
                // TODO: How does this work lol
              },
              {
                teammates: [
                  {},
                  {
                    user_id: true,
                  },
                ],
              },
            ],
          },
        ],
      });
      const user = circles_by_pk?.users.pop();
      const ressy = user ? user.teammates.map(tm => tm.user_id) : [];
      return ressy;
    },
    {
      enabled: circleId > 0,
    }
  );

  return (
    <>
      <CurrentCircleContext.Provider
        value={{
          baseTeammates,
          isLoading,
          setCurrentCircleId,
          circleId,
          circleError,
        }}
      >
        {children}
      </CurrentCircleContext.Provider>
    </>
  );
};

export const useCurrentCircleContext = () =>
  useContext<ICurrentCircleContext>(CurrentCircleContext);
