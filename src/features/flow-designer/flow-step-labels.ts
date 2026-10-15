interface FlowConnection {
  source: string;
  target: string;
}

function branchLetter(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function flowStepLabels(nodeIds: string[], edges: FlowConnection[]): Map<string, string> {
  const orderedIds = [...new Set(nodeIds)];
  const outgoing = new Map(orderedIds.map((id) => [id, new Set<string>()]));
  const incomingCount = new Map(orderedIds.map((id) => [id, 0]));
  const level = new Map(orderedIds.map((id) => [id, 1]));

  for (const { source, target } of edges) {
    const targets = outgoing.get(source);
    if (!targets || !incomingCount.has(target) || source === target || targets.has(target)) continue;
    targets.add(target);
    incomingCount.set(target, incomingCount.get(target)! + 1);
  }

  const ready = orderedIds.filter((id) => incomingCount.get(id) === 0);
  for (let index = 0; index < ready.length; index += 1) {
    const source = ready[index];
    for (const target of outgoing.get(source)!) {
      level.set(target, Math.max(level.get(target)!, level.get(source)! + 1));
      const remaining = incomingCount.get(target)! - 1;
      incomingCount.set(target, remaining);
      if (remaining === 0) ready.push(target);
    }
  }

  const levels = new Map<number, string[]>();
  for (const id of orderedIds) {
    if (incomingCount.get(id) !== 0) continue;
    const step = level.get(id)!;
    levels.set(step, [...(levels.get(step) || []), id]);
  }

  const labels = new Map<string, string>();
  for (const [step, ids] of levels) {
    ids.forEach((id, index) => {
      labels.set(id, `Step ${step}${ids.length > 1 ? branchLetter(index) : ''}`);
    });
  }
  for (const id of orderedIds) {
    if (!labels.has(id)) labels.set(id, 'Step ?');
  }
  return labels;
}
