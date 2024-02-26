import type { DLLMId } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { ChatActions, createDMessage, DConversationId, DMessage, useChatStore } from '../state/store-chats';

import { EphemeralController, EphemeralsStore } from './ConversationEphemerals';


export class ConversationHandler {
  private readonly chatActions: ChatActions;
  private readonly conversationId: DConversationId;
  readonly ephemeralsStore: EphemeralsStore = new EphemeralsStore();


  constructor(conversationId: DConversationId) {
    this.chatActions = useChatStore.getState();
    this.conversationId = conversationId;
  }


  // Conversation Management

  resyncPurposeInHistory(history: DMessage[], assistantLlmId: DLLMId, purposeId: SystemPurposeId): DMessage[] {
    const systemMessageIndex = history.findIndex(m => m.role === 'system');
    const systemMessage: DMessage = systemMessageIndex >= 0 ? history.splice(systemMessageIndex, 1)[0] : createDMessage('system', '');
    if (!systemMessage.updated && purposeId && SystemPurposes[purposeId]?.systemMessage) {
      systemMessage.purposeId = purposeId;
      systemMessage.text = bareBonesPromptMixer(SystemPurposes[purposeId].systemMessage, assistantLlmId);

      // HACK: this is a special case for the 'Custom' persona, to set the message in stone (so it doesn't get updated when switching to another persona)
      if (purposeId === 'Custom')
        systemMessage.updated = Date.now();
    }
    history.unshift(systemMessage);
    this.chatActions.setMessages(this.conversationId, history);
    return history;
  }

  setAbortController(abortController: AbortController | null): void {
    this.chatActions.setAbortController(this.conversationId, abortController);
  }


  // Message Management

  messageAppendAssistant(text: string, llmLabel: DLLMId | string /* 'DALL·E' | 'Prodia' | 'react-...' | 'web'*/, purposeId?: SystemPurposeId): string {
    const assistantMessage: DMessage = createDMessage('assistant', text);
    assistantMessage.typing = true;
    assistantMessage.purposeId = purposeId;
    assistantMessage.originLLM = llmLabel;
    this.chatActions.appendMessage(this.conversationId, assistantMessage);
    return assistantMessage.id;
  }

  messageEdit(messageId: string, update: Partial<DMessage>, touch: boolean): void {
    this.chatActions.editMessage(this.conversationId, messageId, update, touch);
  }


  // Ephemerality Management

  createEphemeral(title: string, initialText: string): EphemeralController {
    return new EphemeralController(title, initialText, this.ephemeralsStore);
  }

}