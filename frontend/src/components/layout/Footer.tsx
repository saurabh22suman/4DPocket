import { version } from "../../../package.json";

export function Footer() {
  return (
    <footer className="workspace-footer">
      <span>4DPocket v{version}</span>
      <div className="workspace-footer__links">
        <a href="https://onllm.dev" target="_blank" rel="noopener noreferrer">onllm.dev</a>
        <a href="https://github.com/onllm-dev/4DPocket" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
        <a href="https://buymeacoffee.com/prakersh" target="_blank" rel="noopener noreferrer">Support</a>
      </div>
    </footer>
  );
}
