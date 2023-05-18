import * as React from 'react';

import { Box, Chip, IconButton, ListItem, ListItemButton, ListItemContent, Tooltip, Typography, useTheme } from '@mui/joy';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { DLLM, ModelVendor } from '../llm.types';
import { useUIStore } from '~/common/state/store-ui';


export function LLMListItem(props: { llm: DLLM, vendor: ModelVendor, chipChat?: boolean, chipFast?: boolean }) {

  // external state
  const theme = useTheme();
  const openLLMOptions = useUIStore(state => state.openLLMOptions);

  // derived
  const llm = props.llm;
  const label = llm.label;
  const tooltip = `${llm._source.label} - ${llm.description}`;

  return (
    <ListItem>
      <ListItemButton onClick={() => openLLMOptions(llm.id)}>

        {/* Model Name */}
        <ListItemContent sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={tooltip}>
            <Typography sx={{ display: 'inline', ...(llm.hidden && { color: theme.vars.palette.neutral.plainDisabledColor }) }}>
              {label}
            </Typography>
          </Tooltip>
        </ListItemContent>

        {!!props.chipChat && <Chip size='sm' variant='soft' sx={{ ml: 1 }}>chat</Chip>}

        {!!props.chipFast && <Chip size='sm' variant='soft' sx={{ ml: 1 }}>fast</Chip>}

        {/* 'Actions' (only click -> configure in reality) */}
        <Box sx={{ ml: 'auto', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          {llm.hidden && (
            <IconButton disabled variant='plain' color='neutral'>
              <VisibilityOffOutlinedIcon />
            </IconButton>
          )}
          <IconButton variant='plain' color='neutral'>
            <SettingsOutlinedIcon />
          </IconButton>
        </Box>

      </ListItemButton>
    </ListItem>
  );
}