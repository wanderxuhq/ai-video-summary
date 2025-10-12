import { Component, onCleanup, createEffect } from 'solid-js';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { zoomTransform } from 'd3-zoom';
import type { ZoomTransform } from 'd3-zoom';

interface MindmapViewProps {
  markdown: string;
  isVisible: boolean;
}

const MindmapView: Component<MindmapViewProps> = (props) => {
  let svgRef: SVGSVGElement | undefined;
  let markmap: Markmap | undefined;
  const transformer = new Transformer();
  let lastRenderedMarkdown: string | undefined;
  let savedTransform: ZoomTransform | undefined;

  onCleanup(() => {
    markmap?.destroy();
  });

  createEffect((prevIsVisible) => {
    const { isVisible, markdown } = props;

    if (!svgRef || !markdown) {
      return isVisible;
    }

    const justBecameVisible = isVisible && !prevIsVisible;
    const justBecameHidden = !isVisible && prevIsVisible;
    const contentChanged = markdown !== lastRenderedMarkdown;

    // When the component is about to be hidden, we save the current zoom/pan state.
    if (justBecameHidden && markmap) {
      savedTransform = zoomTransform(markmap.g.node() as SVGGElement);
    }

    // We only perform actions when the component is supposed to be visible.
    if (isVisible) {
      if (!markmap) {
        // First time rendering: create the markmap instance.
        const { root } = transformer.transform(markdown);
        markmap = Markmap.create(svgRef, { autoFit: false }, root);
        lastRenderedMarkdown = markdown;
      } else if (contentChanged) {
        // Content has changed: update the data and reset the view.
        const { root } = transformer.transform(markdown);
        markmap.setData(root);
        markmap.fit();
        lastRenderedMarkdown = markdown;
        savedTransform = undefined; // The old state is now invalid.
      } else if (justBecameVisible && savedTransform) {
        // Became visible again with the same content: RESTORE THE SAVED STATE.
        // We use setTimeout to ensure this command runs after the browser has finished
        // its rendering and layout calculations, guaranteeing the restore operation works.
        setTimeout(() => {
          if (markmap && savedTransform) {
            markmap.zoom.transform(markmap.svg, savedTransform);
          }
        }, 0);
      }
    }

    // Return the current visibility so we can detect changes in the next run.
    return isVisible;
  }, false); // The initial "previous" visibility is false.

  return <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />;
};

export default MindmapView;
