import { client } from 'lib/gql/client';

export const getTeammates = async (
  selectedCircleId: number,
  address: string
) => {
  const data = await client.query(
    {
      users: [
        {
          where: {
            circle_id: { _eq: selectedCircleId },
            address: { _nilike: address },
          },
        },
        {
          id: true,
          name: true,
          address: true,
          non_receiver: true,
          profile: {
            avatar: true,
          },
        },
      ],
      teammates: [
        {
          where: {
            user: {
              circle_id: { _eq: selectedCircleId },
              address: { _ilike: address },
            },
          },
        },
        {
          teammate: {
            id: true,
            name: true,
            address: true,
            non_receiver: true,
            profile: {
              avatar: true,
            },
          },
        },
      ],
    },
    {
      operationName: 'teammates',
    }
  );

  // The intent of this and the filter
  // is to force teammate typing to be non-nullable
  type Teammate = NonNullable<typeof data.teammates[number]['teammate']>;

  return {
    startingTeammates: data?.teammates
      ?.map(x => x.teammate)
      .filter((x: Teammate | undefined): x is Teammate => !!x),
    allUsers: data?.users,
  };
};

export const getCurrentTeammates = async (
  selectedCircleId: number,
  address: string,
  teamSelection: boolean
) => {
  if (teamSelection) {
    return await getSelectedCurrentTeammates(selectedCircleId, address);
  } else {
    return await getAllAvailableUsers(selectedCircleId, address);
  }
};

const getAllAvailableUsers = async (
  selectedCircleId: number,
  address: string
) => {
  const data = await client.query(
    {
      users: [
        {
          where: {
            circle_id: { _eq: selectedCircleId },
            address: { _neq: address },
          },
        },
        {
          id: true,
          name: true,
          address: true,
          non_receiver: true,
          profile: {
            avatar: true,
          },
        },
      ],
    },
    {
      operationName: 'teammates',
    }
  );
  return data?.users;
};

const getSelectedCurrentTeammates = async (
  selectedCircleId: number,
  address: string
) => {
  const data = await client.query(
    {
      teammates: [
        {
          where: {
            user: {
              circle_id: { _eq: selectedCircleId },
              address: { _eq: address },
            },
          },
        },
        {
          teammate: {
            id: true,
            name: true,
            address: true,
            non_receiver: true,
            profile: {
              avatar: true,
            },
          },
        },
      ],
    },
    {
      operationName: 'teammates',
    }
  );

  // The intent of this and the filter
  // is to force teammate typing to be non-nullable
  type Teammate = NonNullable<typeof data.teammates[number]['teammate']>;

  return data?.teammates
    ?.map(x => x.teammate)
    .filter((x: Teammate | undefined): x is Teammate => !!x);
};
