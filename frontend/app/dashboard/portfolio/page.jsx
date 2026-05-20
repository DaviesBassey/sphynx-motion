'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function FinTechSecureDashboard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [fileData, setFileData] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [report, setReport] = useState('');
  const [executing, setExecuting] = useState(false);

  const processFileSelection = (e) => {
    const asset = e.target.files?.[0];
    if (!asset) return;

    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      setFileData(fileReader.result);
    };
    fileReader.readAsDataURL(asset);
  };

  const dispatchSecurePayload = async (e) => {
    e.preventDefault();
    if (!isLoaded || !isSignedIn || !fileData) return;

    setExecuting(true);
    setReport('');

    try {
      const activeSessionToken = await getToken();

      // Transmit strictly to the internal API Proxy Gateway
      const interactionResult = await fetch('/api/proxy/portfolio-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSessionToken}`
        },
        body: JSON.stringify({
          images: [fileData],
          user_notes: contextNotes
        })
      });

      const structuredPayload = await interactionResult.json();

      if (!interactionResult.ok) {
        setReport(`Execution Boundary Conflict: ${structuredPayload.error || 'Unknown parameter exception.'}`);
      } else {
        setReport(structuredPayload.assessment_report);
      }
    } catch (networkException) {
      setReport('Critical pipeline interface connectivity failure encountered.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <header className="mb-6">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-500 bg-emerald-950/50 border border-emerald-900/50 px-2.5 py-1 rounded-full">Secure Data Enclave</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-50 mt-3">Portfolio Assessment Control</h1>
          <p className="text-sm text-zinc-400 mt-1">Submit high-resolution statement files into our isolated AI scanning framework.</p>
        </header>

        <form onSubmit={dispatchSecurePayload} className="space-y-6">
          <div>
            <label className="block text-xs font-bold tracking-wider text-zinc-400 uppercase mb-2">Statement Snapshot (Image File)</label>
            <input
              type="file"
              accept="image/*"
              onChange={processFileSelection}
              className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 transition-colors cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wider text-zinc-400 uppercase mb-2">Contextual Directives</label>
            <textarea
              value={contextNotes}
              onChange={(e) => setContextNotes(e.target.value)}
              placeholder="Specify structural benchmarks or audit bounds..."
              className="w-full h-28 bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-zinc-700 resize-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={executing || !fileData}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-950/20 active:scale-[0.99]"
          >
            {executing ? 'Executing Isolation Ingestion Routines...' : 'Initialize Secure Multimodal Evaluation'}
          </button>
        </form>

        {report && (
          <section className="mt-8 bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-inner">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Evaluation Response</h2>
            <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{report}</div>
          </section>
        )}
      </div>
    </div>
  );
}
