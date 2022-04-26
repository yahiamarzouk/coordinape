import ArrowBackIcon from '@material-ui/icons/ArrowBack';

import { Box, Link, Panel } from 'ui';

export default function ClaimsPage() {
  return (
    <Box
      css={{
        margin: '$lg auto',
        maxWidth: '$mediumScreen',
      }}
    >
      <Panel css={{ minHeight: '60vh' }}>
        <Box
          css={{
            display: 'flex',
            flexWrap: 'nowrap',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href={'/'}
            css={{
              fontSize: '$4',
              lineHeight: '$shorter',
              alignSelf: 'center',
              color: '$text',
              display: 'flex',
              alignItems: 'center',
              ml: '$lg',
              cursor: 'pointer',
            }}
          >
            <ArrowBackIcon />
            Back
          </Link>
        </Box>
        <Box
          css={{
            fontSize: '$6',
            color: '$text',
            display: 'flex',
            alignItems: 'left',
            ml: '$lg',
            mt: '$lg',
          }}
        >
          Claim Your Funds
        </Box>
        <Box
          css={{
            fontSize: '$4',
            color: '$text',
            display: 'flex',
            alignItems: 'left',
            ml: '$lg',
            mt: '$lg',
          }}
        >
          <Box>
            You can claim all your rewards from this page. Note that you can
            claim them for all your epochs in one circle but each token requires
            its own claim transaction.
          </Box>
          <Box css={{ minWidth: '40%' }}></Box>
        </Box>
      </Panel>
    </Box>
  );
}
