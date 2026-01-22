import cx from '@src/cx.mjs';
import { setActiveFooter as setTab, setIsPanelOpened, useSettings } from '../../../settings.mjs';
import { ConsoleTab } from './ConsoleTab';
import { FilesTab } from './FilesTab';
import { Reference } from './Reference';
import { SettingsTab } from './SettingsTab';
import { SoundsTab } from './SoundsTab';
import { useLogger } from '../useLogger';
import { WelcomeTab } from './WelcomeTab';
import { PatternsTab } from './PatternsTab';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/16/solid';
import ExportTab from './ExportTab';

const TAURI = typeof window !== 'undefined' && window.__TAURI__;

function PanelCloseButton() {
  const { isPanelOpen } = useSettings();
  return (
    isPanelOpen && (
      <button
        onClick={() => setIsPanelOpened(false)}
        className={cx('px-4 py-2 text-foreground hover:opacity-50')}
        aria-label="Close Menu"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>
    )
  );
}

export function HorizontalPanel({ context }) {
  const { isPanelOpen, activeFooter: tab } = useSettings();
  return (
    <PanelNav
      className={cx(
        isPanelOpen ? `min-h-[360px] max-h-[360px]` : 'min-h-10 max-h-10',
        'overflow-hidden flex flex-col relative ',
      )}
    >
      <div className="flex justify-between min-h-10 max-h-10 grid-cols-2 items-center">
        <Tabs setTab={setTab} tab={tab} />
        <PanelCloseButton />
      </div>
      {isPanelOpen && (
        <div className="flex h-full overflow-auto w-full">
          <PanelContent context={context} tab={tab} />
        </div>
      )}
    </PanelNav>
  );
}

export function VerticalPanel({ context }) {
  const settings = useSettings();
  const { activeFooter: tab, isPanelOpen } = settings;
  if (!isPanelOpen) {
    return;
  }
  return (
    <PanelNav
      settings={settings}
      className={cx(isPanelOpen ? `min-w-[min(600px,100vw)] max-w-[min(600px,80vw)]` : 'min-w-12 max-w-12')}
    >
      <div className={cx('flex flex-col h-full')}>
        <div className="flex justify-between w-full ">
          <Tabs setTab={setTab} tab={tab} />
          <PanelCloseButton />
        </div>

        <div className="overflow-auto h-full">
          <PanelContent context={context} tab={tab} />
        </div>
      </div>
    </PanelNav>
  );
}

const tabNames = {
  welcome: 'intro',
  patterns: 'patterns',
  sounds: 'sounds',
  reference: 'reference',
  export: 'export',
  console: 'console',
  settings: 'settings',
};
if (TAURI) {
  tabNames.files = 'files';
}

function PanelNav({ children, className, ...props }) {
  const settings = useSettings();
  return (
    <nav
      onClick={() => {
        if (!settings.isPanelOpen) {
          setIsPanelOpened(true);
        }
      }}
      aria-label="Menu Panel"
      className={cx('bg-lineHighlight group overflow-x-auto', className)}
      {...props}
    >
      {children}
    </nav>
  );
}

function PanelContent({ context, tab }) {
  useLogger();
  switch (tab) {
    case tabNames.patterns:
      return <PatternsTab context={context} />;
    case tabNames.console:
      return <ConsoleTab />;
    case tabNames.sounds:
      return <SoundsTab />;
    case tabNames.reference:
      return <Reference />;
    case tabNames.export:
      return <ExportTab handleExport={context.handleExport} />;
    case tabNames.settings:
      return <SettingsTab started={context.started} />;
    case tabNames.files:
      return <FilesTab />;
    default:
      return <WelcomeTab context={context} />;
  }
}

function PanelTab({ label, isSelected, onClick }) {
  return (
    <>
      <button
        onClick={onClick}
        className={cx(
          'h-8 px-2 text-sm text-foreground cursor-pointer hover:opacity-50 flex items-center space-x-1 border-b',
          isSelected ? 'border-foreground' : 'border-transparent',
        )}
      >
        {label}
      </button>
    </>
  );
}
function Tabs({ className }) {
  const { isPanelOpen, activeFooter: tab } = useSettings();
  return (
    <div className={cx('flex select-none max-w-full overflow-auto items-center', className)}>
      {Object.keys(tabNames).map((key) => {
        const val = tabNames[key];
        return <PanelTab key={key} isSelected={tab === val && isPanelOpen} label={key} onClick={() => setTab(val)} />;
      })}
    </div>
  );
}

export function PanelToggle({ isEmbedded, isZen }) {
  const { panelPosition, isPanelOpen } = useSettings();
  return (
    !isEmbedded &&
    !isZen &&
    panelPosition === 'right' && (
      <button
        title="share"
        className={cx(
          'absolute top-0 right-3  rounded-0  px-2 py-2 bg-background z-[1000] cursor-pointer hover:opacity-80 flex justify-center items-center space-x-1 text-foreground ',
          isPanelOpen && 'hidden',
        )}
        onClick={() => setIsPanelOpened(!isPanelOpen)}
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
    )
  );
}
