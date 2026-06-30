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

  return HtmlService.createHtmlOutputFromFile('Editor')
    .setTitle('Image Markup')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
  const originalImage = session && includeImage && session.originalImageFileId
    ? buildImagePayload_(session.originalImageFileId)
    : null;

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

  const base64 = String(payload.annotatedPngBase64 || '').replace(/^data:image\/png;base64,/, '');
  if (!base64) {
    throw new Error('Missing annotated PNG output.');
  }

  const pngBlob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', session.id + '-annotated.png');
  const editBrief = payload.editBrief || {
    sessionId: session.id,
    sourceLabel: session.source && session.source.label ? session.source.label : session.id,
    globalInstruction: '',
    annotations: []
  };
  const editBriefJson = JSON.stringify(editBrief, null, 2);
  const output = saveDriveOutputs_(session, pngBlob, editBriefJson);

  return {
    ok: true,
    output: output
  };
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
 * Encodes a Drive image for the editor without exposing OAuth tokens.
 *
 * @param {string} fileId Drive file ID.
 * @return {Object}
 */
function buildImagePayload_(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  return {
    filename: file.getName(),
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
    section.addWidget(CardService.newTextButton().setText('Insert annotated copy').setOnClickAction(CardService.newAction().setFunctionName('insertIntoDocs').setParameters({ sessionId: session.id })));
  }
  if (session.host === 'slides') {
    section.addWidget(CardService.newTextButton().setText('Insert annotated copy').setOnClickAction(CardService.newAction().setFunctionName('insertIntoSlides').setParameters({ sessionId: session.id })));
  }

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Session actions').setSubtitle(ADDON_NAME))
    .addSection(section)
    .build();

  return navigateToCard_(card);
}
