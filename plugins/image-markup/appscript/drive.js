/**
 * External file sources are intentionally unsupported. The add-on stores images
 * in R2 and only reads images from the current Google Doc or sidebar upload flow.
 *
 * @param {Object} event Workspace add-on event.
 * @return {CardService.Card[]}
 */
function buildDriveItemsCard(event) {
  return [buildUnsupportedFileSourceCard_()];
}
