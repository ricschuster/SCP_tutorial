import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

test('App renders the title', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });

  expect(container.textContent).toContain('SCP Tutorial');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
