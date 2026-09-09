import { readFileSync } from 'node:fs';

export type RouteDecision = { state: 'dispatch'; tool: string } | { state: 'ask_me' };
type Rule = { match: string; tool: string };

export function parseRoutingYaml(text: string): Rule[] {
  const rules: Rule[] = []; let current: Partial<Rule> = {};
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '').trim(); if (!line || line === 'rules:') continue;
    const match = line.match(/^-\s*match:\s*["']?([^"']+?)["']?$/u); if (match) { if (current.match || current.tool) throw new Error('incomplete rule'); current.match = match[1].trim(); continue; }
    const tool = line.match(/^tool:\s*["']?([\w-]+)["']?$/u); if (tool && current.match) { current.tool = tool[1]; rules.push(current as Rule); current = {}; continue; }
    throw new Error('invalid routing yaml');
  }
  if (current.match || current.tool) throw new Error('incomplete rule');
  return rules;
}

export function routeTask(path: string, task: string): RouteDecision {
  try {
    const matches = parseRoutingYaml(readFileSync(path, 'utf8')).filter(rule => new RegExp(rule.match, 'iu').test(task));
    if (matches.length === 0) return { state: 'ask_me' };
    const tools = [...new Set(matches.map(rule => rule.tool))];
    if (tools.length !== 1) return { state: 'ask_me' };
    return { state: 'dispatch', tool: tools[0] };
  } catch { return { state: 'ask_me' }; }
}
