import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, ButtonGroup, Card, Grid, IconButton, Stack, Textarea, Tooltip, Typography, useTheme } from '@mui/joy';
import { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import DataArrayIcon from '@mui/icons-material/DataArray';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import MicIcon from '@mui/icons-material/Mic';
import PanToolIcon from '@mui/icons-material/PanTool';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SendIcon from '@mui/icons-material/Send';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ContentReducer } from '~/modules/aifn/summarize/ContentReducer';
import { LLMOptionsOpenAI } from '~/modules/llms/vendors/openai/openai.vendor';
import { useChatLLM } from '~/modules/llms/store-llms';

import { SpeechResult, useSpeechRecognition } from '~/common/components/useSpeechRecognition';
import { countModelTokens } from '~/common/util/token-counter';
import { extractFilePathsWithCommonRadix } from '~/common/util/dropTextUtils';
import { hideOnDesktop, hideOnMobile } from '~/common/theme';
import { htmlTableToMarkdown } from '~/common/util/htmlTableToMarkdown';
import { pdfToText } from '~/common/util/pdfToText';
import { useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { CameraCaptureButton } from './CameraCaptureButton';
import { ChatModeId } from '../../AppChat';
import { ChatModeMenu } from './ChatModeMenu';
import { TokenBadge } from './TokenBadge';
import { TokenProgressbar } from './TokenProgressbar';
import { useComposerStore } from './store-composer';


/// Text template helpers

const PromptTemplates = {
  Concatenate: '{{input}}\n\n{{text}}',
  PasteFile: '{{input}}\n\n```{{fileName}}\n{{fileText}}\n```\n',
  PasteMarkdown: '{{input}}\n\n```\n{{clipboard}}\n```\n',
};

const expandPromptTemplate = (template: string, dict: object) => (inputValue: string): string => {
  let expanded = template.replaceAll('{{input}}', (inputValue || '').trim()).trim();
  for (const [key, value] of Object.entries(dict))
    expanded = expanded.replaceAll(`{{${key}}}`, value.trim());
  return expanded;
};


const attachFileLegend =
  <Stack sx={{ p: 1, gap: 1 }}>
    <Box sx={{ mb: 1, textAlign: 'center' }}>
      <b>Attach a file to the message</b>
    </Box>
    <table>
      <tbody>
      <tr>
        <td width={32}><PictureAsPdfIcon /></td>
        <td><b>PDF</b></td>
        <td width={36} align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📝 Text (summarized)</td>
      </tr>
      <tr>
        <td><DataArrayIcon /></td>
        <td><b>Code</b></td>
        <td align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📚 Markdown</td>
      </tr>
      <tr>
        <td><FormatAlignCenterIcon /></td>
        <td><b>Text</b></td>
        <td align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📝 As-is</td>
      </tr>
      </tbody>
    </table>
    <Box sx={{ mt: 1, fontSize: '14px' }}>
      Drag & drop in chat for faster loads ⚡
    </Box>
  </Stack>;

const pasteClipboardLegend =
  <Box sx={{ p: 1 }}>
    Converts Code and Tables to 📚 Markdown
  </Box>;


const MicButton = (props: { variant: VariantProp, color: ColorPaletteProp, onClick: () => void, sx?: SxProps }) =>
  <Tooltip title='CTRL + M' placement='top'>
    <IconButton variant={props.variant} color={props.color} onClick={props.onClick} sx={props.sx}>
      <MicIcon />
    </IconButton>
  </Tooltip>;


/**
 * A React component for composing and sending messages in a chat-like interface.
 *
 * Note: Useful bash trick to generate code from a list of files:
 *       $ for F in *.ts; do echo; echo "\`\`\`$F"; cat $F; echo; echo "\`\`\`"; done | clip
 *
 * @param {boolean} props.disableSend - Flag to disable the send button.
 * @param {(text: string, conversationId: string | null) => void} props.sendMessage - Function to send the message. conversationId is null for the Active conversation
 * @param {() => void} props.stopGeneration - Function to stop response generation
 */
export function Composer(props: {
  conversationId: string | null; messageId: string | null;
  chatModeId: ChatModeId, setChatModeId: (chatModeId: ChatModeId) => void;
  isDeveloperMode: boolean;
  onSendMessage: (conversationId: string, text: string) => void;
  sx?: SxProps;
}) {
  // state
  const [composeText, setComposeText] = React.useState('');
  const [speechInterimResult, setSpeechInterimResult] = React.useState<SpeechResult | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [reducerText, setReducerText] = React.useState('');
  const [reducerTextTokens, setReducerTextTokens] = React.useState(0);
  const [chatModeMenuAnchor, setChatModeMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const attachmentFileInputRef = React.useRef<HTMLInputElement>(null);

  // external state
  const theme = useTheme();
  const { enterToSend, experimentalLabs } = useUIPreferencesStore(state => ({
    enterToSend: state.enterToSend,
    experimentalLabs: state.experimentalLabs,
  }), shallow);
  const { startupText, setStartupText } = useComposerStore();
  const { assistantTyping, tokenCount: conversationTokenCount, stopTyping } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      assistantTyping: conversation ? !!conversation.abortController : false,
      tokenCount: conversation ? conversation.tokenCount : 0,
      stopTyping: state.stopTyping,
    };
  }, shallow);
  const { chatLLMId, chatLLM } = useChatLLM();

  // Effect: load initial text if queued up (e.g. by /launch)
  React.useEffect(() => {
    if (startupText) {
      setStartupText(null);
      setComposeText(startupText);
    }
  }, [startupText, setStartupText]);

  // derived state
  const tokenLimit = chatLLM?.contextTokens || 0;
  const directTokens = React.useMemo(() => {
    return (!composeText || !chatLLMId) ? 4 : 4 + countModelTokens(composeText, chatLLMId, 'composer text');
  }, [chatLLMId, composeText]);
  const historyTokens = conversationTokenCount;
  const responseTokens = (chatLLM?.options as LLMOptionsOpenAI /* FIXME: BIG ASSUMPTION */)?.llmResponseTokens || 0;
  const remainingTokens = tokenLimit - directTokens - historyTokens - responseTokens;


  const handleSendClicked = () => {
    const text = (composeText || '').trim();
    if (text.length && props.conversationId) {
      setComposeText('');
      props.onSendMessage(props.conversationId, text);
    }
  };

  const handleToggleChatMode = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setChatModeMenuAnchor(anchor => anchor ? null : event.currentTarget);

  const handleHideChatMode = () => setChatModeMenuAnchor(null);

  const handleSetChatModeId = (chatModeId: ChatModeId) => {
    handleHideChatMode();
    props.setChatModeId(chatModeId);
  };

  const handleStopClicked = () => props.conversationId && stopTyping(props.conversationId);

  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const shiftOrAlt = e.shiftKey || e.altKey;
      if (enterToSend ? !shiftOrAlt : shiftOrAlt) {
        if (!assistantTyping)
          handleSendClicked();
        e.preventDefault();
      }
    }
  };


  const onSpeechResultCallback = React.useCallback((result: SpeechResult) => {
    setSpeechInterimResult(result.done ? null : { ...result });
    if (result.done) {
      setComposeText(prevText => {
        prevText = prevText.trim();
        const transcript = result.transcript.trim();
        return prevText ? prevText + ' ' + transcript : transcript;
      });
    }
  }, []);

  const { isSpeechEnabled, isSpeechError, isRecordingAudio, isRecordingSpeech, toggleRecording } = useSpeechRecognition(onSpeechResultCallback, 2000, 'm');

  const handleMicClicked = () => toggleRecording();

  const micColor: ColorPaletteProp = isSpeechError ? 'danger' : isRecordingSpeech ? 'primary' : isRecordingAudio ? 'neutral' : 'neutral';
  const micVariant: VariantProp = isRecordingSpeech ? 'solid' : isRecordingAudio ? 'outlined' : 'plain';

  async function loadAndAttachFiles(files: FileList, overrideFileNames: string[]) {

    // NOTE: we tried to get the common 'root prefix' of the files here, so that we could attach files with a name that's relative
    //       to the common root, but the files[].webkitRelativePath property is not providing that information

    // perform loading and expansion
    let newText = '';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = overrideFileNames.length === files.length ? overrideFileNames[i] : file.name;
      let fileText = '';
      try {
        if (file.type === 'application/pdf')
          fileText = await pdfToText(file);
        else
          fileText = await file.text();
        newText = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: fileName, fileText })(newText);
      } catch (error) {
        // show errors in the prompt box itself - FUTURE: show in a toast
        console.error(error);
        newText = `${newText}\n\nError loading file ${fileName}: ${error}\n`;
      }
    }

    // see how we fare on budget
    if (chatLLMId) {
      const newTextTokens = countModelTokens(newText, chatLLMId, 'reducer trigger');

      // simple trigger for the reduction dialog
      if (newTextTokens > remainingTokens) {
        setReducerTextTokens(newTextTokens);
        setReducerText(newText);
        return;
      }
    }

    // within the budget, so just append
    setComposeText(text => expandPromptTemplate(PromptTemplates.Concatenate, { text: newText })(text));
  }

  const handleContentReducerClose = () => {
    setReducerText('');
  };

  const handleContentReducerText = (newText: string) => {
    handleContentReducerClose();
    setComposeText(text => text + newText);
  };

  const handleShowFilePicker = () => attachmentFileInputRef.current?.click();

  const handleLoadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (files && files.length >= 1)
      await loadAndAttachFiles(files, []);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };

  const handleCameraOCR = (text: string) => text && setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: text }));

  const handlePasteButtonClicked = async () => {
    for (const clipboardItem of await navigator.clipboard.read()) {

      // when pasting html, only process tables as markdown (e.g. from Excel), or fallback to text
      try {
        const htmlItem = await clipboardItem.getType('text/html');
        const htmlString = await htmlItem.text();
        // paste tables as markdown
        if (htmlString.indexOf('<table') == 0) {
          const markdownString = htmlTableToMarkdown(htmlString);
          setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: markdownString }));
          continue;
        }
        // TODO: paste html to markdown (tried Turndown, but the gfm plugin is not good - need to find another lib with minimal footprint)
      } catch (error) {
        // ignore missing html: fallback to text/plain
      }

      // find the text/plain item if any
      try {
        const textItem = await clipboardItem.getType('text/plain');
        const textString = await textItem.text();
        setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: textString }));
        continue;
      } catch (error) {
        // ignore missing text
      }

      // no text/html or text/plain item found
      console.log('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  };

  const handleTextareaCtrlV = async (e: React.ClipboardEvent) => {

    // paste local files
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      await loadAndAttachFiles(e.clipboardData.files, []);
      return;
    }

    // paste not intercepted, continue with default behavior
  };


  const eatDragEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTextareaDragEnter = (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(true);
  };

  const handleOverlayDragLeave = (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);
  };

  const handleOverlayDragOver = (e: React.DragEvent) => {
    eatDragEvent(e);
    // e.dataTransfer.dropEffect = 'copy';
  };

  const handleOverlayDrop = async (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);

    // dropped files
    if (e.dataTransfer.files?.length >= 1) {
      // Workaround: as we don't have the full path in the File object, we need to get it from the text/plain data
      let overrideFileNames: string[] = [];
      if (e.dataTransfer.types?.includes('text/plain')) {
        const plainText = e.dataTransfer.getData('text/plain');
        overrideFileNames = extractFilePathsWithCommonRadix(plainText);
      }
      return loadAndAttachFiles(e.dataTransfer.files, overrideFileNames);
    }

    // special case: detect failure of dropping from VSCode
    // VSCode: Drag & Drop does not transfer the File object: https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    if (e.dataTransfer.types?.includes('codeeditors'))
      return setComposeText(test => test + 'Pasting from VSCode is not supported! Fixme. Anyone?');

    // dropped text
    const droppedText = e.dataTransfer.getData('text');
    if (droppedText?.length >= 1)
      return setComposeText(text => expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: droppedText })(text));

    // future info for dropping
    console.log('Unhandled Drop event. Contents: ', e.dataTransfer.types.map(t => `${t}: ${e.dataTransfer.getData(t)}`));
  };

  // const prodiaApiKey = isValidProdiaApiKey(useSettingsStore(state => state.prodiaApiKey));
  // const isProdiaConfigured = !requireUserKeyProdia || prodiaApiKey;
  const textPlaceholder: string = props.isDeveloperMode
    ? 'Chat with me · drop source files · attach code...'
    : /*isProdiaConfigured ?*/ 'Chat · /react · /imagine · drop text files...' /*: 'Chat · /react · drop text files...'*/;

  // const isImmediate = props.chatModeId === 'immediate';
  const isWriteUser = props.chatModeId === 'write-user';
  const isFollowUp = props.chatModeId === 'immediate-follow-up';
  const isReAct = props.chatModeId === 'react';
  const isDraw = props.chatModeId === 'draw-imagine';

  const chatButton = (
    <Button
      fullWidth variant={isWriteUser ? 'soft' : 'solid'} color={isReAct ? 'success' : (isFollowUp || isDraw) ? 'warning' : 'primary'} disabled={!props.conversationId || !chatLLM}
      onClick={handleSendClicked}
      endDecorator={isWriteUser ? <SendIcon sx={{ fontSize: 18 }} /> : isReAct ? <PsychologyIcon /> : <TelegramIcon />}
    >
      {isWriteUser ? 'Write' : isFollowUp ? 'Chat+' : isReAct ? 'ReAct' : isDraw ? 'Draw' : 'Chat'}
    </Button>
  );

  return (
    <Box sx={props.sx}>
      <Grid container spacing={{ xs: 1, md: 2 }}>

        {/* Left pane (buttons and Textarea) */}
        <Grid xs={12} md={9}><Stack direction='row' spacing={{ xs: 1, md: 2 }}>

          {/* Vertical Buttons Bar */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0, md: 2 } }}>

            {/*<Typography level='body-xs' sx={{mb: 2}}>Context</Typography>*/}

            {isSpeechEnabled && <Box sx={hideOnDesktop}>
              <MicButton variant={micVariant} color={micColor} onClick={handleMicClicked} />
            </Box>}

            <CameraCaptureButton onOCR={handleCameraOCR} />

            <IconButton onClick={handleShowFilePicker} sx={{ ...hideOnDesktop }}>
              <AttachFileOutlinedIcon />
            </IconButton>
            <Tooltip
              variant='solid' placement='top-start'
              title={attachFileLegend}>
              <Button fullWidth variant='plain' color='neutral' onClick={handleShowFilePicker} startDecorator={<AttachFileOutlinedIcon />}
                      sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}>
                Attach
              </Button>
            </Tooltip>

            <IconButton onClick={handlePasteButtonClicked} sx={{ ...hideOnDesktop }}>
              <ContentPasteGoIcon />
            </IconButton>
            <Tooltip
              variant='solid' placement='top-start'
              title={pasteClipboardLegend}>
              <Button fullWidth variant='plain' color='neutral' startDecorator={<ContentPasteGoIcon />} onClick={handlePasteButtonClicked}
                      sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}>
                {props.isDeveloperMode ? 'Paste code' : 'Paste'}
              </Button>
            </Tooltip>

            <input type='file' multiple hidden ref={attachmentFileInputRef} onChange={handleLoadAttachment} />

          </Box>

          {/* Edit box, with Drop overlay */}
          <Box sx={{ flexGrow: 1, position: 'relative' }}>

            <Box sx={{ position: 'relative' }}>

              <Textarea
                variant='outlined' color={isReAct ? 'success' : 'neutral'}
                autoFocus
                minRows={5} maxRows={10}
                placeholder={textPlaceholder}
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                onDragEnter={handleTextareaDragEnter}
                onKeyDown={handleTextareaKeyDown}
                onPasteCapture={handleTextareaCtrlV}
                slotProps={{
                  textarea: {
                    enterKeyHint: enterToSend ? 'send' : 'enter',
                    sx: {
                      ...(isSpeechEnabled ? { pr: { md: 5 } } : {}),
                      mb: 0.5,
                    },
                  },
                }}
                sx={{
                  backgroundColor: 'background.level1',
                  '&:focus-within': {
                    backgroundColor: 'background.popup',
                  },
                  // fontSize: '16px',
                  lineHeight: 1.75,
                }} />

              {tokenLimit > 0 && (directTokens > 0 || (historyTokens + responseTokens) > 0) && <TokenProgressbar history={historyTokens} response={responseTokens} direct={directTokens} limit={tokenLimit} />}

            </Box>

            {isSpeechEnabled && (
              <MicButton variant={micVariant} color={micColor} onClick={handleMicClicked} sx={{
                ...hideOnMobile,
                position: 'absolute', top: 0, right: 0,
                zIndex: 21,
                m: 1,
              }} />
            )}

            {!!tokenLimit && (
              <TokenBadge
                directTokens={directTokens} indirectTokens={historyTokens + responseTokens} tokenLimit={tokenLimit}
                showExcess absoluteBottomRight
              />
            )}

            {!!speechInterimResult && (
              <Card
                color='primary' invertedColors variant='soft'
                sx={{
                  display: 'flex',
                  position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                  // alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${theme.palette.primary.solidBg}`,
                  borderRadius: theme.radius.xs,
                  zIndex: 20,
                  px: 1.5, py: 1,
                }}>
                <Typography>
                  {speechInterimResult.transcript}{' '}
                  <span style={{ opacity: 0.5 }}>{speechInterimResult.interimTranscript}</span>
                </Typography>
              </Card>
            )}

            <Card
              color='primary' invertedColors variant='soft'
              sx={{
                display: isDragging ? 'flex' : 'none',
                position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                alignItems: 'center', justifyContent: 'space-evenly',
                border: '2px dashed',
                borderRadius: theme.radius.xs,
                zIndex: 10,
              }}
              onDragLeave={handleOverlayDragLeave}
              onDragOver={handleOverlayDragOver}
              onDrop={handleOverlayDrop}>
              <PanToolIcon sx={{ width: 40, height: 40, pointerEvents: 'none' }} />
              <Typography level='body-sm' sx={{ pointerEvents: 'none' }}>
                I will hold on to this for you
              </Typography>
            </Card>

          </Box>

        </Stack></Grid>

        {/* Send pane */}
        <Grid xs={12} md={3}>
          <Stack spacing={2}>

            <Box sx={{ display: 'flex', flexDirection: 'row' }}>

              {/* [mobile-only] corner button - placeholder */}
              {/*<IconButton disabled={} onClick={}*/}
              {/*            sx={{ ...hideOnDesktop, mr: { xs: 1, md: 2 } }}>*/}
              {/* Some icon here */}
              {/*</IconButton>*/}

              {/* Send / Stop */}
              {assistantTyping
                ? (
                  <Button
                    fullWidth variant='soft' color={isReAct ? 'success' : 'primary'} disabled={!props.conversationId}
                    onClick={handleStopClicked}
                    endDecorator={<StopOutlinedIcon />}
                  >
                    Stop
                  </Button>
                ) : (
                  <ButtonGroup variant={isWriteUser ? 'solid' : 'solid'} color={isReAct ? 'success' : (isFollowUp || isDraw) ? 'warning' : 'primary'} sx={{ flexGrow: 1 }}>
                    {chatButton}
                    <IconButton disabled={!props.conversationId || !chatLLM || !!chatModeMenuAnchor} onClick={handleToggleChatMode}>
                      <ExpandLessIcon />
                    </IconButton>
                  </ButtonGroup>
                )}
            </Box>

            {/* [desktop-only] second row */}
            {/*<Stack direction='row' spacing={1}*/}
            {/*       sx={{ ...hideOnMobile, flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'flex-end' }}>*/}
            {/*    <Button disabled={} fullWidth variant='plain' color='neutral'*/}
            {/*            startDecorator={<KeyboardArrowUpIcon />} onClick={}>*/}
            {/*      Placeholder button*/}
            {/*    </Button>*/}
            {/*</Stack>*/}

          </Stack>
        </Grid>


        {/* Mode selector */}
        {!!chatModeMenuAnchor && (
          <ChatModeMenu
            anchorEl={chatModeMenuAnchor} onClose={handleHideChatMode}
            experimental={experimentalLabs}
            chatModeId={props.chatModeId} onSetChatModeId={handleSetChatModeId}
          />
        )}

        {/* Content reducer modal */}
        {reducerText?.length >= 1 &&
          <ContentReducer
            initialText={reducerText} initialTokens={reducerTextTokens} tokenLimit={remainingTokens}
            onReducedText={handleContentReducerText} onClose={handleContentReducerClose}
          />
        }

      </Grid>
    </Box>
  );
}