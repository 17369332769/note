/**
 * Handles editor callbacks and lightweight session lookups.
 *
 * @param {Object} event Apps Script web app event.
 * @return {GoogleAppsScript.Content.TextOutput|GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  if (params.api === 'session' || params.includeImage === '1') {
    return jsonResponse_(getEditorSessionPayload(params.sessionId, params.includeImage === '1', params.sessionToken || params.accessToken));
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
function getEditorSessionPayload(sessionId, includeImage, sessionToken) {
  if (!sessionId) {
    return {
      ok: false,
      error: 'sessionId is required.',
      session: null,
      originalImage: null
    };
  }

  const session = getSession_(sessionId);
  if (session && !validateSessionAccess_(session, sessionToken)) {
    return {
      ok: false,
      error: 'Invalid editing session token.',
      session: null,
      originalImage: null
    };
  }
  const originalImage = session && includeImage ? buildOriginalImagePayload_(session) : null;

  return {
    ok: Boolean(session),
    session: sanitizeSessionForEditor_(session),
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
      error: error.message || 'Could not save the edited image.'
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
    return getEditorSessionPayload(body.sessionId, body.includeImage === true, body.sessionToken);
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
  if (action === 'createDocsSelectedImageSession') {
    return createDocsSelectedImageSessionFromSidebar();
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
    throw new Error('This editing session is no longer available. Please start again.');
  }
  if (!validateSessionAccess_(session, payload.sessionToken)) {
    throw new Error('Invalid editing session token.');
  }

  if (!payload.annotatedImageR2Key) {
    throw new Error('The marked-up image is missing its storage key. Please save again.');
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
 * Checks that a browser request belongs to the prepared editor session.
 *
 * @param {Object} session Annotation session.
 * @param {string=} sessionToken Token from the editor URL.
 * @return {boolean}
 */
function validateSessionAccess_(session, sessionToken) {
  if (!session || !session.accessToken) return false;
  return String(sessionToken || '') === String(session.accessToken);
}

/**
 * Removes private fields before returning session metadata to callers.
 *
 * @param {Object|null} session Annotation session.
 * @return {Object|null}
 */
function sanitizeSessionForEditor_(session) {
  if (!session) return null;
  const copy = {};
  Object.keys(session).forEach(function (key) {
    if (key !== 'accessToken') copy[key] = session[key];
  });
  return copy;
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
