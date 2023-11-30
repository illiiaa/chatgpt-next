import * as React from 'react';
import { shallow } from 'zustand/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import { addSnackbar } from '~/common/components/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';
import { extractFilePathsWithCommonRadix } from '~/common/util/dropTextUtils';
import { getClipboardItems } from '~/common/util/clipboardUtils';

import { AttachmentDTOrigin, AttachmentFileOrigin } from './attachment.types';
import { useAttachmentsStore } from './store-attachments';


export const useAttachments = (enableUrlAttachments: boolean) => {

  // state
  const { attachments, clearAttachments, createAttachment, removeAttachment } = useAttachmentsStore(state => ({
    attachments: state.attachments,
    clearAttachments: state.clearAttachments,
    createAttachment: state.createAttachment,
    removeAttachment: state.removeAttachment,
  }), shallow);


  // Convenience functions

  const attachAppendFile = React.useCallback((origin: AttachmentFileOrigin, fileWithHandle: FileWithHandle, overrideName?: string) =>
    createAttachment({
      type: 'file',
      origin,
      fileWithHandle,
      name: overrideName || fileWithHandle.name,
    }), [createAttachment]);

  const attachAppendDataTransfer = React.useCallback((dataTransfer: DataTransfer, method: AttachmentDTOrigin, attachText: boolean): 'as_files' | 'as_url' | 'as_text' | false => {

    // attach File(s)
    if (dataTransfer.files.length >= 1) {
      // rename files from a common prefix, to better relate them (if the transfer contains a list of paths)
      let overrideFileNames: string[] = [];
      if (dataTransfer.types.includes('text/plain')) {
        const plainText = dataTransfer.getData('text/plain');
        overrideFileNames = extractFilePathsWithCommonRadix(plainText);
      }

      // attach as Files
      const overrideNames = overrideFileNames.length === dataTransfer.files.length;
      for (let i = 0; i < dataTransfer.files.length; i++)
        attachAppendFile(method, dataTransfer.files[i], overrideNames ? overrideFileNames[i] || undefined : undefined);
      return 'as_files';
    }

    // attach as URL
    const textPlain = dataTransfer.getData('text/plain') || '';
    if (textPlain && enableUrlAttachments) {
      const textPlainUrl = asValidURL(textPlain);
      if (textPlainUrl && textPlainUrl.trim()) {
        createAttachment({
          type: 'url', url: textPlainUrl.trim(), refName: textPlain,
        });
        return 'as_url';
      }
    }

    // attach as Text/Html (further conversion, e.g. to markdown is done later)
    const textHtml = dataTransfer.getData('text/html') || '';
    if (attachText && (textHtml || textPlain)) {
      createAttachment({
        type: 'text', method, textHtml, textPlain,
      });
      return 'as_text';
    }

    if (attachText)
      console.log(`Unhandled ${method} event: `, dataTransfer.types?.map(t => `${t}: ${dataTransfer.getData(t)}`));

    // did not attach anything from this data transfer
    return false;
  }, [attachAppendFile, createAttachment, enableUrlAttachments]);

  const attachAppendClipboardItems = React.useCallback(async () => {

    // if there's an issue accessing the clipboard, show it passively
    const clipboardItems = await getClipboardItems();
    if (clipboardItems === null) {
      addSnackbar({
        key: 'clipboard-issue',
        type: 'issue',
        message: 'Clipboard empty or access denied',
        overrides: {
          autoHideDuration: 4000,
        },
      });
      return;
    }

    // loop on all the possible attachments
    for (const clipboardItem of clipboardItems) {

      // attach as image
      let imageAttached = false;
      for (const mimeType of clipboardItem.types) {
        if (mimeType.startsWith('image/')) {
          try {
            const imageBlob = await clipboardItem.getType(mimeType);
            const imageFile = new File([imageBlob], 'clipboard.png', { type: mimeType });
            attachAppendFile('clipboard-read', imageFile, imageFile.name?.replace('image.', 'clipboard.'));
            imageAttached = true;
          } catch (error) {
            // ignore getType error..
          }
        }
      }
      if (imageAttached)
        continue;

      // get the Plain text
      const textPlain = clipboardItem.types.includes('text/plain') ? await clipboardItem.getType('text/plain').then(blob => blob.text()) : '';

      // attach as URL
      if (textPlain && enableUrlAttachments) {
        const textPlainUrl = asValidURL(textPlain);
        if (textPlainUrl && textPlainUrl.trim()) {
          createAttachment({
            type: 'url', url: textPlainUrl.trim(), refName: textPlain,
          });
          continue;
        }
      }

      // attach as Text
      const textHtml = clipboardItem.types.includes('text/html') ? await clipboardItem.getType('text/html').then(blob => blob.text()) : '';
      if (textHtml || textPlain) {
        createAttachment({
          type: 'text', method: 'clipboard-read', textHtml, textPlain,
        });
        continue;
      }

      console.log('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, [attachAppendFile, createAttachment, enableUrlAttachments]);


  // when pasting html, onley process tables as markdown (e.g. from Excel), or fallback to text
  /*try {
    const htmlItem = await clipboardItem.getType('text/html');
    const htmlString = await htmlItem.text();
    // paste tables as markdown
    if (htmlString.startsWith('<table')) {
      console.log('Pasting html table as markdown', htmlString);
      // const markdownString = htmlTableToMarkdown(htmlString);
      // setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: markdownString }));
      continue;
    }
    // TODO: paste html to markdown (tried Turndown, but the gfm plugin is not good - need to find another lib with minimal footprint)
  } catch (error) {
    // ignore missing html: fallback to text/plain
  }
  */
  /*
        // find the text/plain item if any
        try {
          const textItem = await clipboardItem.getType('text/plain');
          const textString = await textItem.text();
          const textIsUrl = asValidURL(textString);
          if (browsingInComposer) {
            if (textIsUrl && await handleAttachWebpage(textIsUrl, textString))
              continue;
          }
          setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: textString }));
          continue;
        } catch (error) {
          // ignore missing text
        }
  */


  const attachFiles = React.useCallback(async (files: { fileWithHandle: FileWithHandle, overrideName?: string }[]): Promise<void> => {

    // NOTE: we tried to get the common 'root prefix' of the files here, so that we could attach files with a name that's relative
    //       to the common root, but the files[].webkitRelativePath property is not providing that information

    // perform loading and expansion
    let newText = '';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = overrideFileNames?.length === files.length ? overrideFileNames[i] : file.name;
      let fileText = '';
      try {
        if (file.type === 'application/pdf')
          fileText = await pdfToText(file);
        else
          fileText = await file.text();
        newText = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: fileName, fileText })(newText);
      } catch (error: any) {
        // show errors in the prompt box itself - FUTURE: show in a toast
        console.error(error);
        newText = `${newText}\n\nError loading file ${fileName}: ${JSON.stringify(error)}\n`;
      }
    }


  }, []);


  return {
    // attach methods
    attachAppendClipboardItems,
    attachAppendDataTransfer,
    attachAppendFile,

    // state
    attachments,
    attachmentsReady: !attachments.length || attachments.every(a => !!a.output),

    // operations
    clearAttachments,
    removeAttachment,
  };
};