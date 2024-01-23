import * as React from 'react';
import Router from 'next/router';
import { Button, ButtonGroup, ListItem, Tooltip } from '@mui/joy';

import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';

import { BringTheLove } from './components/BringTheLove';


export function MobileNavListItem(props: { currentApp?: NavItemApp }) {

  return (
    <ListItem
      variant='solid'
      sx={{
        '--ListItem-minHeight': 'var(--AGI-Nav-width)',
        gap: 1,
      }}
    >

      {/* Group 1: Apps */}
      <ButtonGroup
        variant='solid'
        sx={{
          '--ButtonGroup-separatorSize': 0,
          '--ButtonGroup-connected': 0,
          gap: 1,
        }}
      >
        {navItems.apps
          .filter(app => checkVisibileIcon(app, true, undefined))
          .map((app, appIdx) => {
            const isActive = app === props.currentApp;

            if (checkDivider(app))
              return null;
            // return <Divider orientation='vertical' key={'div-' + appIdx} />;

            return (
              <Tooltip key={'n-m-' + app.route.slice(1)} disableInteractive enterDelay={600} title={app.name}>
                <Button
                  key={'app-' + app.name}
                  size='sm'
                  variant={isActive ? 'soft' : 'solid'}
                  onClick={() => Router.push(app.landingRoute || app.route)}
                >
                  {isActive ? app.name : <app.icon />}
                </Button>
              </Tooltip>
            );
          })}
      </ButtonGroup>

      {/* Group 2: Social Links */}
      <ButtonGroup
        variant='solid'
        sx={{
          '--ButtonGroup-separatorSize': 0,
          '--ButtonGroup-connected': 0,
          ml: 'auto',
        }}
      >
        {navItems.links.map(item =>
          <BringTheLove key={'love-' + item.name} text={item.name} icon={item.icon} link={item.href} />,
        )}
      </ButtonGroup>

    </ListItem>
  );
}