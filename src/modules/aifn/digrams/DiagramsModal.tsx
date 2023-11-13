import * as React from 'react';

import { Box, Button, ButtonGroup, CircularProgress, Divider, Grid, IconButton } from '@mui/joy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplayIcon from '@mui/icons-material/Replay';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessage } from '../../../apps/chat/components/message/ChatMessage';
import { streamChat } from '~/modules/llms/transports/streamChat';

import { GoodModal } from '~/common/components/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';
import { useFormRadio } from '~/common/components/forms/useFormRadio';
import { useFormRadioLlmType } from '~/common/components/forms/useFormRadioLlmType';

import { bigDiagramPrompt, DiagramLanguage, diagramLanguages, DiagramType, diagramTypes } from './diagrams.data';


// Used by the callers to setup the diagam session
export interface DiagramConfig {
  conversationId: string;
  messageId: string,
  text: string;
}


// This method fixes issues in the generation output. Very heuristic.
function hotFixMessage(message: DMessage) {
  if (message.text.includes('@endmindmap\n@enduml'))
    message.text = message.text.replace('@endmindmap\n@enduml', '@endmindmap');
}


export function DiagramsModal(props: { config: DiagramConfig, onClose: () => void; }) {

  // state
  const [showOptions, setShowOptions] = React.useState(true);
  const [message, setMessage] = React.useState<DMessage | null>(null);
  const [diagramType, diagramComponent] = useFormRadio<DiagramType>('auto', diagramTypes, 'Diagram Type');
  const [diagramLanguage, languageComponent] = useFormRadio<DiagramLanguage>('mermaid', diagramLanguages, 'Diagram Language');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  // external state
  const [diagramLlm, llmComponent] = useFormRadioLlmType('Generator');

  // derived state
  const { conversationId, text: subject } = props.config;


  /**
   * Core Diagram Generation function, with Streaming, custom prompt, etc.
   */
  const handleGenerateNew = React.useCallback(async () => {
    if (abortController)
      return;

    const conversation = useChatStore.getState().conversations.find(c => c.id === conversationId);
    if (!diagramType || !diagramLanguage || !diagramLlm || !conversation)
      return setErrorMessage('Invalid diagram Type, Language, Generator, or conversation.');

    const systemMessage = conversation?.messages?.length ? conversation.messages[0] : null;
    if (systemMessage?.role !== 'system')
      return setErrorMessage('No System message in this conversation');

    setErrorMessage(null);

    let assistantMessage = createDMessage('assistant', '');
    assistantMessage.purposeId = conversation.systemPurposeId;
    setMessage(assistantMessage);

    const stepAbortController = new AbortController();
    setAbortController(stepAbortController);

    const diagramPrompt = bigDiagramPrompt(diagramType, diagramLanguage, systemMessage.text, subject);

    try {
      await streamChat(diagramLlm.id, diagramPrompt, stepAbortController.signal,
        (update: Partial<{ text: string, typing: boolean, originLLM: string }>) => {
          if (update.originLLM)
            update.originLLM = '(diagram)'; // `(diagram) ${update.originLLM}`;
          assistantMessage = { ...assistantMessage, ...update };
          hotFixMessage(assistantMessage);
          setMessage(assistantMessage);
        },
      );
    } catch (error: any) {
      setMessage(null);
      setErrorMessage(error?.name !== 'AbortError' ? error?.message : 'Interrupted.');
    } finally {
      setAbortController(null);
    }

  }, [abortController, conversationId, diagramLanguage, diagramLlm, diagramType, subject]);


  // [Effect] Auto-abort on unmount
  React.useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
        setAbortController(null);
      }
    };
  }, [abortController]);


  const handleInsertAndClose = () => {
    if (!message || !message.text)
      return setErrorMessage('Nothing to add to the conversation.');
    useChatStore.getState().appendMessage(conversationId, { ...message });
    props.onClose();
  };


  return <GoodModal
    title='Generate Diagram'
    open onClose={props.onClose}
    sx={{ maxWidth: { xs: '100vw', md: '95vw' } }}
    startButton={
      <Button variant='solid' color='primary' disabled={!message || !!abortController} endDecorator={<TelegramIcon />} onClick={handleInsertAndClose}>
        Insert in Chat
      </Button>
    }
  >

    <Divider />

    {showOptions && (
      <Grid container spacing={2}>
        <Grid xs={12} md={6}>
          {diagramComponent}
        </Grid>
        <Grid xs={12} md={6}>
          {languageComponent}
        </Grid>
        <Grid xs={12} md={6}>
          {llmComponent}
        </Grid>
      </Grid>
    )}

    <ButtonGroup color='primary' sx={{ flexGrow: 1 }}>
      <Button
        fullWidth
        variant={abortController ? 'soft' : 'solid'} color='primary'
        disabled={!diagramLlm}
        onClick={abortController ? () => abortController.abort() : handleGenerateNew}
        endDecorator={abortController ? <StopOutlinedIcon /> : message ? <ReplayIcon /> : <AccountTreeIcon />}
        sx={{ minWidth: 200 }}
      >
        {abortController ? 'Stop' : message ? 'Regenerate' : 'Generate'}
      </Button>
      <IconButton onClick={() => setShowOptions(options => !options)}>
        {showOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </IconButton>
    </ButtonGroup>

    {errorMessage && <InlineError error={errorMessage} />}

    {!showOptions && !!abortController && <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size='lg' />
    </Box>}

    {!!message && (!abortController || showOptions) && (
      <ChatMessage
        message={message} hideAvatars noBottomBorder noMarkdown
        codeBackground='background.surface'
        sx={{
          backgroundColor: abortController ? 'background.level3' : 'background.level2',
          marginX: 'calc(-1 * var(--Card-padding))',
          minHeight: 96,
        }}
      />
    )}

    {!message && <Divider />}

  </GoodModal>;
}