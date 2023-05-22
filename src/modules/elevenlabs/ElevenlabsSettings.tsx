import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, CircularProgress, FormControl, FormHelperText, FormLabel, IconButton, Input, Option, Radio, RadioGroup, Select, Stack } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { Section } from '~/common/components/Section';
import { settingsCol1Width, settingsGap } from '~/common/theme';

import { isElevenLabsEnabled, requireUserKeyElevenLabs } from './elevenlabs.client';
import { useElevenlabsStore } from './store-elevenlabs';


export function ElevenlabsSettings() {
  // state
  const [showApiKeyValue, setShowApiKeyValue] = React.useState(false);

  // external state
  const { apiKey, setApiKey, voiceId, setVoiceId, autoSpeak, setAutoSpeak } = useElevenlabsStore(state => ({
    apiKey: state.elevenLabsApiKey, setApiKey: state.setElevenLabsApiKey,
    voiceId: state.elevenLabsVoiceId, setVoiceId: state.setElevenLabsVoiceId,
    autoSpeak: state.elevenLabsAutoSpeak, setAutoSpeak: state.setElevenLabsAutoSpeak,
  }), shallow);

  const requiresKey = requireUserKeyElevenLabs;
  const isValidKey = isElevenLabsEnabled(apiKey);

  const { data: voicesData, isLoading: loadingVoices } = apiQuery.elevenlabs.listVoices.useQuery({ elevenKey: apiKey }, {
    enabled: isValidKey,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleToggleApiKeyVisibility = () => setShowApiKeyValue(!showApiKeyValue);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value);

  const handleVoiceChange = (e: any, value: string | null) => setVoiceId(value || '');

  const handleAutoSpeakChange = (e: React.ChangeEvent<HTMLInputElement>) => setAutoSpeak((e.target.value || 'off') as 'off' | 'firstLine');

  return (
    <Section title='📢 Voice Generation' collapsible collapsed>
      <Stack direction='column' sx={{ gap: settingsGap, mt: -0.8 }}>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel sx={{ minWidth: settingsCol1Width }}>
              ElevenLabs API Key
            </FormLabel>
            <FormHelperText>
              {requiresKey ? '(required)' : '(optional)'}
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' type={showApiKeyValue ? 'text' : 'password'} placeholder={requiresKey ? 'required' : '...'} error={!isValidKey}
            value={apiKey} onChange={handleApiKeyChange}
            startDecorator={<KeyIcon />}
            endDecorator={!!apiKey && (
              <IconButton variant='plain' color='neutral' onClick={handleToggleApiKeyVisibility}>
                {showApiKeyValue ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </IconButton>
            )}
            slotProps={{ input: { sx: { width: '100%' } } }}
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <FormLabel sx={{ minWidth: settingsCol1Width }}>
            Assistant voice
          </FormLabel>
          <Select
            variant='outlined' placeholder={isValidKey ? 'Select a voice' : 'Enter API Key'}
            value={voiceId} onChange={handleVoiceChange}
            startDecorator={<RecordVoiceOverIcon />}
            endDecorator={isValidKey && loadingVoices && <CircularProgress size='sm' />}
            indicator={<KeyboardArrowDownIcon />}
            slotProps={{
              root: { sx: { width: '100%' } },
              indicator: { sx: { opacity: 0.5 } },
            }}
          >
            {voicesData && voicesData.voices?.map(voice => (
              <Option key={voice.id} value={voice.id}>
                {voice.name}
              </Option>
            ))}
          </Select>
        </FormControl>

        <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Speak responses</FormLabel>
            <FormHelperText>{autoSpeak === 'off' ? 'Off' : 'Just the first line'}</FormHelperText>
          </Box>
          <RadioGroup orientation='horizontal' value={autoSpeak} onChange={handleAutoSpeakChange}>
            <Radio value='off' label='Off' />
            <Radio value='firstLine' label='Beginning' />
          </RadioGroup>
        </FormControl>

      </Stack>
    </Section>
  );
}