import { Component } from 'solid-js';

interface MarkdownSourceViewProps {
  markdown: string;
}

const MarkdownSourceView: Component<MarkdownSourceViewProps> = (props) => {
  return (
    <pre style={{ 'white-space': 'pre-wrap', 'word-wrap': 'break-word' }}>
      {props.markdown}
    </pre>
  );
};

export default MarkdownSourceView;
