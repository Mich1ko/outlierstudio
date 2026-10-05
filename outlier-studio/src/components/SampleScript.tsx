import { ScriptStage } from './ScriptStage';

/** A made-up script shown on public pages so visitors can see the output format. */
const SAMPLE = `HOOK
Your coffee is not bitter because of the beans.

BODY
It is bitter because your water is too hot.
Boiling water pulls out the harsh stuff in the first ten seconds.
So here is what I do instead.
I boil the kettle, then I wait one minute.
That is it. One minute.
Same beans, same grinder, same cup.
And the bitterness is just gone.

CALL TO ACTION
Try it tomorrow morning and tell me if I am wrong.`;

export function SampleScript() {
  return <ScriptStage text={SAMPLE} status="Example script" />;
}
