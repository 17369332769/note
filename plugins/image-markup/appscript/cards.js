/**
 * Builds the host-aware add-on homepage.
 *
 * @param {Object=} event Workspace add-on event.
 * @return {CardService.Card}
 */
function buildHomeCard_(event) {
  const host = detectHost_(event);

  if (host === 'docs') return buildDocsSourceCard_('document');

  return buildUnsupportedCard_('暂不支持', '当前版本只支持 Google Docs。请在 Google Docs 中打开 Image Markup。');
}

/**
 * Builds the unsupported external-file-source card.
 *
 * @return {CardService.Card}
 */
function buildUnsupportedFileSourceCard_() {
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('当前版本只支持 Google Docs。请在 Docs 侧边栏中选择文档图片或本地上传。'));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(ADDON_NAME).setSubtitle('Docs only'))
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
    .setHeader(CardService.newCardHeader().setTitle(title).setSubtitle('找到 ' + images.length + ' 张图片'));

  if (!images.length) {
    builder.addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('当前文档中没有找到图片。')));
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
      .addWidget(CardService.newTextButton().setText('打开标注编辑器').setOnClickAction(action));

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
  return parts.join(' | ') || '可标注';
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
    const host = parameters.host || source.host || 'docs';
    const session = createSessionForSource_(host, source);
    if (host === 'docs') {
      openImageMarkupEditorDialog({
        sessionId: session.id,
        sourceLabel: session.source && (session.source.filename || session.source.label),
        apptype: 'addon',
        localUpload: session.source && session.source.type === 'local-upload' ? 1 : 0
      });

      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText('已在弹窗中打开标注编辑器。'))
        .build();
    }

    const openLink = CardService.newOpenLink()
      .setUrl(session.editorUrl)
      .setOpenAs(CardService.OpenAs.FULL_SIZE)
      .setOnClose(CardService.OnClose.RELOAD_ADD_ON);

    return CardService.newActionResponseBuilder()
      .setOpenLink(openLink)
      .setNotification(CardService.newNotification().setText('已创建标注会话。'))
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
    .setHeader(CardService.newCardHeader().setTitle('最近会话').setSubtitle(ADDON_NAME));

  if (!sessions.length) {
    builder.addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('还没有会话。请先从文档图片或本地上传创建一个。')));
    return builder.build();
  }

  sessions.forEach(function (session) {
    const section = CardService.newCardSection()
      .addWidget(CardService.newKeyValue().setTopLabel(session.source && session.source.label ? session.source.label : session.id).setContent(session.host + ' | ' + session.status + ' | ' + session.createdAt));

    if (session.source && session.source.r2Key) {
      section.addWidget(CardService.newTextButton().setText('打开原图').setOpenLink(CardService.newOpenLink().setUrl(createR2DownloadUrl_(session.source.r2Key))));
    }
    if (session.annotatedImageR2Key) {
      section.addWidget(CardService.newTextButton().setText('打开标注图').setOpenLink(CardService.newOpenLink().setUrl(createR2DownloadUrl_(session.annotatedImageR2Key))));
    }
    if (session.revisedImageR2Key) {
      section.addWidget(CardService.newTextButton().setText('打开修订图').setOpenLink(CardService.newOpenLink().setUrl(createR2DownloadUrl_(session.revisedImageR2Key))));
    }
    if (session.editBriefR2Key) {
      section.addWidget(CardService.newTextButton().setText('打开修改说明').setOpenLink(CardService.newOpenLink().setUrl(createR2DownloadUrl_(session.editBriefR2Key))));
    }
    if (session.host === 'docs' && (session.annotatedImageR2Key || session.revisedImageR2Key)) {
      section.addWidget(CardService.newTextButton().setText(session.revisedImageR2Key ? '插入修订副本' : '插入标注副本').setOnClickAction(CardService.newAction().setFunctionName('insertIntoDocs').setParameters({ sessionId: session.id })));
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
    .setHeader(CardService.newCardHeader().setTitle('设置').setSubtitle(ADDON_NAME))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newKeyValue().setTopLabel('编辑器地址').setContent(baseUrl))
        .addWidget(CardService.newTextParagraph().setText('生产测试前，请把脚本属性 EDITOR_BASE_URL 设置为已部署的 Next.js 域名。'))
    )
    .build();

  return navigateToCard_(card);
}
