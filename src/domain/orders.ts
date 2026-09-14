import type { OrderPreset } from './types';

export const FRAME_ORDERS: OrderPreset[] = [
  {
    id: 'decompose',
    title: 'Decompose',
    prompt: 'Decompose this input into the smallest meaningful structural parts that materially improve understanding. Preserve hierarchy where it exists. Do not split merely for more detail. Return explicit proposed parts and their relationship to the parent.'
  },
  {
    id: 'move-up',
    title: 'Move Up',
    prompt: 'Move exactly one meaningful abstraction level upward. Identify the most defensible parent structure that contains this input. Explain the containment relationship briefly. If several parents are plausible, preserve them as alternatives rather than forcing one.'
  },
  {
    id: 'move-down',
    title: 'Move Down',
    prompt: 'Move exactly one meaningful abstraction level downward. Identify the direct substructures, categories, mechanisms, or instances that belong immediately beneath this input. Do not skip levels unless the intermediate level has no useful structural meaning.'
  },
  {
    id: 'challenge-assumptions',
    title: 'Challenge Assumptions',
    prompt: 'Identify the assumptions required for this input to hold. Separate explicit assumptions from hidden assumptions. For each important assumption, state the strongest plausible alternative. Do not resolve uncertainty unless the input supports resolution.'
  },
  {
    id: 'reframe',
    title: 'Reframe',
    prompt: 'Reframe this input by changing one meaningful structural dimension such as observer, objective, abstraction level, timeframe, causal direction, system boundary, stakeholder, fixed variable, or comparison class. Return the changed frame and what becomes newly visible because of it.'
  },
  {
    id: 'find-missing-structure',
    title: 'Find Missing Structure',
    prompt: 'Inspect this input for missing structure. Look for omitted causes, stakeholders, assumptions, alternatives, evidence requirements, contradictions, dependencies, variables, consequences, abstraction levels, parent categories, or subcategories. Return only omissions that could materially change understanding.'
  },
  {
    id: 'validate-structure',
    title: 'Validate Structure',
    prompt: 'Validate the structure represented by this input. Identify unsupported claims, category mistakes, hidden assumptions, causal leaps, contradictions, missing dependencies, false certainty, or conclusions that do not follow. Return explicit issues and preserve unresolved questions.'
  }
];
