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
    .setHeader(CardService.newCardHeader().setTitle(ADDON_NAME).setSubtitle('Google Docs'));

  builder.addSection(buildDocsTabBarSection_(tab));

  if (tab === 'upload') {
    builder.addSection(buildDocsUploadSection_());
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
    .addButton(buildDocsSourceTabButton_('本地上传', 'upload', activeTab));
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
  return CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('打开编辑器后在页面内上传 PNG、JPEG 或 WebP 图片。'))
    .addWidget(CardService.newTextButton().setText('上传本地图片').setOnClickAction(CardService.newAction().setFunctionName('createDocsLocalUploadSession')));
}

/**
 * Builds secondary Docs actions below the source tabs.
 *
 * @return {CardService.CardSection}
 */
function buildDocsUtilitySection_() {
  return CardService.newCardSection()
    .setHeader('更多')
    .addWidget(CardService.newTextButton().setText('最近会话').setOnClickAction(CardService.newAction().setFunctionName('showRecentSessions')))
    .addWidget(CardService.newTextButton().setText('设置').setOnClickAction(CardService.newAction().setFunctionName('showSettings')));
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
      return navigateToCard_(buildUnsupportedCard_('未打开文档', '请先打开一个 Google Doc，再选择图片。'));
    }

    const images = getDocsInlineImages_(doc);
    return navigateToCard_(buildImageListCard_('当前文档图片', images, 'docs'));
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Returns Docs inline images for the HtmlService sidebar.
 *
 * @return {Object}
 */
function listDocsImagesForSidebar() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('请先打开一个 Google Doc，再选择图片。');
  }

  return {
    ok: true,
    images: getDocsInlineImages_(doc)
  };
}

/**
 * Creates a prepared editor session for a Docs inline image.
 *
 * @param {number|string} imageIndex Image index from listDocsImagesForSidebar.
 * @return {Object}
 */
function createDocsImageSessionFromSidebar(imageIndex) {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('请先打开一个 Google Doc，再选择图片。');
  }

  const images = getDocsInlineImages_(doc);
  const index = Number(imageIndex);
  const source = images[index];
  if (!source) {
    throw new Error('找不到所选文档图片。');
  }

  const session = createSessionForSource_('docs', source);
  return {
    ok: true,
    sessionId: session.id,
    label: source.label,
    width: source.width,
    height: source.height
  };
}

/**
 * Creates an annotation session for a local upload from Docs.
 *
 * @param {Object} event Workspace action event.
 * @return {CardService.ActionResponse}
 */
function createDocsLocalUploadSession(event) {
  try {
    const doc = DocumentApp.getActiveDocument();
    if (!doc) {
      throw new Error('请先打开一个 Google Doc，再上传图片。');
    }

    const source = {
      type: 'local-upload',
      documentId: doc.getId(),
      label: '本地上传图片',
      filename: 'uploaded-image.png'
    };
    const session = createSessionForSource_('docs', source);
    openImageMarkupEditorDialog({
      sessionId: session.id,
      sourceLabel: source.label,
      apptype: 'addon',
      localUpload: 1
    });

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('已在弹窗中打开上传编辑器。'))
      .build();
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Creates a Docs local-upload session from a sidebar file picker.
 *
 * @param {Object} payload Uploaded image payload.
 * @return {Object}
 */
function createDocsUploadSessionFromSidebar(payload) {
  const body = payload || {};
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('请先打开一个 Google Doc，再上传图片。');
  }
  if (!isSupportedImageMimeType_(body.mimeType)) {
    throw new Error('仅支持 PNG、JPEG 或 WebP 图片。');
  }
  if (!body.r2Key) {
    throw new Error('缺少已上传图片的 R2 key。');
  }

  const filename = body.name || 'uploaded-image';
  const source = {
    type: 'local-upload',
    documentId: doc.getId(),
    label: filename,
    filename: filename,
    originalFilename: filename,
    mimeType: body.mimeType,
    r2Key: String(body.r2Key),
    size: body.size || null
  };
  const session = createSessionForSource_('docs', source);
  session.editorUrl = buildHostedEditorUrl_({
    sessionId: session.id,
    sourceLabel: filename,
    apptype: 'addon'
  });
  session.updatedAt = new Date().toISOString();
  saveSession_(session);

  return {
    ok: true,
    sessionId: session.id,
    filename: filename
  };
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
        label: '文档图片 ' + (index + 1),
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
    throw new Error('找不到源文档图片。');
  }

  return inlineImage.getBlob().setName((source.label || 'doc-image') + '.png');
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
    const outputImageR2Key = session.revisedImageR2Key || session.annotatedImageR2Key;
    if (!outputImageR2Key) {
      throw new Error('请先保存标注图或修订图，再插入文档。');
    }

    const doc = DocumentApp.openById(session.source.documentId);
    const body = doc.getBody();
    const imageBlob = fetchR2Blob_(outputImageR2Key, session.id + '-output.png', 'image/png');
    const title = session.revisedImageR2Key ? '修订图：' : '标注图：';
    body.appendParagraph(title + (session.source.label || session.id)).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendImage(imageBlob);

    const briefText = session.editBrief
      ? JSON.stringify(session.editBrief, null, 2)
      : session.editBriefR2Key
        ? fetchR2Text_(session.editBriefR2Key)
        : '';
    if (briefText) {
      body.appendParagraph('修改说明').setHeading(DocumentApp.ParagraphHeading.HEADING4);
      body.appendParagraph(briefText);
    }

    session.status = 'inserted';
    session.updatedAt = new Date().toISOString();
    saveSession_(session);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(session.revisedImageR2Key ? '修订图已插入文档。' : '标注图已插入文档。'))
      .build();
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Downloads a private R2 object through a short-lived signed URL.
 *
 * @param {string} key R2 object key.
 * @param {string} filename Blob filename.
 * @param {string} fallbackMimeType Fallback MIME type.
 * @return {Blob}
 */
function fetchR2Blob_(key, filename, fallbackMimeType) {
  const downloadUrl = createR2DownloadUrl_(key);
  const response = UrlFetchApp.fetch(downloadUrl, {
    method: 'get',
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('无法下载 R2 图片。');
  }

  const headers = response.getHeaders();
  const mimeType = headers['Content-Type'] || headers['content-type'] || fallbackMimeType || 'application/octet-stream';
  return Utilities.newBlob(response.getContent(), mimeType, filename);
}

/**
 * Downloads an R2 text object.
 *
 * @param {string} key R2 object key.
 * @return {string}
 */
function fetchR2Text_(key) {
  const downloadUrl = createR2DownloadUrl_(key);
  const response = UrlFetchApp.fetch(downloadUrl, {
    method: 'get',
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('无法下载 R2 文本。');
  }
  return response.getContentText();
}

/**
 * Requests a signed R2 download URL from the hosted editor backend.
 *
 * @param {string} key R2 object key.
 * @return {string}
 */
function createR2DownloadUrl_(key) {
  const response = UrlFetchApp.fetch(getEditorBaseUrl_().replace(/\/+$/, '') + '/api/image-markup/r2/download-url', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      key: key,
      ttlSeconds: 900
    }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const json = JSON.parse(response.getContentText() || '{}');
  if (status < 200 || status >= 300 || !json.ok || !json.downloadUrl) {
    throw new Error(json.error || '无法创建 R2 下载链接。');
  }
  return json.downloadUrl;
}
