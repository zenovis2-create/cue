import { createHash } from 'node:crypto';
import { types } from 'node:util';

const sha = value => createHash('sha256').update(value).digest('hex');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u.test(value);
const fields = (value, names) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('goal_proposal_record');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== names.length || names.some(name => !descriptors[name]?.enumerable || !Object.hasOwn(descriptors[name], 'value'))) throw Error('goal_proposal_fields');
  return Object.fromEntries(names.map(name => [name, descriptors[name].value]));
};
function snapshot(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 8192 || depth > 16) throw Error('goal_proposal_bounds');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw Error('goal_proposal_data');
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) throw Error('goal_proposal_data');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length > 1024 || keys.some(key => typeof key !== 'string' || (!array || key !== 'length') && (!descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value')))) throw Error('goal_proposal_data');
  if (array) {
    if (value.length > 256 || keys.length !== value.length + 1) throw Error('goal_proposal_bounds');
    return Object.freeze(Array.from({ length: value.length }, (_, index) => {
      const descriptor = descriptors[String(index)];
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('goal_proposal_data');
      return snapshot(descriptor.value, depth + 1, budget);
    }));
  }
  return Object.freeze(Object.fromEntries(keys.sort().map(key => [key, snapshot(descriptors[key].value, depth + 1, budget)])));
}

/** A planner artifact is data. Only the protected host registry can supply checker code. */
export function captureGoalProposal(goal, ref, input) {
  if (typeof goal !== 'string' || !goal.trim() || Buffer.byteLength(goal) > 16384) throw Error('goal_proposal_goal');
  const body = snapshot(input);
  const value = fields(body, ['version', 'goalSha256', 'plan', 'requirements', 'instructions', 'changeTargets']);
  if (value.version !== 'cue-goal-proposal-v1' || value.goalSha256 !== sha(goal)) throw Error('goal_proposal_goal_mismatch');
  const plan = fields(value.plan, ['policyRevision', 'policyDigest', 'tasks']);
  if (!id(plan.policyRevision) || !hex(plan.policyDigest) || !Array.isArray(plan.tasks) || plan.tasks.length < 2 || plan.tasks.length > 256) throw Error('goal_proposal_plan');
  if (!Array.isArray(value.requirements) || value.requirements.length < 1 || value.requirements.length > 256 || !Array.isArray(value.instructions) || value.instructions.length !== plan.tasks.length) throw Error('goal_proposal_bounds');
  const taskIds = plan.tasks.map(task => fields(task, ['id', 'role', 'ownerId', 'requirementIds', 'dependencyIds', 'candidateIds', 'scopeIds']).id);
  if (taskIds.some(taskId => !id(taskId)) || new Set(taskIds).size !== taskIds.length) throw Error('goal_proposal_plan');
  const instructions = value.instructions.map(item => {
    const instruction = fields(item, ['taskId', 'text']);
    if (!id(instruction.taskId) || typeof instruction.text !== 'string' || !instruction.text.trim() || Buffer.byteLength(instruction.text) > 16384 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(instruction.text)) throw Error('goal_proposal_instruction');
    return instruction;
  });
  if (new Set(instructions.map(item => item.taskId)).size !== taskIds.length || instructions.some(item => !taskIds.includes(item.taskId))) throw Error('goal_proposal_instruction_coverage');
  if (!Array.isArray(value.changeTargets) || value.changeTargets.length > 64) throw Error('goal_proposal_targets');
  const bytes = JSON.stringify(body);
  if (Buffer.byteLength(bytes) > 1_048_576) throw Error('goal_proposal_bounds');
  const digest = sha(bytes), expectedRef = `goal-proposal:${digest}`;
  if (ref !== expectedRef) throw Error('goal_proposal_ref_mismatch');
  const requirements = value.requirements, requirementIds = requirements.map(item => fields(item, ['id', 'text', 'kind', 'required', 'checks']).id);
  if (requirementIds.some(item => !id(item)) || new Set(requirementIds).size !== requirementIds.length) throw Error('goal_proposal_requirements');
  return Object.freeze({ ref: expectedRef, digest, bytes, body, proposedPlan: Object.freeze({ revision: `proposal-${digest}`, policyRevision: plan.policyRevision, policyDigest: plan.policyDigest, tasks: plan.tasks }), requirements, requirementIds: Object.freeze(requirementIds), instructions: Object.freeze(instructions), changeTargets: value.changeTargets });
}

export function bindGoalProposal(db, input) {
  if (!db.inTransaction) throw Error('goal_proposal_transaction_required');
  const { runId, taskId, captured, now } = input;
  const rows = db.prepare("SELECT id,content FROM artifact WHERE run_id=? AND kind='goal_proposal_v1'").all(runId);
  if (rows.length) throw Error('goal_proposal_replay_conflict');
  db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId, runId, 'goal_proposal_v1', captured.bytes, new Date(now).toISOString());
}

export function readBoundGoalProposal(db, runId, expectedPlanDigest) {
  const rows = db.prepare("SELECT task_id,content FROM artifact WHERE run_id=? AND kind='goal_proposal_v1'").all(runId);
  const run=db.prepare('SELECT task_id,envelope_hash FROM run WHERE id=?').get(runId);
  if (rows.length !== 1 || typeof rows[0].content !== 'string'||!run||rows[0].task_id!==run.task_id) throw Error('goal_proposal_missing');
  const plan = db.prepare('SELECT digest,payload FROM orchestration_plan WHERE run_id=?').get(runId);
  const goal = db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='goal' ORDER BY id LIMIT 2").all(runId);
  if (!plan || plan.digest !== expectedPlanDigest || goal.length !== 1) throw Error('goal_proposal_binding');
  const digest = sha(rows[0].content), captured = captureGoalProposal(goal[0].content, `goal-proposal:${digest}`, JSON.parse(rows[0].content));
  if (captured.bytes !== rows[0].content || JSON.parse(plan.payload).revision !== `proposal-${digest}`) throw Error('goal_proposal_binding');
  return captured;
}

export function readGoalTaskInstruction(db, runId, planDigest, taskId) {
  const captured = readBoundGoalProposal(db, runId, planDigest);
  const instruction = captured.instructions.find(item => item.taskId === taskId);
  if (!instruction) throw Error('goal_proposal_task_missing');
  return Object.freeze({ runId, planDigest, taskId, proposalRef: captured.ref, text: instruction.text });
}
