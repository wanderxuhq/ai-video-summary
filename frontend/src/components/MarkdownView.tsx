import { Component } from 'solid-js';

interface MarkdownViewProps {
  htmlContent: string;
}

const MarkdownView: Component<MarkdownViewProps> = (props) => {
  return <div innerHTML={props.htmlContent} />;
};

export default MarkdownView;
