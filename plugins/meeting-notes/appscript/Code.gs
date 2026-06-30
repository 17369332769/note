/**
 * Builds the default homepage card shown when no Calendar event is selected.
 *
 * @return {CardService.Card[]}
 */
function buildHomepage() {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Meeting Notes Assistant').setSubtitle('Create structured notes from Calendar.'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Open a Calendar event to create a linked meeting notes document.'))
        .addWidget(
          CardService.newTextButton()
            .setText('Open Google Calendar')
            .setOpenLink(CardService.newOpenLink().setUrl('https://calendar.google.com/'))
        )
    )
    .build();

  return [card];
}

/**
 * Builds a contextual card when a Calendar event is opened.
 *
 * @param {Object} event Add-on event object supplied by Google Workspace.
 * @return {CardService.Card[]}
 */
function buildEventCard(event) {
  const calendarEvent = event && event.calendar ? event.calendar : {};
  const title = calendarEvent.summary || 'Selected meeting';

  const createAction = CardService.newAction()
    .setFunctionName('createMeetingNotes')
    .setParameters({
      title: title,
      eventId: calendarEvent.id || ''
    });

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title).setSubtitle('Meeting notes workflow'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Create a Google Doc with agenda, notes, and action item sections.'))
        .addWidget(CardService.newTextButton().setText('Create notes doc').setOnClickAction(createAction))
    )
    .build();

  return [card];
}

/**
 * Creates a Google Doc for meeting notes and returns a navigation response.
 *
 * @param {Object} event Action event object supplied by Google Workspace.
 * @return {CardService.ActionResponse}
 */
function createMeetingNotes(event) {
  const parameters = event && event.parameters ? event.parameters : {};
  const title = parameters.title || 'Meeting Notes';
  const doc = DocumentApp.create(title + ' - Notes');
  const body = doc.getBody();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Agenda').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('- ');
  body.appendParagraph('Notes').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('');
  body.appendParagraph('Action Items').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('- Owner / task / due date');

  const openLink = CardService.newOpenLink().setUrl(doc.getUrl());

  return CardService.newActionResponseBuilder()
    .setOpenLink(openLink)
    .setNotification(CardService.newNotification().setText('Meeting notes document created.'))
    .build();
}
