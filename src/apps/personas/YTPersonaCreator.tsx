import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, IconButton, Input, Radio, RadioGroup, Typography } from '@mui/joy';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { apiQuery } from '~/modules/trpc/trpc.client';
import { useModelsStore } from '~/modules/llms/store-llms';

import { LLMChainStep, useLLMChain } from './useLLMChain';


function extractVideoID(videoURL: string): string | null {
  let regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^#&?]*).*/;
  let match = videoURL.match(regExp);
  return (match && match[1]?.length == 11) ? match[1] : null;
}


function useTranscriptFromVideo(videoID: string | null) {
  const { data, isFetching, isError, error } =
    apiQuery.ytpersona.getTranscript.useQuery({ videoId: videoID || '' }, {
      enabled: !!videoID,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    });
  return {
    transcript: data?.transcript?.trim() ?? null,
    isFetching,
    isError, error,
  };
}


const YouTubePersonaSteps: LLMChainStep[] = [
  {
    name: 'Analyze the Transcript',
    setSystem: 'You are skilled in analyzing and embodying diverse characters. You meticulously study transcripts to capture key attributes, draft comprehensive character sheets, and refine them for authenticity. Feel free to make assumptions without hedging, be concise and be creative.',
    addUserInput: true,
    addUser: 'Conduct comprehensive research on the provided transcript. Identify key characteristics of the speaker, including age, professional field, distinct personality traits, style of communication, narrative context, and self-awareness. Additionally, consider any unique aspects such as their use of humor, their cultural background, core values, passions, fears, personal history, and social interactions. Your output for this stage is an in-depth written analysis that exhibits an understanding of both the superficial and more profound aspects of the speaker\'s persona.',
  },
  {
    name: 'Draft Character Sheet',
    addPrevAssistant: true,
    addUser: 'Craft your documented analysis into a draft of the \'You are a...\' character sheet. It should encapsulate all crucial personality dimensions, along with the motivations and aspirations of the persona. Keep in mind to balance succinctness and depth of detail for each dimension. The deliverable here is a comprehensive draft of the character sheet that captures the speaker\'s unique essence.',
  },
  {
    name: 'Validate and Refine',
    addPrevAssistant: true,
    addUser: 'Compare the draft character sheet with the original transcript, validating its content and ensuring it captures both the speaker’s overt characteristics and the subtler undertones. Omit unknown information, fine-tune any areas that require clarity, have been overlooked, or require more authenticity. Use clear and illustrative examples from the transcript to refine your sheet and offer meaningful, tangible reference points. Your output is a coherent, comprehensive, and nuanced instruction that begins with \'You are a...\' and  serves as a go-to guide for an actor recreating the persona.',
  },
  // {
  //   name: 'Shrink',
  //   addPrevAssistant: true,
  //   addUser: 'Now remove all the uncertain information, omit unknown information, Your output is a coherent, comprehensive, and nuanced instruction that begins with \'You are a...\' and serves as a go-to guide for a recreating the persona.',
  // },
];


export function YTPersonaCreator() {
  // state
  const [videoURL, setVideoURL] = React.useState('');
  const [selectedModelType, setSelectedModelType] = React.useState<'chat' | 'fast'>('fast');
  const [selectedLLMLabel, setSelectedLLMLabel] = React.useState<string | null>(null);
  const [videoID, setVideoID] = React.useState('');
  const [personaTransacript, setPersonaTransacript] = React.useState<string | null>(null);

  // external state
  const { chatLLM, fastLLM } = useModelsStore(state => {
    const { chatLLMId, fastLLMId } = state;
    const chatLLM = state.llms.find(llm => llm.id === chatLLMId) ?? null;
    const fastLLM = state.llms.find(llm => llm.id === fastLLMId) ?? null;
    return {
      chatLLM: chatLLM,
      fastLLM: /*chatLLM === fastLLM ? null :*/ fastLLM,
    };
  }, shallow);

  // fetch transcript when the Video ID is ready, then store it
  const { transcript, isFetching, isError, error: transcriptError } = useTranscriptFromVideo(videoID);
  React.useEffect(() => setPersonaTransacript(transcript), [transcript]);

  // use the transformation sequence to create a persona
  const llm = selectedModelType === 'chat' ? chatLLM : fastLLM;
  const { isFinished, isTransforming, chainProgress, chainIntermediates, chainStepName, chainOutput, chainError } =
    useLLMChain(YouTubePersonaSteps, llm?.id, personaTransacript ?? undefined);
  React.useEffect(() => setPersonaTransacript(transcript), [chainOutput, transcript]);

  const handleVideoIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setVideoURL(e.target.value);

  const handleFetchTranscript = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // stop the form submit
    const videoId = extractVideoID(videoURL);
    if (!videoId) {
      setVideoURL('Invalid');
    } else {
      setPersonaTransacript(null);
      setVideoID(videoId);
    }
  };

  return <>

    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      <YouTubeIcon sx={{ color: '#f00' }} />
      <Typography level='title-lg'>
        YouTube -&gt; AI persona
      </Typography>
    </Box>

    <form onSubmit={handleFetchTranscript}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
        <Input
          required
          type='url'
          fullWidth
          variant='outlined'
          placeholder='YouTube Video URL'
          value={videoURL} onChange={handleVideoIdChange}
          endDecorator={
            <IconButton
              variant='outlined' color='neutral'
              onClick={() => setVideoURL('https://www.youtube.com/watch?v=M_wZpSEvOkc&t=2s')}
            >
              <WhatshotIcon />
            </IconButton>
          }
        />
        <Button
          type='submit'
          variant='solid' disabled={isFetching || isTransforming} loading={isFetching}
          sx={{ minWidth: 120 }}>
          Create
        </Button>
      </Box>
    </form>

    {/* LLM selector (chat vs fast) */}
    {!isTransforming && !isFinished && !!chatLLM && !!fastLLM && (
      <RadioGroup
        orientation='horizontal'
        value={selectedModelType}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSelectedModelType(event.target.value as 'chat' | 'fast')}
      >
        <Radio value='chat' label={chatLLM.label.startsWith('GPT-4') ? chatLLM.label + ' (slow, accurate)' : chatLLM.label} />
        <Radio value='fast' label={fastLLM.label} />
      </RadioGroup>
    )}

    {/* After the first roundtrip */}
    {isError && (
      <Alert color='warning' sx={{ mt: 1 }}>
        <Typography component='div'>{transcriptError?.message || 'Unknown error'}</Typography>
      </Alert>
    )}
    {!!chainError && (
      <Alert color='warning' sx={{ mt: 1 }}>
        <Typography component='div'>{chainError}</Typography>
      </Alert>
    )}

    {/* Transform Progress */}
    {isTransforming && <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
      <CircularProgress color='primary' value={Math.max(10, 100 * chainProgress)} />
      <Typography color='primary' level='title-lg' sx={{ mt: 1 }}>
        Embodying your persona...
      </Typography>
      <Typography level='title-sm' sx={{ mb: 1 }}>
        This may require 1-2 minutes
      </Typography>
    </Box>}

    {/* Transcript*/}
    {personaTransacript && (
      <Card>
        <CardContent>
          <Typography level='title-md' sx={{ mb: 1 }}>
            YouTube Video Text
          </Typography>
          <Typography level='body-sm'>
            {personaTransacript.slice(0, 280)}...
          </Typography>
        </CardContent>
      </Card>
    )}

    {/* Intermediate outputs rendered as cards in a grid */}
    {chainIntermediates && chainIntermediates.length > 0 && <Box sx={{ mt: 2 }}>
      <Typography level='title-lg'>
        Working...
      </Typography>
      <Grid container spacing={2}>
        {chainIntermediates.map((intermediate, i) =>
          <Grid xs={12} sm={6} md={4} key={i}>
            <Card>
              <CardContent>
                <Typography level='title-sm' sx={{ mb: 1 }}>
                  {i + 1}. {YouTubePersonaSteps[i].name}
                </Typography>
                <Typography level='body-sm'>
                  {intermediate?.slice(0, 140)}...
                </Typography>
              </CardContent>
            </Card>
          </Grid>,
        )}
      </Grid>
    </Box>}

    {/* Character Sheet */}
    {chainOutput && <Box sx={{ mt: 2 }}>
      <Typography level='title-lg'>
        YouTuber Persona System Prompt
      </Typography>
      <Card>
        <CardContent>
          <Typography level='body-sm'>
            {chainOutput}
          </Typography>
        </CardContent>
      </Card>
    </Box>}

  </>;
}