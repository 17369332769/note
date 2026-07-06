/**
 * Creates a prepared editor session from the currently selected Docs image.
 *
 * @return {Object}
 */
function createDocsSelectedImageSessionFromSidebar() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('Open a Google Doc before finding images.');
  }

  const selectedImage = findSelectedDocsInlineImage_(doc);
  if (!selectedImage) {
    throw new Error('Select an inline image in the document, then try again.');
  }

  const source = Object.assign({}, selectedImage.source);
  const image = selectedImage.image;
  delete source.previewDataUrl;
  const session = createSessionForSource_('docs', source);
  return {
    ok: true,
    sessionId: session.id,
    image: image
  };
}

/**
 * Finds the first inline image inside the current Docs selection.
 *
 * @param {GoogleAppsScript.Document.Document} doc Active document.
 * @return {{source:Object,image:Object}|null}
 */
function findSelectedDocsInlineImage_(doc) {
  const selection = doc.getSelection();
  if (!selection) return null;

  const rangeElements = selection.getRangeElements();
  for (let rangeIndex = 0; rangeIndex < rangeElements.length; rangeIndex += 1) {
    const selectedElement = findInlineImageInElement_(rangeElements[rangeIndex].getElement());
    if (selectedElement) {
      const imageIndex = getDocsInlineImageIndex_(doc, selectedElement);
      if (imageIndex < 0) return null;
      const preview = buildDocsImageSource_(doc, selectedElement, imageIndex);
      return {
        source: preview,
        image: preview
      };
    }
  }

  return null;
}

/**
 * Finds an inline image at or under a Docs element.
 *
 * @param {GoogleAppsScript.Document.Element} element Element.
 * @return {GoogleAppsScript.Document.InlineImage|null}
 */
function findInlineImageInElement_(element) {
  if (!element) return null;
  if (element.getType && element.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
    return element.asInlineImage();
  }
  if (!element.getNumChildren) return null;

  for (let index = 0; index < element.getNumChildren(); index += 1) {
    const found = findInlineImageInElement_(element.getChild(index));
    if (found) return found;
  }
  return null;
}

/**
 * Returns the document order index for an inline image element.
 *
 * @param {GoogleAppsScript.Document.Document} doc Active document.
 * @param {GoogleAppsScript.Document.InlineImage} target Inline image.
 * @return {number}
 */
function getDocsInlineImageIndex_(doc, target) {
  let foundIndex = -1;
  let currentIndex = 0;
  const targetSignature = getInlineImageSignature_(target);
  walkDocsElement_(doc.getBody(), function (element) {
    if (foundIndex !== -1 || !element.getType || element.getType() !== DocumentApp.ElementType.INLINE_IMAGE) return;
    const inlineImage = element.asInlineImage();
    if (inlineImage === target || getInlineImageSignature_(inlineImage) === targetSignature) {
      foundIndex = currentIndex;
      return;
    }
    currentIndex += 1;
  });
  return foundIndex;
}

/**
 * Builds a lightweight signature for matching a selected image back to document order.
 *
 * @param {GoogleAppsScript.Document.InlineImage} inlineImage Inline image.
 * @return {string}
 */
function getInlineImageSignature_(inlineImage) {
  try {
    const blob = inlineImage.getBlob();
    return [
      inlineImage.getWidth(),
      inlineImage.getHeight(),
      blob.getContentType(),
      blob.getBytes().length
    ].join(':');
  } catch (error) {
    return [inlineImage.getWidth(), inlineImage.getHeight()].join(':');
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
    throw new Error('Open a Google Doc before uploading an image.');
  }
  if (!isSupportedImageMimeType_(body.mimeType)) {
    throw new Error('Use a PNG, JPEG, or WebP image.');
  }
  if (!body.r2Key) {
    throw new Error('The uploaded image is missing its storage key. Please upload it again.');
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
    sessionToken: session.accessToken,
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
      images.push(buildDocsImageSource_(doc, inlineImage, index));
    }
  });

  return images;
}

/**
 * Builds source metadata for a Docs inline image.
 *
 * @param {GoogleAppsScript.Document.Document} doc Active document.
 * @param {GoogleAppsScript.Document.InlineImage} inlineImage Inline image.
 * @param {number} index Image index.
 * @return {Object}
 */
function buildDocsImageSource_(doc, inlineImage, index) {
  return {
    type: 'docs-inline-image',
    documentId: doc.getId(),
    label: 'Document image ' + (index + 1),
    imageIndex: index,
    width: inlineImage.getWidth(),
    height: inlineImage.getHeight(),
    previewDataUrl: buildInlineImagePreviewDataUrl_(inlineImage)
  };
}

/**
 * Builds a data URL preview for a Docs inline image.
 *
 * @param {GoogleAppsScript.Document.InlineImage} inlineImage Inline image.
 * @return {string}
 */
function buildInlineImagePreviewDataUrl_(inlineImage) {
  try {
    const blob = inlineImage.getBlob();
    const contentType = blob.getContentType() || 'image/png';
    return 'data:' + contentType + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (error) {
    return '';
  }
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
  const doc = getCurrentDocsDocumentForSource_(source);
  const images = [];

  walkDocsElement_(doc.getBody(), function (element) {
    if (element.getType && element.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      images.push(element.asInlineImage());
    }
  });

  const inlineImage = images[source.imageIndex];
  if (!inlineImage) {
    throw new Error('The source image is no longer available in this document.');
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
      throw new Error('Save a marked-up image or clean revision before inserting it into the document.');
    }

    insertOutputIntoDocs_(session, outputImageR2Key, session.source.label || session.id);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(session.revisedImageR2Key ? 'Clean revision inserted into the document.' : 'Marked-up image inserted into the document.'))
      .build();
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Inserts an R2-backed output image into the session's Google Doc.
 *
 * @param {Object} session AnnotationSession.
 * @param {string} outputImageR2Key R2 object key.
 * @param {string=} label Output label.
 */
function insertOutputIntoDocs_(session, outputImageR2Key, label) {
  const doc = getCurrentDocsDocumentForSource_(session.source);
  const body = doc.getBody();
  const imageBlob = fetchR2Blob_(outputImageR2Key, session.id + '-output.png', 'image/png');
  const title = session.revisedImageR2Key ? 'Generated image: ' : 'Marked-up image: ';
  body.appendParagraph(title + (label || session.source.label || session.id)).setHeading(DocumentApp.ParagraphHeading.HEADING3);
  body.appendImage(imageBlob);

  const briefText = session.editBrief
    ? JSON.stringify(session.editBrief, null, 2)
    : session.editBriefR2Key
      ? fetchR2Text_(session.editBriefR2Key)
      : '';
  if (briefText) {
    body.appendParagraph('Edit notes').setHeading(DocumentApp.ParagraphHeading.HEADING4);
    body.appendParagraph(briefText);
  }

  session.status = 'inserted';
  session.updatedAt = new Date().toISOString();
  saveSession_(session);
}

/**
 * Returns the current Docs document when it matches the session source.
 *
 * @param {Object} source ImageSource.
 * @return {GoogleAppsScript.Document.Document}
 */
function getCurrentDocsDocumentForSource_(source) {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('Open the source Google Doc, then try again.');
  }

  if (source && source.documentId && doc.getId() !== source.documentId) {
    throw new Error('Open the source Google Doc for this image, then try again.');
  }

  return doc;
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
    throw new Error('Could not download the saved image.');
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
    throw new Error('Could not download the edit notes.');
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
    throw new Error(json.error || 'Could not create a download link.');
  }
  return json.downloadUrl;
}
