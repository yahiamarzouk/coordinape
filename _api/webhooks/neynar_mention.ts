import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getGiveBotProfileId } from '../../api-lib/colinks/helperAccounts.ts';
import { IS_LOCAL_ENV } from '../../api-lib/config';
import { fetchProfileInfo } from '../../api-lib/frames/give/fetchProfileInfo.tsx';
import { FRAME_ROUTER_URL_BASE } from '../../api-lib/frames/routingUrls.ts';
import { insertInteractionEvents } from '../../api-lib/gql/mutations.ts';
import { errorResponse } from '../../api-lib/HttpError';
import { insertCoLinksGive } from '../../api-lib/insertCoLinksGive.ts';
import { publishCast } from '../../api-lib/neynar';
import { findOrCreateProfileByFid } from '../../api-lib/neynar/findOrCreate.ts';
import { isValidSignature } from '../../api-lib/neynarSignature';
import { fetchPoints } from '../hasura/actions/_handlers/createCoLinksGive';

const BOT_FID = 389267;
const DO_NOT_REPLY_FIDS = [BOT_FID];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // if localhost don't validate signature
    if (!IS_LOCAL_ENV) {
      if (!(await isValidSignature(req))) {
        res.status(401).send('Webhook signature not valid');
        return;
      }
    }

    const {
      data: {
        hash,
        parent_author: { fid: parent_fid },
        parent_hash,
        mentioned_profiles,
        text,
        timestamp: cast_created_at,
        author: { fid: author_fid, username: author_username },
      },
    } = req.body;

    const delay = Date.now() - new Date(cast_created_at).getTime();
    // eslint-disable-next-line no-console
    console.log(
      `Webhook delay from cast creation: ${delay} ms for cast hash: ${hash}`
    );

    const giver_profile = await findOrCreateProfileByFid(author_fid);

    // Don't reply to the bot itself
    if (DO_NOT_REPLY_FIDS.find(f => f == parent_fid)) {
      res.status(200).send({ success: true });
      return;
    }

    // Return Help Frame if `@givebot help` is message
    if (text.trim().toLowerCase() === '@givebot help') {
      await publishCast(``, {
        replyTo: hash,
        embeds: [{ url: getFrameUrl('help') }],
      });
      res.status(200).send({ success: true });
      return;
    }

    const mentioned_fid = mentioned_profiles.find(
      (f: { fid: number }) => f.fid !== BOT_FID
    )?.fid;

    let receiver_profile;
    if (parent_hash && parent_fid) {
      // Cast is a reply
      receiver_profile = await findOrCreateProfileByFid(parent_fid);
    } else if (mentioned_fid) {
      // Cast is not a reply - look for a mention
      receiver_profile = await findOrCreateProfileByFid(mentioned_fid);
    } else {
      // eslint-disable-next-line no-console
      console.log('No parent hash or mentioned fid');
      await publishCast(
        `@${author_username} Please reply to a cast, or mention a user to direct your GIVE.`,
        {
          replyTo: hash,
        }
      );
      res.status(200).send({ success: true });
      return;
    }

    if (receiver_profile.id === giver_profile.id) {
      await publishCast(
        `@${author_username} GIVE can only be given to others!`,
        {
          replyTo: hash,
        }
      );
      res.status(200).send({ success: true });
      return;
    }

    // can't give to Givebot
    if (receiver_profile.id === (await getGiveBotProfileId())) {
      await publishCast(
        `@${author_username} Thanks, but I'm just a bot! Give to people by replying to a cast with @givebot or cast @givebot @user #skilltag (tag optional)`,
        {
          replyTo: hash,
        }
      );
      res.status(200).send({ success: true });
      return;
    }

    // giver has enough give points
    const { canGive } = await fetchPoints(giver_profile.id);
    if (!canGive) {
      const { hasCoSoul, linksHeld } = await fetchProfileInfo(giver_profile.id);
      // out of give, no cosoul
      if (!hasCoSoul) {
        await publishCast(
          `@${author_username} You’re out of GIVE! Level up and get more by acquiring your CoSoul. Click into the GIVE frame, request your CoSoul, and we’ll drop you 10 more GIVE to share!`,
          {
            replyTo: hash,
            embeds: [{ url: getFrameUrl('front_door') }],
          }
        );
      } else if (linksHeld === 0) {
        // out of give, no colinks
        await publishCast(
          `@${author_username} You’re out of GIVE! Level up and get more by joining CoLinks! Click into the GIVE frame and then go to CoLinks and activate your first link to join. You’ll level up and we’ll drop you 10 more GIVE to share.`,
          {
            replyTo: hash,
            embeds: [{ url: getFrameUrl('front_door') }],
          }
        );
      } else {
        await publishCast(
          `@${author_username} Unfortunately, you are out of give. More REP will equal more GIVE. Get more in CoLinks.`,
          {
            replyTo: hash,
            embeds: [{ url: getFrameUrl('front_door') }],
          }
        );
      }

      res.status(200).send({ success: true });
      return;
    }

    const skill = parseSkill(text);

    const { newPoints } = await insertCoLinksGive(
      giver_profile,
      receiver_profile,
      hash,
      skill
    );

    await insertInteractionEvents({
      event_type: 'givebot_give',
      profile_id: giver_profile.id,
      data: {
        hostname: 'farcaster_bot',
        cast_hash: hash,
        new_points_balance: newPoints,
        target_profile_id: receiver_profile.id,
        target_profile_name: receiver_profile.name,
      },
    });

    return res.status(200).send({ success: true });
  } catch (error: any) {
    console.error('Failed to process neynar_mention webhook', error);
    return errorResponse(res, error);
  }
}

const parseSkill = (text: string) => {
  const skillMatch = text.match(/#(\w+)/);
  return skillMatch ? skillMatch[1] : undefined;
};

export const getFrameUrl = (frameId: string, resourceId?: number) => {
  let url = `${FRAME_ROUTER_URL_BASE}/meta/${frameId}`;

  if (resourceId) {
    url += `/${resourceId}`;
  }
  return url;
};

export const getFrameImgUrl = (frameId: string, resourceId?: number) => {
  let url = `${FRAME_ROUTER_URL_BASE}/img/${frameId}`;

  if (resourceId) {
    url += `/${resourceId}`;
  }
  return url;
};
