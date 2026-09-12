'use client';

/**
 * AppShell Component
 *
 * The sidebar + main content frame shared by the hub pages. The sidebar is
 * fixed and taken out of flow, so the main column reserves its width with a
 * matching left margin rather than sitting beside it as a flex item.
 *
 * Overlays (modals, toasts) stay siblings of AppShell.Main inside the root,
 * exactly where they were before this was extracted.
 */

export default function AppShell({ sidebar, sidebarClassName = '', children }) {
  return (
    <div className="h-screen bg-gray-50 flex">
      <div
        className={`hidden md:flex w-64 text-white flex-col fixed left-0 top-0 shadow-lg z-40 ${sidebarClassName}`.trim()}
        style={{
          background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
          height: '100vh',
          overflowY: 'hidden'
        }}
      >
        {sidebar}
      </div>
      {children}
    </div>
  );
}

AppShell.Main = function AppShellMain({ className = '', children }) {
  return (
    <div className={`ml-0 md:ml-64 flex-1 flex flex-col h-screen overflow-hidden ${className}`.trim()}>
      {children}
    </div>
  );
};
