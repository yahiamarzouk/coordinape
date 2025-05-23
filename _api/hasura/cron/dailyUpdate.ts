import assert from 'assert';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import dedent from 'dedent';
import { DateTime, DurationObjectUnits, Settings } from 'luxon';

import { CIRCLES } from '../../../api-lib/constants';
import {
  pending_token_gifts_select_column,
  useZeusVariables,
} from '../../../api-lib/gql/__generated__/zeus';
import { adminClient } from '../../../api-lib/gql/adminClient';
import { errorLog } from '../../../api-lib/HttpError';
import { sendSocialMessage } from '../../../api-lib/sendSocialMessage';
import { verifyHasuraRequestMiddleware } from '../../../api-lib/validate';

Settings.defaultZone = 'utc';

async function handler(req: VercelRequest, res: VercelResponse) {
  const yesterday = DateTime.now().minus({ days: 1 }).toISO();
  try {
    const variables = useZeusVariables({
      pendingTokenGiftsDistinctOn: '[pending_token_gifts_select_column!]',
    })({
      pendingTokenGiftsDistinctOn: [
        pending_token_gifts_select_column.sender_address,
      ],
    });

    const updateResult = await adminClient.query(
      {
        epochs: [
          {
            where: {
              end_date: { _gt: 'now()' },
              start_date: { _lt: 'now()' },
              ended: { _eq: false },
            },
          },
          {
            number: true,
            start_date: true,
            end_date: true,

            circle: {
              organization: {
                id: true,
                name: true,
                telegram_id: true,
              },
              id: true,
              name: true,
              token_name: true,
              discord_webhook: true,
              telegram_id: true,
              discord_circle: {
                discord_channel_id: true,
                discord_role_id: true,
                alerts: [{}, true],
              },
              __alias: {
                optOuts: {
                  users_aggregate: [
                    {
                      where: {
                        non_receiver: { _eq: true },
                        deleted_at: { _is_null: true },
                      },
                    },
                    {
                      aggregate: { count: [{}, true] },
                    },
                  ],
                },
                receiversTotal: {
                  users_aggregate: [
                    {
                      where: {
                        non_receiver: { _eq: false },
                        role: { _lt: 2 },
                        deleted_at: { _is_null: true },
                      },
                    },
                    { aggregate: { count: [{}, true] } },
                  ],
                },
                emptyBioUsers: {
                  users: [
                    {
                      where: {
                        bio: { _is_null: true },
                        non_receiver: { _eq: false },
                        // for YEARN COMMUNITY circle only
                        circle_id: { _eq: CIRCLES.YEARN.COMMUNITY },
                        deleted_at: { _is_null: true },
                      },
                    },
                    {
                      profile: {
                        name: true,
                      },
                    },
                  ],
                },
              },
            },

            __alias: {
              allocationTotals: {
                epoch_pending_token_gifts_aggregate: [
                  {},
                  {
                    aggregate: {
                      sum: { __alias: { sumGive: { tokens: true } } },
                      __alias: { totalAllocations: { count: [{}, true] } },
                    },
                  },
                ],
              },
              sendersCount: {
                epoch_pending_token_gifts_aggregate: [
                  {
                    distinct_on: variables.$('pendingTokenGiftsDistinctOn'),
                  },
                  { aggregate: { count: [{}, true] } },
                ],
              },
              sendersToday: {
                epoch_pending_token_gifts_aggregate: [
                  {
                    where: { updated_at: { _gte: yesterday } },
                    distinct_on: variables.$('pendingTokenGiftsDistinctOn'),
                  },
                  {
                    nodes: {
                      sender: {
                        profile: {
                          name: true,
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      {
        operationName: 'cron_dailyUpdate',
        variables,
      }
    );

    for (const epoch of updateResult.epochs) {
      const {
        start_date,
        end_date,
        sendersCount,
        sendersToday: dailySenders,
        allocationTotals,
        circle,
      } = epoch;
      assert(circle, 'epoch somehow missing circle');
      const epochStartDate = DateTime.fromISO(start_date);
      const epochEndDate = DateTime.fromISO(end_date);
      const epochTimeRemaining = epochEndDate
        .diffNow()
        .shiftTo('weeks', 'days', 'hours')
        .toObject();

      const sendersToday = dailySenders.nodes.map(
        node => node.sender.profile.name
      );
      const totalAllocations = allocationTotals.aggregate?.totalAllocations;
      const tokensSent = allocationTotals.aggregate?.sum?.sumGive;
      const optOuts = circle?.optOuts.aggregate?.count;
      const usersAllocated = sendersCount.aggregate?.count;
      const optedInUsers = circle.receiversTotal.aggregate?.count;

      const emptyBioNotif =
        circle.id === CIRCLES.YEARN.COMMUNITY
          ? dedent`
              Opted in contributors who have NOT entered a statement for Epoch:
              ${circle.emptyBioUsers.map(u => u.profile.name).join(', ')}
          `
          : ``;

      const message = dedent`
        ${circle.organization?.name} / ${circle.name} Epoch #${epoch.number}

        ${epochStartDate.toLocaleString(
          DateTime.DATETIME_FULL
        )} to ${epochEndDate.toLocaleString(DateTime.DATETIME_FULL)}
        Total Allocations: ${totalAllocations ?? 0}
        ${circle.token_name || 'GIVE'} sent: ${tokensSent ?? 0}
        Opt outs: ${optOuts ?? 0}
        Users Allocated: ${usersAllocated ?? 0} / ${optedInUsers ?? 0}
        epoch ending ${timeStringFromDuration(epochTimeRemaining)} from now!
        Users that made new allocations today:
          ${sendersToday.join(', ')}
        ${emptyBioNotif}
      `;

      if (circle.telegram_id) {
        try {
          await sendSocialMessage({
            message,
            circleId: circle.id,
            channels: { telegram: true },
            sanitize: false,
          });
        } catch (e: unknown) {
          if (e instanceof Error)
            errorLog(
              `Telegram Daily Update error for circle #${circle.id}: ` +
                e.message
            );
        }
      }

      if (circle.organization?.telegram_id) {
        try {
          await sendSocialMessage({
            message,
            circleId: circle.id,
            channels: { telegram: true },
            sanitize: false,
            notifyOrg: true,
          });
        } catch (e: unknown) {
          if (e instanceof Error)
            errorLog(
              `Telegram Daily Update error for organisation #${circle.organization?.id}: ` +
                e.message
            );
        }
      }

      // if (circle.discord_webhook) {
      //   try {
      //     await sendSocialMessage({
      //       message,
      //       circleId: circle.id,
      //       channels: { discord: true },
      //       sanitize: false,
      //     });
      //   } catch (e: unknown) {
      //     if (e instanceof Error)
      //       errorLog(
      //         `Discord Daily Update error for circle #${circle.id}: ` +
      //           e.message
      //       );
      //   }
      // }

      // if (circle.discord_circle) {
      //   const {
      //     discord_channel_id: channelId,
      //     discord_role_id: roleId,
      //     alerts,
      //   } = circle.discord_circle || {};

      //   if (channelId && roleId && alerts?.['daily-update']) {
      //     try {
      //       await sendSocialMessage({
      //         message,
      //         circleId: circle.id,
      //         channels: {
      //           isDiscordBot: true,
      //           discordBot: {
      //             type: 'daily-update' as const,
      //             message,
      //             channelId,
      //             roleId,
      //           },
      //         },
      //         sanitize: false,
      //       });
      //     } catch (e: unknown) {
      //       if (e instanceof Error)
      //         errorLog(
      //           `Discord Daily Update error for circle #${circle.id}: ` +
      //             e.message
      //         );
      //     }
      //   }
      // }
    }

    res.status(200).json({ message: 'updates sent' });
  } catch (e) {
    res.status(401).json({
      error: '401',
      message: (e as Error).message || 'Unexpected error',
    });
  }
}

function timeExists(t: number | undefined, unit: string) {
  return t ? Math.floor(t) + unit : '';
}

function timeStringFromDuration({ weeks, days, hours }: DurationObjectUnits) {
  const weeksString = timeExists(weeks, 'w');
  const daysString = timeExists(days, 'd');
  const hoursString = timeExists(hours, 'h');
  // filter out empty strings to avoid double-spaces during the join
  return [weeksString, daysString, hoursString].filter(str => str).join(' ');
}

export default verifyHasuraRequestMiddleware(handler);
