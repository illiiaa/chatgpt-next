import { shallow } from 'zustand/shallow';

import type { DFolder } from '~/common/state/store-folders';
import { conversationTitle, DConversationId, useChatStore } from '~/common/state/store-chats';

import type { ChatNavigationItemData } from './ChatDrawerItem';


// configuration
const AUTO_UNDERLINE_COUNT = 40;
const SEARCH_MIN_CHARS = 3;


export interface ChatNavigationGroupData {
  type: 'nav-item-group',
  title: string,
}

type ChatRenderItemData = ChatNavigationItemData | ChatNavigationGroupData;


// Returns a string with the pane indices where the conversation is also open, or false if it's not
function findOpenInViewNumbers(chatPanesConversationIds: DConversationId[], ourId: DConversationId): string | false {
  if (chatPanesConversationIds.length <= 1) return false;
  return chatPanesConversationIds.reduce((acc: string[], id, idx) => {
    if (id === ourId)
      acc.push((idx + 1).toString());
    return acc;
  }, []).join(', ') || false;
}

function getNextMidnightTime(): number {
  const midnight = new Date();
  // midnight.setDate(midnight.getDate() - 1);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

function getTimeBucketEn(currentTime: number, midnightTime: number): string {
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = oneDay * 7;
  const oneMonth = oneDay * 30; // approximation

  const diff = midnightTime - currentTime;

  if (diff < oneDay) {
    return 'Today';
  } else if (diff < oneDay * 2) {
    return 'Yesterday';
  } else if (diff < oneWeek) {
    return 'This Week';
  } else if (diff < oneWeek * 2) {
    return 'Last Week';
  } else if (diff < oneMonth) {
    return 'This Month';
  } else if (diff < oneMonth * 2) {
    return 'Last Month';
  } else {
    return 'Older';
  }
}


/*
 * Optimization: return a reduced version of the DConversation object for 'Drawer Items' purposes,
 * to avoid unnecessary re-renders on each new character typed by the assistant
 */
export function useChatNavRenderItems(
  activeConversationId: DConversationId | null,
  chatPanesConversationIds: DConversationId[],
  filterByQuery: string,
  activeFolder: DFolder | null,
  allFolders: DFolder[],
  grouping: 'none' | 'date' | 'persona',
): {
  renderNavItems: ChatRenderItemData[],
  filteredChatIDs: DConversationId[],
  filteredChatsCount: number,
  filteredChatsAreEmpty: boolean,
  filterefChatsBarBasis: number,
} {
  return useChatStore(({ conversations }) => {

      // filter 1: select all conversations or just the ones in the active folder
      const selectedConversations = !activeFolder ? conversations : conversations.filter(_c => activeFolder.conversationIds.includes(_c.id));

      // filter 2: preparation: lowercase the query
      const lcTextQuery = filterByQuery.trim().toLowerCase();
      const isSearching = lcTextQuery.length >= SEARCH_MIN_CHARS;

      // transform (the conversations into ChatNavigationItemData) + filter2 (if searching)
      const chatNavItems = selectedConversations.map((_c): ChatNavigationItemData => {
        // rich properties
        const title = conversationTitle(_c);
        const isAlsoOpen = findOpenInViewNumbers(chatPanesConversationIds, _c.id);

        // set the frequency counters if filtering is enabled
        let searchFrequency: number = 0;
        if (isSearching) {
          const titleFrequency = title.toLowerCase().split(lcTextQuery).length - 1;
          const messageFrequency = _c.messages.reduce((count, message) => count + (message.text.toLowerCase().split(lcTextQuery).length - 1), 0);
          searchFrequency = titleFrequency + messageFrequency;
        }

        // create the ChatNavigationData
        return {
          type: 'nav-item-chat-data',
          conversationId: _c.id,
          isActive: _c.id === activeConversationId,
          isAlsoOpen,
          isEmpty: !_c.messages.length && !_c.userTitle,
          title,
          folder: !allFolders.length
            ? undefined                             // don't show folder select if folders are disabled
            : _c.id === activeConversationId        // only show the folder for active conversation(s)
              ? allFolders.find(folder => folder.conversationIds.includes(_c.id)) ?? null
              : null,
          updatedAt: _c.updated || _c.created || 0,
          messageCount: _c.messages.length,
          assistantTyping: !!_c.abortController,
          systemPurposeId: _c.systemPurposeId,
          searchFrequency,
        };
      }).filter(item => !isSearching || item.searchFrequency > 0);


      // [sort by frequency, don't group] if there's a search query
      chatNavItems.sort((a, b) => b.searchFrequency - a.searchFrequency);

      // Render List
      let renderNavItems: ChatRenderItemData[] = chatNavItems;

      // [grouping] group by date or persona
      if (!isSearching && grouping !== 'none') {

        // [grouping/date]: sort by update time
        const midnightTime = getNextMidnightTime();
        if (grouping === 'date')
          chatNavItems.sort((a, b) => b.updatedAt - a.updatedAt);

        // Array.groupBy(...)
        const grouped = chatNavItems.reduce((acc, item) => {

          const groupName = grouping === 'date'
            ? getTimeBucketEn(item.updatedAt || midnightTime, midnightTime)
            : item.systemPurposeId;

          if (!acc[groupName])
            acc[groupName] = [];
          acc[groupName].push(item);
          return acc;
        }, {} as { [groupName: string]: ChatNavigationItemData[] });

        // prepend groups
        renderNavItems = Object.entries(grouped).flatMap(([groupName, items]) => [
          { type: 'nav-item-group', title: groupName },
          ...items,
        ]);
      }

      // other derived state
      const filteredChatIDs = chatNavItems.map(_c => _c.conversationId);
      const filteredChatsCount = chatNavItems.length;
      const filteredChatsAreEmpty = !filteredChatsCount || (filteredChatsCount === 1 && chatNavItems[0].isEmpty);
      const filterefChatsBarBasis = (filteredChatsCount >= AUTO_UNDERLINE_COUNT || isSearching)
        ? chatNavItems.reduce((longest, _c) => Math.max(longest, isSearching ? _c.searchFrequency : _c.messageCount), 1)
        : 0;

      return {
        renderNavItems,
        filteredChatIDs,
        filteredChatsCount,
        filteredChatsAreEmpty,
        filterefChatsBarBasis,
      };
    },
    (a, b) => {
      // we only compare the renderNavItems array, which shall be changed if the rest changes
      return a.renderNavItems.length === b.renderNavItems.length
        && a.renderNavItems.every((_a, i) => shallow(_a, b.renderNavItems[i]))
        && shallow(a.filteredChatIDs, b.filteredChatIDs);
    },
  );
}