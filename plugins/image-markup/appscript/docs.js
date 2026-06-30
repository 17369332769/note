/**
 * Docs-specific homepage.
 *
 * @param {Object=} event Workspace event.
 * @return {CardService.Card[]}
 */
function buildDocsHomeCard(event) {
  return [buildDocsSourceCard_('document')];
}

/**
 * Builds the Docs image source picker.
 *
 * @param {string=} activeTab Active Docs source tab.
 * @return {CardService.Card}
 */
function buildDocsSourceCard_(activeTab) {
  const tab = activeTab || 'document';
  const builder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(ADDON_NAME).setSubtitle('doc'));

  builder.addSection(buildDocsTabBarSection_(tab));

  if (tab === 'upload') {
    builder.addSection(buildDocsUploadSection_());
  } else if (tab === 'url') {
    builder.addSection(buildDocsUrlSection_());
  } else {
    builder.addSection(buildDocsDocumentSection_());
  }

  builder.addSection(buildDocsUtilitySection_());

  return builder.build();
}

/**
 * Builds the top tab bar section for Docs.
 *
 * @param {string} activeTab Active tab.
 * @return {CardService.CardSection}
 */
function buildDocsTabBarSection_(activeTab) {
  return CardService.newCardSection()
    .addWidget(buildDocsSourceTabs_(activeTab));
}

/**
 * Builds the Docs source tab selector.
 *
 * @param {string} activeTab Active tab.
 * @return {CardService.ButtonSet}
 */
function buildDocsSourceTabs_(activeTab) {
  return CardService.newButtonSet()
    .addButton(buildDocsSourceTabButton_('文档图片', 'document', activeTab))
    .addButton(buildDocsSourceTabButton_('上传', 'upload', activeTab))
    .addButton(buildDocsSourceTabButton_('地址', 'url', activeTab));
}

/**
 * Builds a single Docs source tab button.
 *
 * @param {string} label Button label.
 * @param {string} tab Tab key.
 * @param {string} activeTab Active tab.
 * @return {CardService.TextButton}
 */
function buildDocsSourceTabButton_(label, tab, activeTab) {
  const button = CardService.newTextButton()
    .setText(label)
    .setOnClickAction(CardService.newAction().setFunctionName('showDocsSourceTab').setParameters({ tab: tab }));

  if (tab === activeTab) {
    button.setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  } else {
    button.setTextButtonStyle(CardService.TextButtonStyle.TEXT);
  }

  return button;
}

/**
 * Updates the Docs source card after tab changes.
 *
 * @param {Object} event Workspace action event.
 * @return {CardService.ActionResponse}
 */
function showDocsSourceTab(event) {
  const parameters = event && event.parameters ? event.parameters : {};
  return updateCard_(buildDocsSourceCard_(parameters.tab || 'document'));
}

/**
 * Builds the current document source section.
 *
 * @return {CardService.CardSection}
 */
function buildDocsDocumentSection_() {
  return CardService.newCardSection()
    .addWidget(CardService.newTextButton().setText('选择文档中的图片').setOnClickAction(CardService.newAction().setFunctionName('scanDocsImages')));
}

/**
 * Builds the upload source section.
 *
 * @return {CardService.CardSection}
 */
function buildDocsUploadSection_() {
  const uploadUrl = getEditorBaseUrl_() + '/image-markup?sourceLabel=' + encodeURIComponent('Uploaded image') + '&localUpload=1';
  return CardService.newCardSection()
    .addWidget(CardService.newTextButton().setText('上传图片').setOpenLink(CardService.newOpenLink().setUrl(uploadUrl).setOpenAs(CardService.OpenAs.FULL_SIZE)));
}

/**
 * Builds the image URL source section.
 *
 * @return {CardService.CardSection}
 */
function buildDocsUrlSection_() {
  return CardService.newCardSection()
    .addWidget(CardService.newTextInput().setFieldName('imageUrl').setTitle('图片地址'))
    .addWidget(CardService.newTextButton().setText('打开图片地址').setOnClickAction(CardService.newAction().setFunctionName('createDocsImageUrlSession')));
}

/**
 * Builds secondary Docs actions below the source tabs.
 *
 * @return {CardService.CardSection}
 */
function buildDocsUtilitySection_() {
  return CardService.newCardSection()
    .setHeader('More')
    .addWidget(CardService.newTextButton().setText('Recent sessions').setOnClickAction(CardService.newAction().setFunctionName('showRecentSessions')))
    .addWidget(CardService.newTextButton().setText('Settings').setOnClickAction(CardService.newAction().setFunctionName('showSettings')));
}

/**
 * Scans the current Google Doc for inline images.
 *
 * @return {CardService.ActionResponse}
 */
function scanDocsImages() {
  try {
    const doc = DocumentApp.getActiveDocument();
    if (!doc) {
      return navigateToCard_(buildUnsupportedCard_('No active document', 'Open a Google Doc before scanning for images.'));
    }

    const images = getDocsInlineImages_(doc);
    return navigateToCard_(buildImageListCard_('Current Doc images', images, 'docs'));
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Creates an annotation session from an image URL entered in Docs.
 *
 * @param {Object} event Workspace action event.
 * @return {CardService.ActionResponse}
 */
function createDocsImageUrlSession(event) {
  try {
    const values = getFormValues_(event);
    const imageUrl = String(values.imageUrl || '').trim();
    if (!imageUrl) {
      throw new Error('Enter an image address.');
    }
    if (!/^https?:\/\//i.test(imageUrl)) {
      throw new Error('Use an http or https image address.');
    }

    const doc = DocumentApp.getActiveDocument();
    if (!doc) {
      throw new Error('Open a Google Doc before using an image address.');
    }

    const source = {
      type: 'image-url',
      documentId: doc.getId(),
      url: imageUrl,
      label: 'Image address',
      filename: getFilenameFromUrl_(imageUrl)
    };
    const session = createSessionForSource_('docs', source);
    const openLink = CardService.newOpenLink()
      .setUrl(session.editorUrl)
      .setOpenAs(CardService.OpenAs.FULL_SIZE)
      .setOnClose(CardService.OnClose.RELOAD_ADD_ON);

    return CardService.newActionResponseBuilder()
      .setOpenLink(openLink)
      .setNotification(CardService.newNotification().setText('Annotation session created.'))
      .build();
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Collects inline images from a document body.
 *
 * @param {GoogleAppsScript.Document.Document} doc Active document.
 * @return {Array<Object>}
 */
function getDocsInlineImages_(doc) {
  const body = doc.getBody();
  const images = [];

  walkDocsElement_(body, function (element) {
    if (element.getType && element.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      const inlineImage = element.asInlineImage();
      const index = images.length;
      images.push({
        type: 'docs-inline-image',
        documentId: doc.getId(),
        label: 'Current document image ' + (index + 1),
        imageIndex: index,
        width: inlineImage.getWidth(),
        height: inlineImage.getHeight()
      });
    }
  });

  return images;
}

/**
 * Walks a Docs element tree.
 *
 * @param {GoogleAppsScript.Document.Element} element Element.
 * @param {Function} visitor Visitor callback.
 */
function walkDocsElement_(element, visitor) {
  visitor(element);
  if (!element.getNumChildren) return;

  for (let index = 0; index < element.getNumChildren(); index += 1) {
    walkDocsElement_(element.getChild(index), visitor);
  }
}

/**
 * Loads a Docs inline image blob by generated index.
 *
 * @param {Object} source ImageSource.
 * @return {Blob}
 */
function getDocsImageBlob_(source) {
  const doc = DocumentApp.openById(source.documentId);
  const images = [];

  walkDocsElement_(doc.getBody(), function (element) {
    if (element.getType && element.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      images.push(element.asInlineImage());
    }
  });

  const inlineImage = images[source.imageIndex];
  if (!inlineImage) {
    throw new Error('The source inline image could not be found.');
  }

  return inlineImage.getBlob().setName((source.label || 'doc-image') + '.png');
}

/**
 * Loads an image blob from a user-provided URL.
 *
 * @param {Object} source ImageSource.
 * @return {Blob}
 */
function getImageUrlBlob_(source) {
  const response = UrlFetchApp.fetch(source.url, {
    followRedirects: true,
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('The image address could not be loaded.');
  }

  const blob = response.getBlob();
  const contentType = String(blob.getContentType() || '').toLowerCase();
  if (!isSupportedImageMimeType_(contentType)) {
    throw new Error('The image address must point to PNG, JPEG, GIF, or WebP.');
  }

  return blob.setName(source.filename || 'image-url');
}

/**
 * Returns a safe file name from a URL.
 *
 * @param {string} url Image URL.
 * @return {string}
 */
function getFilenameFromUrl_(url) {
  try {
    const cleanUrl = String(url).split('#')[0].split('?')[0];
    const name = decodeURIComponent(cleanUrl.split('/').filter(Boolean).pop() || '');
    return name || 'image-url';
  } catch (error) {
    return 'image-url';
  }
}

/**
 * Inserts completed output into the current document.
 *
 * @param {Object} session AnnotationSession.
 * @return {CardService.ActionResponse}
 */
function insertIntoDocs(event) {
  try {
    const session = requireSessionFromEvent_(event);
    if (!session.annotatedImageFileId) {
      throw new Error('Save the annotated image before inserting it.');
    }

    const doc = DocumentApp.openById(session.source.documentId);
    const body = doc.getBody();
    const imageBlob = DriveApp.getFileById(session.annotatedImageFileId).getBlob();
    body.appendParagraph('Annotated image: ' + (session.source.label || session.id)).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendImage(imageBlob);

    if (session.editBriefFileId) {
      const briefText = DriveApp.getFileById(session.editBriefFileId).getBlob().getDataAsString();
      body.appendParagraph('Edit brief').setHeading(DocumentApp.ParagraphHeading.HEADING4);
      body.appendParagraph(briefText);
    }

    session.status = 'inserted';
    session.updatedAt = new Date().toISOString();
    saveSession_(session);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Annotated image inserted into the Doc.'))
      .build();
  } catch (error) {
    return buildErrorResponse_(error);
  }
}
