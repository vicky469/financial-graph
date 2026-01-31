import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JobConfigurationUI from './JobConfigApp';
import { ExecutionDetailsPage } from './pages/ExecutionDetailsPage';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<JobConfigurationUI />} />
          <Route path="/executions/:executionId" element={<ExecutionDetailsPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
} else {
  console.error('Root container not found');
}