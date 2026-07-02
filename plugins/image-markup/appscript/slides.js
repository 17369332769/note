/**
 * Slides-specific homepage.
 *
 * @param {Object=} event Workspace event.
 * @return {CardService.Card[]}
 */
function buildSlidesHomeCard(event) {
  return [buildHomeCard_(event)];
}

/**
 * Scans the current Google Slides presentation for images.
 *
 * @return {CardService.ActionResponse}
 */
function scanSlidesImages() {
  try {
    const presentation = SlidesApp.getActivePresentation();
    if (!presentation) {
      return navigateToCard_(buildUnsupportedCard_('No active presentation', 'Open Google Slides before scanning for images.'));
    }

    const images = getSlidesImages_(presentation);
    return navigateToCard_(buildImageListCard_('Current Slides images', images, 'slides'));
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Collects image page elements from a presentation.
 *
 * @param {GoogleAppsScript.Slides.Presentation} presentation Active presentation.
 * @return {Array<Object>}
 */
function getSlidesImages_(presentation) {
  const images = [];
  const slides = presentation.getSlides();

  slides.forEach(function (slide, slideIndex) {
    slide.getPageElements().forEach(function (element) {
      if (element.getPageElementType() === SlidesApp.PageElementType.IMAGE) {
        const image = element.asImage();
        const imageNumber = images.length + 1;
        images.push({
          type: 'slides-image',
          presentationId: presentation.getId(),
          slideObjectId: slide.getObjectId(),
          pageElementObjectId: element.getObjectId(),
          label: 'Slide ' + (slideIndex + 1) + ' image ' + imageNumber,
          width: Math.round(image.getWidth()),
          height: Math.round(image.getHeight())
        });
      }
    });
  });

  return images;
}

/**
 * Loads a Slides image blob.
 *
 * @param {Object} source ImageSource.
 * @return {Blob}
 */
function getSlidesImageBlob_(source) {
  const presentation = SlidesApp.openById(source.presentationId);
  const slides = presentation.getSlides();

  for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
    const elements = slides[slideIndex].getPageElements();
    for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
      const element = elements[elementIndex];
      if (element.getObjectId() === source.pageElementObjectId && element.getPageElementType() === SlidesApp.PageElementType.IMAGE) {
        return element.asImage().getBlob().setName((source.label || 'slide-image') + '.png');
      }
    }
  }

  throw new Error('The source Slides image could not be found.');
}

/**
 * Inserts completed output into the source slide or first slide fallback.
 *
 * @param {Object} event Workspace action event.
 * @return {CardService.ActionResponse}
 */
function insertIntoSlides(event) {
  try {
    const session = requireSessionFromEvent_(event);
    const outputImageR2Key = session.revisedImageR2Key || session.annotatedImageR2Key;
    if (!outputImageR2Key) {
      throw new Error('Save the annotated image before inserting it.');
    }

    const presentation = SlidesApp.openById(session.source.presentationId);
    const slide = findSlideByObjectId_(presentation, session.source.slideObjectId) || presentation.getSlides()[0];
    const imageBlob = fetchR2Blob_(outputImageR2Key, session.id + '-output.png', 'image/png');
    const inserted = slide.insertImage(imageBlob);
    inserted.setLeft(24).setTop(24);

    session.status = 'inserted';
    session.updatedAt = new Date().toISOString();
    saveSession_(session);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Annotated image inserted into Slides.'))
      .build();
  } catch (error) {
    return buildErrorResponse_(error);
  }
}

/**
 * Finds a slide by object ID.
 *
 * @param {GoogleAppsScript.Slides.Presentation} presentation Presentation.
 * @param {string} slideObjectId Slide object ID.
 * @return {GoogleAppsScript.Slides.Slide|null}
 */
function findSlideByObjectId_(presentation, slideObjectId) {
  const slides = presentation.getSlides();

  for (let index = 0; index < slides.length; index += 1) {
    if (slides[index].getObjectId() === slideObjectId) {
      return slides[index];
    }
  }

  return null;
}
