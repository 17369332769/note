/**
 * Handles editor callbacks and lightweight session lookups.
 *
 * @param {Object} event Apps Script web app event.
 * @return {GoogleAppsScript.Content.TextOutput|GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  if (params.api === 'session' || params.includeImage === '1') {
    return jsonResponse_(getEditorSessionPayload(params.sessionId, params.includeImage === '1'));
  }

  return buildEditorHtml_(params);
}

/**
 * Returns editor session data for HtmlService and JSON callers.
 *
 * @param {string} sessionId Session ID.
 * @param {boolean=} includeImage Whether to include the source image data URL.
 * @return {Object}
 */
function getEditorSessionPayload(sessionId, includeImage) {
  if (!sessionId) {
    return {
      ok: false,
      error: 'sessionId is required.',
      session: null,
      originalImage: null
    };
  }

  const session = getSession_(sessionId);
  const originalImage = session && includeImage ? buildOriginalImagePayload_(session) : null;

  return {
    ok: Boolean(session),
    session: session,
    originalImage: originalImage
  };
}

/**
 * Receives completed editor output.
 *
 * @param {Object} event Apps Script web app event.
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(event) {
  try {
    const payload = JSON.parse(event.postData && event.postData.contents ? event.postData.contents : '{}');
    return jsonResponse_(saveEditorOutput(payload));
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message || 'Save failed.'
    });
  }
}

/**
 * Runs editor bridge actions from the HtmlService shell as the current user.
 *
 * @param {string} action Bridge action.
 * @param {Object} payload Action payload.
 * @return {Object}
 */
function runImageMarkupBridgeAction(action, payload) {
  const body = payload || {};
  if (action === 'getSession') {
    return getEditorSessionPayload(body.sessionId, body.includeImage === true);
  }
  if (action === 'saveEditorOutput') {
    return saveEditorOutput(body);
  }
  throw new Error('Unsupported editor bridge action.');
}

/**
 * Runs launcher sidebar bridge actions from the HtmlService shell.
 *
 * @param {string} action Bridge action.
 * @param {Object} payload Action payload.
 * @return {Object}
 */
function runImageMarkupSidebarAction(action, payload) {
  const body = payload || {};
  if (action === 'listDocsImages') {
    return listDocsImagesForSidebar();
  }
  if (action === 'createDocsImageSession') {
    return createDocsImageSessionFromSidebar(body.imageIndex);
  }
  if (action === 'createDocsUploadSession') {
    return createDocsUploadSessionFromSidebar(body);
  }
  if (action === 'openPreparedEditor') {
    openPreparedImageMarkupEditorDialog(body.sessionId);
    return { ok: true };
  }
  throw new Error('Unsupported sidebar bridge action.');
}

/**
 * Receives completed editor output from HtmlService or HTTP POST.
 *
 * @param {Object} payload Editor output payload.
 * @return {Object}
 */
function saveEditorOutput(payload) {
  const session = getSession_(payload.sessionId);
  if (!session) {
    throw new Error('Annotation session was not found.');
  }

  if (!payload.annotatedImageR2Key) {
    throw new Error('Missing annotated image R2 key.');
  }

  if (session.source && session.source.type === 'local-upload') {
    session.source.originalFilename = payload.originalFilename || session.source.originalFilename || 'uploaded-image';
    session.source.mimeType = payload.originalMimeType || session.source.mimeType || 'image/png';
    session.source.r2Key = payload.originalImageR2Key || session.source.r2Key;
  }
  const editBrief = payload.editBrief || {
    sessionId: session.id,
    sourceLabel: session.source && session.source.label ? session.source.label : session.id,
    globalInstruction: '',
    annotations: []
  };

  session.annotatedImageR2Key = String(payload.annotatedImageR2Key);
  session.revisedImageR2Key = payload.revisedImageR2Key ? String(payload.revisedImageR2Key) : null;
  session.editBriefR2Key = payload.editBriefR2Key ? String(payload.editBriefR2Key) : null;
  session.editBrief = editBrief;
  if (payload.originalImageR2Key) {
    session.originalImageR2Key = String(payload.originalImageR2Key);
  }
  if (payload.aiRevision) {
    session.aiRevision = payload.aiRevision;
  }
  session.status = 'saved';
  session.updatedAt = new Date().toISOString();
  saveSession_(session);

  const output = {
    annotatedImageR2Key: session.annotatedImageR2Key,
    revisedImageR2Key: session.revisedImageR2Key,
    editBriefR2Key: session.editBriefR2Key
  };

  return {
    ok: true,
    output: output
  };
}

/**
 * Converts an image data URL into a blob.
 *
 * @param {string} dataUrl Data URL.
 * @param {string} fileName File name.
 * @return {Blob}
 */
function dataUrlToBlob_(dataUrl, fileName) {
  const match = String(dataUrl || '').match(/^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/);
  if (!match) {
    throw new Error('Unsupported uploaded image format.');
  }
  const extension = match[1] === 'image/jpeg' ? '.jpg' : match[1] === 'image/webp' ? '.webp' : '.png';
  return Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], fileName + extension);
}

/**
 * Builds a JSON response.
 *
 * @param {Object} value Response body.
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Builds the original image payload for the editor.
 *
 * @param {Object} session Annotation session.
 * @return {Object}
 */
function buildOriginalImagePayload_(session) {
  if (session.source && session.source.r2Key) {
    return {
      filename: session.source.originalFilename || session.source.filename || session.source.label || 'uploaded-image',
      mimeType: session.source.mimeType || 'image/png',
      r2Key: session.source.r2Key
    };
  }

  if (session.originalImageR2Key) {
    return {
      filename: session.source && (session.source.originalFilename || session.source.filename || session.source.label) || 'uploaded-image',
      mimeType: session.source && session.source.mimeType || 'image/png',
      r2Key: session.originalImageR2Key
    };
  }

  const blob = getSourceImageBlob_(session.host, session.source);
  return {
    filename: blob.getName(),
    mimeType: blob.getContentType(),
    dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes())
  };
}

/**
 * Builds a card for write-back actions after editor save.
 *
 * @param {Object} event Workspace action event.
 * @return {CardService.ActionResponse}
 */
function showSessionActions(event) {
  const session = requireSessionFromEvent_(event);
  const section = CardService.newCardSection()
    .addWidget(CardService.newKeyValue().setTopLabel(session.source && session.source.label ? session.source.label : session.id).setContent(session.status));

  if (session.host === 'docs') {
    section.addWidget(CardService.newTextButton().setText(session.revisedImageR2Key ? '插入修订副本' : '插入标注副本').setOnClickAction(CardService.newAction().setFunctionName('insertIntoDocs').setParameters({ sessionId: session.id })));
  }

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('会话操作').setSubtitle(ADDON_NAME))
    .addSection(section)
    .build();

  return navigateToCard_(card);
}
