/**
 * Builds the add-on homepage for Sheets and Drive.
 *
 * @return {CardService.Card[]}
 */
function buildHomepage() {
  const cleanupAction = CardService.newAction().setFunctionName('trimSelectedRange');

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Sheet Cleanup Toolkit').setSubtitle('Prepare messy ranges faster.'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Select a range in Google Sheets, then trim extra whitespace from every text cell.'))
        .addWidget(CardService.newTextButton().setText('Trim selected range').setOnClickAction(cleanupAction))
    )
    .build();

  return [card];
}

/**
 * Trims whitespace in the currently selected spreadsheet range.
 *
 * @return {CardService.ActionResponse}
 */
function trimSelectedRange() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const range = spreadsheet.getActiveRange();

  if (!range) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Select a range first.'))
      .build();
  }

  const values = range.getValues();
  const cleaned = values.map(function (row) {
    return row.map(function (value) {
      return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
    });
  });

  range.setValues(cleaned);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Selected range cleaned.'))
    .build();
}
