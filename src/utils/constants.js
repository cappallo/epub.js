export const EPUBJS_VERSION = "0.3";

// Dom events to listen for
export const DOM_EVENTS = ["keydown", "keyup", "keypressed", "mouseup", "mousedown", "mousemove", "click", "touchend", "touchstart", "touchmove"];

// Helper function to create event objects with conditional debug logging
const createEventWithConditionalDebug = (eventName) => ({
  [eventName]: eventName,
  toString: () => {
    // const debugEvents = ['displayed', 'resize', 'resized', 'rendered', 'shown'];
    // if (debugEvents.includes(eventName.toLowerCase())) {
    //   console.debug(`EPUB.js Event Triggered: ${eventName}`);
    // }
    return eventName;
  }
});

// Create events object with conditional debug logging
const createEventsWithConditionalDebug = (eventsObj) => {
  const result = {};
  for (const [category, events] of Object.entries(eventsObj)) {
    result[category] = {};
    for (const [eventName, value] of Object.entries(events)) {
      result[category][eventName] = createEventWithConditionalDebug(value);
    }
  }
  return result;
};

export const EVENTS = createEventsWithConditionalDebug({
  BOOK : {
    OPEN_FAILED : "openFailed"
  },
  CONTENTS : {
    EXPAND : "expand",
    RESIZE : "resize",
    SELECTED : "selected",
    SELECTED_RANGE : "selectedRange",
    LINK_CLICKED : "linkClicked"
  },
  LOCATIONS : {
    CHANGED : "changed"
  },
  MANAGERS : {
    RESIZE : "resize",
    RESIZED : "resized",
    ORIENTATION_CHANGE : "orientationchange",
    ADDED : "added",
    SCROLL : "scroll",
    SCROLLED : "scrolled",
    REMOVED : "removed",
  },
  VIEWS : {
    AXIS: "axis",
    WRITING_MODE: "writingMode",
    LOAD_ERROR : "loaderror",
    RENDERED : "rendered",
    RESIZED : "resized",
    DISPLAYED : "displayed",
    SHOWN : "shown",
    HIDDEN : "hidden",
    MARK_CLICKED : "markClicked"
  },
  RENDITION : {
    STARTED : "started",
    ATTACHED : "attached",
    DISPLAYED : "displayed",
    DISPLAY_ERROR : "displayerror",
    RENDERED : "rendered",
    REMOVED : "removed",
    RESIZED : "resized",
    ORIENTATION_CHANGE : "orientationchange",
    LOCATION_CHANGED : "locationChanged",
    RELOCATED : "relocated",
    MARK_CLICKED : "markClicked",
    SELECTED : "selected",
    LAYOUT: "layout"
  },
  LAYOUT : {
    UPDATED : "updated"
  },
  ANNOTATION : {
    ATTACH : "attach",
    DETACH : "detach"
  }
}
);