// Earlier turns sent with a new question. A question whose answer failed has
// no reply, so only answered questions are kept and turns always alternate,
// starting with the student and ending with the assistant.
export function answeredTurns<T extends { role: string }>(messages: T[]): T[] {
  const turns: T[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      if (turns.at(-1)?.role === "user") turns.pop();
      turns.push(message);
    } else if (turns.at(-1)?.role === "user") {
      turns.push(message);
    }
  }
  if (turns.at(-1)?.role === "user") turns.pop();
  return turns;
}
