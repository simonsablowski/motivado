import { describe as suite, expect, it } from 'vitest';
import { begin, advance, answer } from '@motivado/engine';
import { convert } from '../src/convert';
import { describe } from '../src/describe';
import { parseXpdl } from '../src/xpdl';

suite('describe()', () => {
  it('splits type, key, properties and text', () => {
    const d = describe('Vorher $Video:intro("video":{"url":"a.flv"}) Danach');
    expect(d).toEqual({ type: 'Video', key: 'intro', properties: '{"video":{"url":"a.flv"}}', text: 'Danach' });
  });

  it('works without key and text', () => {
    expect(describe('$Text()')).toMatchObject({ type: 'Text', key: null, properties: '{}', text: null });
  });

  it('returns nothing for plain text', () => {
    expect(describe('Nur Text')).toMatchObject({ type: null, properties: null });
  });
});

const activity = (id: string, name: string, inner: string, desc = '') =>
  `<Activity Id="${id}" Name="${name}"><Description>${desc}</Description>${inner}</Activity>`;
const manual = '<Implementation><Task><TaskManual/></Task></Implementation>';
const reference = '<Implementation><Task><TaskReference/></Task></Implementation>';
const optionTask = '<Implementation><Task><TaskUser/></Task></Implementation>';
const tr = (from: string, to: string, name = '') => `<Transition Id="${from}-${to}" From="${from}" To="${to}" Name="${name}"/>`;

const xpdl = `<?xml version="1.0"?>
<Package xmlns="http://www.wfmc.org/2008/XPDL2.1" Id="p" Name="demo">
 <WorkflowProcesses>
  <WorkflowProcess Id="w" Name="Main">
   <Activities>
    ${activity('s', '', '<Event><StartEvent/></Event>')}
    ${activity('hello', 'Hallo', manual, '$Text:hello() Willkommen')}
    ${activity('q', 'Wie geht es?', reference, '$Options:stimmung()')}
    ${activity('gut', 'Gut', optionTask)}
    ${activity('schlecht', 'Schlecht', optionTask)}
    ${activity('split', '', '<Route GatewayType="Exclusive"/>')}
    ${activity('froh', 'Freut mich', manual, '$Text()')}
    ${activity('block', 'Block', '<BlockActivity ActivitySetId="set1"/>')}
    ${activity('bye', 'Tschüss', manual, '$Text()')}
    ${activity('e', '', '<Event><EndEvent/></Event>')}
   </Activities>
   <ActivitySets>
    <ActivitySet Id="set1">
     <Activities>
      ${activity('ss', '', '<Event><StartEvent/></Event>')}
      ${activity('inner', 'Innen', manual, '$Text()')}
      ${activity('se', '', '<Event><EndEvent/></Event>')}
     </Activities>
     <Transitions>${tr('ss', 'inner')}${tr('inner', 'se')}</Transitions>
    </ActivitySet>
   </ActivitySets>
   <Transitions>
    ${tr('s', 'hello')}${tr('hello', 'q')}
    ${tr('q', 'gut')}${tr('q', 'schlecht')}
    ${tr('gut', 'split')}
    ${tr('schlecht', 'block')}
    ${tr('split', 'froh', 'x is 1')}
    ${tr('froh', 'bye')}${tr('block', 'bye')}${tr('bye', 'e')}
   </Transitions>
  </WorkflowProcess>
 </WorkflowProcesses>
</Package>`;

suite('convert()', () => {
  const { coaching, ok, issues } = convert(parseXpdl(xpdl), 'demo-test');

  it('produces a valid graph', () => {
    expect(issues).toEqual([]);
    expect(ok).toBe(true);
    expect(coaching.domain).toBe('demo');
    expect(Object.keys(coaching.nodes)).toHaveLength(5);
  });

  it('turns choices into conditional edges and flattens gateways and sets', () => {
    const question = Object.values(coaching.nodes).find((n) => n.type === 'Options');
    expect(question?.key).toBe('stimmung');
    expect(question?.props.options).toEqual([
      { key: 1, value: 'Gut' },
      { key: 2, value: 'Schlecht' },
    ]);
    expect(question?.next.map((e) => e.if)).toEqual(['x is 1 and stimmung is 1', 'stimmung is 2']);
  });

  it('is playable by the engine', () => {
    let pos = begin(coaching);
    pos = advance(coaching, pos.session); // hello -> question
    const withAnswer = answer(pos.session, 'stimmung', { value: 2 });
    pos = advance(coaching, withAnswer); // -> inner (through the set)
    expect(pos.step).toMatchObject({ kind: 'node', node: { title: 'Innen' } });
    pos = advance(coaching, pos.session);
    expect(pos.step).toMatchObject({ kind: 'node', node: { title: 'Tschüss' } });
    expect(advance(coaching, pos.session).step.kind).toBe('end');
  });
});
