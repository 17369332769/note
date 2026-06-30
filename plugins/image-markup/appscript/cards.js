/**
 * Builds the host-aware add-on homepage.
 *
 * @param {Object=} event Workspace add-on event.
 * @return {CardService.Card}
 */
function buildHomeCard_(event) {
  const host = detectHost_(event);

  if (host === 'docs') return buildDocsSourceCard_('document');
  if (host === 'slides') return buildSlidesSourceCard_();
  if (host === 'drive') return buildDriveHomeCard_();

  return buildUnsupportedCard_('Unsupported environment', 'This add-on currently supports Drive, Docs, and Slides.');
}

/**
 * Builds the Drive homepage when no Drive item selection event is present.
 *
 * @return {CardService.Card}
 */
function buildDriveHomeCard_() {
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('Select an image file in Drive, then reopen this add-on and choose Annotate from the selected image card.'))
    .addWidget(CardService.newTextButton().setText('View recent sessions').setOnClickAction(CardService.newAction().setFunctionName('showRecentSessions')))
    .addWidget(CardService.newTextButton().setText('Settings').setOnClickAction(CardService.newAction().setFunctionName('showSettings')));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(ADDON_NAME).setSubtitle('drive'))
    .addSection(section)
    .build();
}

/**
 * Builds the Slides homepage.
 *
 * @return {CardService.Card}
 */
function buildSlidesSourceCard_() {
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('Choose an image from the current presentation, then open the external markup editor.'))
    .addWidget(CardService.newTextButton().setText('Scan current Slide images').setOnClickAction(CardService.newAction().setFunctionName('scanSlidesImages')))
    .addWidget(CardService.newTextButton().setText('View recent sessions').setOnClickAction(CardService.newAction().setFunctionName('showRecentSessions')))
    .addWidget(CardService.newTextButton().setText('Settings').setOnClickAction(CardService.newAction().setFunctionName('showSettings')));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(ADDON_NAME).setSubtitle('slide'))
    .addSection(section)
    .build();
}

/**
 * Detects the current host from the Workspace event object.
 *
 * @param {Object=} event Workspace add-on event.
 * @return {string}
 */
function detectHost_(event) {
  const hostApp = event && event.commonEventObject && event.commonEventObject.hostApp
    ? String(event.commonEventObject.hostApp).toLowerCase()
    : '';

  if (hostApp.indexOf('drive') !== -1) return 'drive';
  if (hostApp.indexOf('docs') !== -1) return 'docs';
  if (hostApp.indexOf('slides') !== -1) return 'slides';
  return hostApp || 'unsupported';
}

/**
 * Builds an unsupported state card.
 *
 * @param {string} title Title.
 * @param {string} message Message.
 * @return {CardService.Card}
 */
function buildUnsupportedCard_(title, message) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title).setSubtitle(ADDON_NAME))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(message)))
    .build();
}

/**
 * Builds a card listing discovered image sources.
 *
 * @param {string} title Card title.
 * @param {Array<Object>} images Discovered images.
 * @param {string} host Host key.
 * @return {CardService.Card}
 */
function buildImageListCard_(title, images, host) {
  const builder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title).setSubtitle(images.length + ' image source(s) found'));

  if (!images.length) {
    builder.addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('No images were found in the current file.')));
    return builder.build();
  }

  images.forEach(function (image, index) {
    const action = CardService.newAction()
      .setFunctionName('createAnnotationSession')
      .setParameters({
        host: host,
        sourceJson: JSON.stringify(image)
      });

    const section = CardService.newCardSection()
      .addWidget(CardService.newKeyValue().setTopLabel(image.label || 'Image ' + (index + 1)).setContent(buildImageMeta_(image)))
      .addWidget(CardService.newTextButton().setText('Annotate').setOnClickAction(action));

    if (image.previewUrl) {
      section.addWidget(CardService.newImage().setImageUrl(image.previewUrl).setAltText(image.label || 'Image preview'));
    }

    builder.addSection(section);
  });

  return builder.build();
}

/**
 * Builds compact image metadata.
 *
 * @param {Object} image Image source.
 * @return {string}
 */
function buildImageMeta_(image) {
  const parts = [];
  if (image.filename) parts.push(image.filename);
  if (image.mimeType) parts.push(image.mimeType);
  if (image.width && image.height) parts.push(image.width + ' x ' + image.height);
  return parts.join(' | ') || 'Ready for markup';
}

/**
 * Creates a session from a selected source and opens the editor.
 *
 * @param {Object} event Workspace action event.
 * @return {CardService.ActionResponse}
 */
function createAnnotationSession(event) {
  try {
    const parameters = event && event.parameters ? event.parameters : {};
    const source = JSON.parse(parameters.sourceJson || '{}');
    const host = parameters.host || source.host || 'drive';
    const session = createSessionForSource_(host, source);
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
 * Shows recent sessions for the current user.
 *
 * @return {CardService.ActionResponse}
 */
function showRecentSessions() {
  return navigateToCard_(buildRecentSessionsCard_());
}

/**
 * Builds the recent session card.
 *
 * @return {CardService.Card}
 */
function buildRecentSessionsCard_() {
  const sessions = listRecentSessions_();
  const builder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Recent annotation sessions').setSubtitle(ADDON_NAME));

  if (!sessions.length) {
    builder.addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('No sessions yet. Create one from Drive, Docs, or Slides.')));
    return builder.build();
  }

  sessions.forEach(function (session) {
    const section = CardService.newCardSection()
      .addWidget(CardService.newKeyValue().setTopLabel(session.source && session.source.label ? session.source.label : session.id).setContent(session.host + ' | ' + session.status + ' | ' + session.createdAt));

    if (session.originalImageFileId) {
      section.addWidget(CardService.newTextButton().setText('Open original').setOpenLink(CardService.newOpenLink().setUrl('https://drive.google.com/open?id=' + session.originalImageFileId)));
    }
    if (session.annotatedImageFileId) {
      section.addWidget(CardService.newTextButton().setText('Open annotated image').setOpenLink(CardService.newOpenLink().setUrl('https://drive.google.com/open?id=' + session.annotatedImageFileId)));
    }
    if (session.editBriefFileId) {
      section.addWidget(CardService.newTextButton().setText('Open edit brief').setOpenLink(CardService.newOpenLink().setUrl('https://drive.google.com/open?id=' + session.editBriefFileId)));
    }
    if (session.host === 'docs' && session.annotatedImageFileId) {
      section.addWidget(CardService.newTextButton().setText('Insert annotated copy').setOnClickAction(CardService.newAction().setFunctionName('insertIntoDocs').setParameters({ sessionId: session.id })));
    }
    if (session.host === 'slides' && session.annotatedImageFileId) {
      section.addWidget(CardService.newTextButton().setText('Insert annotated copy').setOnClickAction(CardService.newAction().setFunctionName('insertIntoSlides').setParameters({ sessionId: session.id })));
    }

    builder.addSection(section);
  });

  return builder.build();
}

/**
 * Shows deployment settings.
 *
 * @return {CardService.ActionResponse}
 */
function showSettings() {
  const baseUrl = getEditorBaseUrl_();
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Settings').setSubtitle(ADDON_NAME))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newKeyValue().setTopLabel('Editor base URL').setContent(baseUrl))
        .addWidget(CardService.newTextParagraph().setText('Set script property EDITOR_BASE_URL to your deployed Next.js origin before production testing.'))
    )
    .build();

  return navigateToCard_(card);
}
