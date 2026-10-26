/**
 * A shell command that wraps only between words. Browsers also break at
 * hyphens, which split `viberank-cli` and the MCP line's `--` across lines in
 * the narrow modal, so a command copied by eye read wrong. The text content
 * is unchanged, so selecting it still copies the real command.
 */
export default function CommandText({ command }: { command: string }) {
  const words = command.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <span className="whitespace-nowrap">{word}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
