import EventEmitter from "event-emitter";
import EpubCFI from "./epubcfi";
import { EVENTS } from "./utils/constants";

const isCustomSelectionPreviewData = (data) => {
	return !!(data && typeof data.id === "string" && data.id.indexOf("__custom_selection_preview_") === 0);
};

const previewDebug = (_event, _details) => {};

/**
		* Handles managing adding & removing Annotations
	* @param {Rendition} rendition
	* @class
	*/
class Annotations {

	constructor (rendition) {
		this.rendition = rendition;
		this.highlights = [];
		this.underlines = [];
		this.marks = [];
		this._annotations = {};
		this._annotationsBySectionIndex = {};

		this.rendition.hooks.render.register(this.inject.bind(this));
		this.rendition.hooks.unloaded.register(this.clear.bind(this));
	}

	/**
	 * Add an annotation to store
	 * @param {string} type Type of annotation to add: "highlight", "underline", "mark"
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} [cb] Callback after annotation is added
	 * @param {string} className CSS class to assign to annotation
	 * @param {object} styles CSS styles to assign to annotation
	 * @returns {Annotation} annotation
	 */
	add (type, cfiRange, data, cb, className, styles) {
		const isPreview = isCustomSelectionPreviewData(data);
		let annotationKey = data && (data.__annotationKey || data.annotationKey);
		let hash = encodeURI(annotationKey || (cfiRange + type));
		let cfi = new EpubCFI(cfiRange);
		let sectionIndex = cfi.spinePos;
		if (isPreview) {
			previewDebug("add:start", {
				type,
				cfiRange,
				id: data && data.id,
				hash,
				sectionIndex,
				existingHash: !!this._annotations[hash]
			});
		}
		let annotation = new Annotation({
			type,
			cfiRange,
			data,
			sectionIndex,
			cb,
			className,
			styles
		});

		this._annotations[hash] = annotation;

		if (sectionIndex in this._annotationsBySectionIndex) {
			this._annotationsBySectionIndex[sectionIndex].push(hash);
		} else {
			this._annotationsBySectionIndex[sectionIndex] = [hash];
		}

		let views = this.rendition.views();
		if (isPreview) {
			previewDebug("add:stored", {
				hash,
				totalAnnotations: Object.keys(this._annotations).length,
				sectionAnnotationCount: (this._annotationsBySectionIndex[sectionIndex] || []).length,
				viewCount: views.length
			});
		}

		views.forEach( (view) => {
			if (annotation.sectionIndex === view.index) {
				if (isPreview) {
					previewDebug("add:attach-to-view", {
						hash,
						viewIndex: view.index,
						viewSectionIndex: annotation.sectionIndex
					});
				}
				annotation.attach(view);
			}
		});

		return annotation;
	}

	/**
	 * Remove an annotation from store
	 * @param {EpubCFI} cfiRange EpubCFI range the annotation is attached to
	 * @param {string} type Type of annotation to add: "highlight", "underline", "mark"
	 */
	remove (cfiRange, type) {
		let hash = encodeURI(cfiRange + type);

		if (hash in this._annotations) {
			let annotation = this._annotations[hash];

			if (type && annotation.type !== type) {
				return;
			}

			let views = this.rendition.views();
			views.forEach( (view) => {
				this._removeFromAnnotationBySectionIndex(annotation.sectionIndex, hash);
				if (annotation.sectionIndex === view.index) {
					annotation.detach(view);
				}
			});

			delete this._annotations[hash];
		}
	}

	/**
	 * Remove annotations by matching data field
	 * @param {string} fieldName Name of the data field to match
	 * @param {any} fieldValue Value to match in the specified field
	 */
	removeByData(fieldName, fieldValue) {
		const isPreviewRemoval = fieldName === "id" && typeof fieldValue === "string" &&
			fieldValue.indexOf("__custom_selection_preview_") === 0;
		let removedCount = 0;
		let views = this.rendition.views();
		if (isPreviewRemoval) {
			previewDebug("removeByData:start", {
				fieldName,
				fieldValue,
				totalAnnotations: Object.keys(this._annotations).length
			});
		}
		Object.keys(this._annotations).forEach(hash => {
			const annotation = this._annotations[hash];
			if (annotation.data && annotation.data[fieldName] === fieldValue) {
				removedCount += 1;
				views.forEach(view => {
					this._removeFromAnnotationBySectionIndex(annotation.sectionIndex, hash);
					if (annotation.sectionIndex === view.index) {
						if (isPreviewRemoval) {
							previewDebug("removeByData:detach", {
								hash,
								viewIndex: view.index,
								sectionIndex: annotation.sectionIndex
							});
						}
						annotation.detach(view);
					}
				});
				delete this._annotations[hash];
			}
		});
		views.forEach((view) => {
			if (view && typeof view.removeAnnotationsByData === "function") {
				view.removeAnnotationsByData(fieldName, fieldValue);
			}
		});
		if (isPreviewRemoval) {
			previewDebug("removeByData:end", {
				fieldValue,
				removedCount,
				totalAnnotations: Object.keys(this._annotations).length
			});
		}
	}

	/**
	 * Remove an annotations by Section Index
	 * @private
	 */
	_removeFromAnnotationBySectionIndex (sectionIndex, hash) {
		this._annotationsBySectionIndex[sectionIndex] = this._annotationsAt(sectionIndex).filter(h => h !== hash);
	}

	/**
	 * Get annotations by Section Index
	 * @private
	 */
	_annotationsAt (index) {
		return this._annotationsBySectionIndex[index];
	}


	/**
	 * Add a highlight to the store
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} cb Callback after annotation is clicked
	 * @param {string} className CSS class to assign to annotation
	 * @param {object} styles CSS styles to assign to annotation
	 */
	highlight (cfiRange, data, cb, className, styles) {
		return this.add("highlight", cfiRange, data, cb, className, styles);
	}

	/**
	 * Add a underline to the store
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} cb Callback after annotation is clicked
	 * @param {string} className CSS class to assign to annotation
	 * @param {object} styles CSS styles to assign to annotation
	 */
	underline (cfiRange, data, cb, className, styles) {
		return this.add("underline", cfiRange, data, cb, className, styles);
	}

	/**
	 * Add a mark to the store
	 * @param {EpubCFI} cfiRange EpubCFI range to attach annotation to
	 * @param {object} data Data to assign to annotation
	 * @param {function} cb Callback after annotation is clicked
	 */
	mark (cfiRange, data, cb) {
		return this.add("mark", cfiRange, data, cb);
	}

	/**
	 * iterate over annotations in the store
	 */
	each () {
		return this._annotations.forEach.apply(this._annotations, arguments);
	}

	/**
	 * Hook for injecting annotation into a view
	 * @param {View} view
	 * @private
	 */
	inject (view) {
		let sectionIndex = view.index;
		if (sectionIndex in this._annotationsBySectionIndex) {
			let annotations = this._annotationsBySectionIndex[sectionIndex];
			const previewCount = annotations.filter((hash) => {
				const annotation = this._annotations[hash];
				return annotation && isCustomSelectionPreviewData(annotation.data);
			}).length;
			if (previewCount > 0) {
				previewDebug("inject:view", {
					viewIndex: view.index,
					sectionIndex,
					totalForSection: annotations.length,
					previewCount
				});
			}
			annotations.forEach((hash) => {
				let annotation = this._annotations[hash];
				annotation.attach(view);
			});
		}
	}

	/**
	 * Hook for removing annotation from a view
	 * @param {View} view
	 * @private
	 */
	clear (view) {
		let sectionIndex = view.index;
		if (sectionIndex in this._annotationsBySectionIndex) {
			let annotations = this._annotationsBySectionIndex[sectionIndex];
			const previewCount = annotations.filter((hash) => {
				const annotation = this._annotations[hash];
				return annotation && isCustomSelectionPreviewData(annotation.data);
			}).length;
			if (previewCount > 0) {
				previewDebug("clear:view", {
					viewIndex: view.index,
					sectionIndex,
					totalForSection: annotations.length,
					previewCount
				});
			}
			annotations.forEach((hash) => {
				let annotation = this._annotations[hash];
				annotation.detach(view);
			});
		}
	}

	/**
	 * [Not Implemented] Show annotations
	 * @TODO: needs implementation in View
	 */
	show () {

	}

	/**
	 * [Not Implemented] Hide annotations
	 * @TODO: needs implementation in View
	 */
	hide () {

	}

}

/**
 * Annotation object
 * @class
 * @param {object} options
 * @param {string} options.type Type of annotation to add: "highlight", "underline", "mark"
 * @param {EpubCFI} options.cfiRange EpubCFI range to attach annotation to
 * @param {object} options.data Data to assign to annotation
 * @param {int} options.sectionIndex Index in the Spine of the Section annotation belongs to
 * @param {function} [options.cb] Callback after annotation is clicked
 * @param {string} className CSS class to assign to annotation
 * @param {object} styles CSS styles to assign to annotation
 * @returns {Annotation} annotation
 */
class Annotation {

	constructor ({
		type,
		cfiRange,
		data,
		sectionIndex,
		cb,
		className,
		styles
	}) {
		this.type = type;
		this.cfiRange = cfiRange;
		this.data = data;
		this.sectionIndex = sectionIndex;
		this.mark = undefined;
		this.cb = cb;
		this.className = className;
		this.styles = styles;
	}

	/**
	 * Update stored data
	 * @param {object} data
	 */
	update (data) {
		this.data = data;
	}

	/**
	 * Add to a view
	 * @param {View} view
	 */
	attach (view) {
		let {cfiRange, data, type, mark, cb, className, styles} = this;
		let result;
		const isPreview = isCustomSelectionPreviewData(data);
		if (isPreview) {
			previewDebug("annotation.attach:start", {
				type,
				id: data && data.id,
				cfiRange,
				viewIndex: view && view.index
			});
		}

		if (type === "highlight") {
			result = view.highlight(cfiRange, data, cb, className, styles);
		} else if (type === "underline") {
			result = view.underline(cfiRange, data, cb, className, styles);
		} else if (type === "mark") {
			result = view.mark(cfiRange, data, cb);
		}

		this.mark = result;
		if (isPreview) {
			previewDebug("annotation.attach:end", {
				type,
				id: data && data.id,
				cfiRange,
				viewIndex: view && view.index,
				hasMark: !!result
			});
		}
		this.emit(EVENTS.ANNOTATION.ATTACH, result);
		return result;
	}

	/**
	 * Remove from a view
	 * @param {View} view
	 */
	detach (view) {
		let {cfiRange, type} = this;
		let result;
		const isPreview = isCustomSelectionPreviewData(this.data);
		if (isPreview) {
			previewDebug("annotation.detach:start", {
				type,
				id: this.data && this.data.id,
				cfiRange,
				viewIndex: view && view.index
			});
		}

		if (view) {
			if (type === "highlight") {
				if (isPreview && this.data && this.data.id) {
					result = view.unhighlight(cfiRange, this.data.id);
				} else {
					result = view.unhighlight(cfiRange);
				}
			} else if (type === "underline") {
				result = view.ununderline(cfiRange);
			} else if (type === "mark") {
				result = view.unmark(cfiRange);
			}
		}

		this.mark = undefined;
		if (isPreview) {
			previewDebug("annotation.detach:end", {
				type,
				id: this.data && this.data.id,
				cfiRange,
				viewIndex: view && view.index,
				resultType: typeof result
			});
		}
		this.emit(EVENTS.ANNOTATION.DETACH, result);
		return result;
	}

	/**
	 * [Not Implemented] Get text of an annotation
	 * @TODO: needs implementation in contents
	 */
	text () {

	}

}

EventEmitter(Annotation.prototype);


export default Annotations
