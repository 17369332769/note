/**
 * Builds the contextual Drive card for selected files.
 *
 * @param {Object} event Drive add-on event.
 * @return {CardService.Card[]}
 */
function buildDriveItemsCard(event) {
  const files = getDriveSelectedFiles_(event);

  if (!files.length) {
    return [buildUnsupportedCard_('Select an image', 'Select one Drive image file, then reopen Image Markup.')];
  }

  const imageSources = files.map(function (file) {
    return buildDriveImageSource_(file.id);
  }).filter(function (source) {
    return Boolean(source);
  });

  if (!imageSources.length) {
    return [buildUnsupportedCard_('Unsupported Drive selection', 'The selected Drive item is not a supported image. Use PNG, JPEG, GIF, or WebP.')];
  }

  return [buildImageListCard_('Selected Drive images', imageSources, 'drive')];
}

/**
 * Extracts selected Drive file metadata from supported event shapes.
 *
 * @param {Object} event Drive add-on event.
 * @return {Array<Object>}
 */
function getDriveSelectedFiles_(event) {
  const drive = event && event.drive ? event.drive : {};
  const selectedItems = drive.selectedItems || drive.selectedItemsMetadata || [];

  return selectedItems.map(function (item) {
    return {
      id: item.id || item.fileId,
      mimeType: item.mimeType,
      title: item.title || item.name
    };
  }).filter(function (item) {
    return Boolean(item.id);
  });
}

/**
 * Builds an ImageSource for a Drive file when supported.
 *
 * @param {string} fileId Drive file ID.
 * @return {Object|null}
 */
function buildDriveImageSource_(fileId) {
  const file = DriveApp.getFileById(fileId);
  const mimeType = file.getMimeType();

  if (!isSupportedImageMimeType_(mimeType)) {
    return null;
  }

  return {
    type: 'drive-file',
    fileId: file.getId(),
    filename: file.getName(),
    mimeType: mimeType,
    label: file.getName()
  };
}

/**
 * Loads a source blob for Drive.
 *
 * @param {Object} source ImageSource.
 * @return {Blob}
 */
function getDriveImageBlob_(source) {
  const file = DriveApp.getFileById(source.fileId);
  const mimeType = file.getMimeType();

  if (!isSupportedImageMimeType_(mimeType)) {
    throw new Error('The selected Drive file is not a supported image.');
  }

  return file.getBlob().setName(file.getName());
}

/**
 * Saves completed outputs in Drive.
 *
 * @param {Object} session AnnotationSession.
 * @param {Blob} pngBlob Annotated PNG blob.
 * @param {string} editBriefJson JSON brief.
 * @return {Object}
 */
function saveDriveOutputs_(session, pngBlob, editBriefJson) {
  const folder = getOutputFolder_();
  const sourceLabel = session.source && (session.source.filename || session.source.label) ? session.source.filename || session.source.label : session.id;
  const pngFile = folder.createFile(pngBlob.setName(sourceLabel + ' - annotated.png'));
  const briefFile = folder.createFile(sourceLabel + ' - edit brief.json', editBriefJson, MimeType.PLAIN_TEXT);

  session.annotatedImageFileId = pngFile.getId();
  session.editBriefFileId = briefFile.getId();
  session.status = 'saved';
  session.updatedAt = new Date().toISOString();
  saveSession_(session);

  return {
    annotatedImageFileId: pngFile.getId(),
    editBriefFileId: briefFile.getId()
  };
}
