import Loader from '@src/repl/components/Loader';
import { HorizontalPanel, VerticalPanel, PanelToggle } from '@src/repl/components/panel/Panel';
import { Code } from '@src/repl/components/Code';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { Header } from './Header';
import { useSettings } from '@src/settings.mjs';

// type Props = {
//  context: replcontext,
// }

export default function ReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { containerRef, editorRef, error, init, pending } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;
  const isEmbedded = typeof window !== 'undefined' && window.location !== window.parent.location;

  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      <Header context={context} isEmbedded={isEmbedded} />

      <div className="grow flex relative overflow-hidden">
        <Code containerRef={containerRef} editorRef={editorRef} init={init} />
        {!isZen && panelPosition === 'right' && <VerticalPanel context={context} />}
        <PanelToggle isEmbedded={isEmbedded} isZen={isZen} />
      </div>
      <UserFacingErrorMessage error={error} />
      {!isZen && panelPosition === 'bottom' && <HorizontalPanel context={context} />}
    </div>
  );
}
