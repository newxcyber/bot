import React, { useCallback, useEffect, useState } from 'react';
import { useSettings } from '~/lib/hooks/useSettings';
import commit from '~/commit.json';

const versionHash = commit.commit; // Get the version hash from commit.json

export default function DebugTab() {
  const { providers } = useSettings();
  const [activeProviders, setActiveProviders] = useState<string[]>([]);
  const [updateMessage, setUpdateMessage] = useState<string>('');

  useEffect(() => {
    setActiveProviders(
      Object.entries(providers)
        .filter(([_key, provider]) => provider.settings.enabled)
        .map(([_key, provider]) => provider.name),
    );
  }, [providers]);

  const handleCheckForUpdate = useCallback(async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/stackblitz-labs/bolt.diy/main/app/commit.json');
      const data: { commit: string } = await response.json();
      const latestCommitHash = data.commit;

      if (latestCommitHash !== versionHash) {
        setUpdateMessage('An update is available!');
      } else {
        setUpdateMessage('You are on the latest version.');
      }
    } catch (error) {
      console.error('Error fetching commit version:', error);
      setUpdateMessage('Failed to check for updates.');
    }
  }, []);

  const handleCopyToClipboard = useCallback(() => {
    const debugInfo = {
      OS: navigator.platform,
      Browser: navigator.userAgent,
      ActiveFeatures: activeProviders,
      BaseURLs: {
        Ollama: process.env.REACT_APP_OLLAMA_URL,
        OpenAI: process.env.REACT_APP_OPENAI_URL,
        LMStudio: process.env.REACT_APP_LM_STUDIO_URL,
      },
      Version: versionHash,
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2)).then(() => {
      alert('Debug information copied to clipboard!');
    });
  }, [providers]);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Debug Tab</h3>
      <div className="flex flex-col space-y-4">
        <button
          onClick={handleCheckForUpdate}
          className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text"
        >
          Check for Updates
        </button>
        {updateMessage && <p className="text-bolt-elements-textSecondary">{updateMessage}</p>}
        <button
          onClick={handleCopyToClipboard}
          className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text"
        >
          Copy to Clipboard
        </button>
      </div>
      <h4 className="text-md font-medium text-bolt-elements-textPrimary mt-4">System Information</h4>
      <p className="text-bolt-elements-textSecondary">OS: {navigator.platform}</p>
      <p className="text-bolt-elements-textSecondary">Browser: {navigator.userAgent}</p>
      <h4 className="text-md font-medium text-bolt-elements-textPrimary mt-4">Active Providers</h4>
      <ul>
        {activeProviders.map((name) => (
          <li key={name} className="text-bolt-elements-textSecondary">
            {name}
          </li>
        ))}
      </ul>
      <h4 className="text-md font-medium text-bolt-elements-textPrimary mt-4">Base URLs</h4>
      <ul>
        <li className="text-bolt-elements-textSecondary">Ollama: {process.env.REACT_APP_OLLAMA_URL}</li>
        <li className="text-bolt-elements-textSecondary">OpenAI: {process.env.REACT_APP_OPENAI_URL}</li>
        <li className="text-bolt-elements-textSecondary">LM Studio: {process.env.REACT_APP_LM_STUDIO_URL}</li>
      </ul>
      <h4 className="text-md font-medium text-bolt-elements-textPrimary mt-4">Version Information</h4>
      <p className="text-bolt-elements-textSecondary">Version Hash: {versionHash}</p>
    </div>
  );
}
