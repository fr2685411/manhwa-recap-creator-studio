import React, { useState, useEffect } from 'react';
import { ProjectSettings, Panel } from './types/manhwa';
import { SAMPLE_PROJECTS } from './data/sampleChapters';
import { Header } from './components/Header';
import { PlayerPreview } from './components/PlayerPreview';
import { Timeline } from './components/Timeline';
import { PanelInspector, InspectorTabType } from './components/PanelInspector';
import { ExportModal } from './components/ExportModal';
import { ScriptGeneratorModal } from './components/ScriptGeneratorModal';
import { UploadModal } from './components/UploadModal';
import { HelpModal } from './components/HelpModal';
import { AutoRecapWizardModal } from './components/AutoRecapWizardModal';
import { LocalModelManagerModal } from './components/LocalModelManagerModal';
import { BatchAdjustmentModal } from './components/BatchAdjustmentModal';
import { localAiEngine, AiEngineType } from './services/localAiEngine';
import { requestTtsAudio } from './services/geminiClient';

export default function App() {
  const [project, setProject] = useState<ProjectSettings>(() => {
    return JSON.parse(JSON.stringify(SAMPLE_PROJECTS['janitor-hunter']));
  });

  const [activeEngine, setActiveEngine] = useState<AiEngineType>(() => localAiEngine.getActiveEngine());
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedPanelIndex, setSelectedPanelIndex] = useState(0);
  const [selectedPanelIndices, setSelectedPanelIndices] = useState<number[]>([0]);
  const [inspectorTab, setInspectorTab] = useState<InspectorTabType>('full-script');

  // Modals state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchInitialIndices, setBatchInitialIndices] = useState<number[]>([0]);
  const [isLocalModelOpen, setIsLocalModelOpen] = useState(false);
  const [isAutoRecapOpen, setIsAutoRecapOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Handle panel updates
  const handleUpdatePanel = (updated: Panel) => {
    setProject((prev) => {
      const copy = [...prev.panels];
      copy[selectedPanelIndex] = updated;
      return { ...prev, panels: copy };
    });
  };

  // Handle new panels from upload or slicer
  const handleAddPanels = (newPanels: Panel[]) => {
    setProject((prev) => ({
      ...prev,
      panels: [...prev.panels, ...newPanels],
    }));
    setSelectedPanelIndex(project.panels.length);
  };

  // Handle applied AI generated script
  const handleApplyScript = (newPanels: Panel[], title: string) => {
    setProject((prev) => ({
      ...prev,
      title: title || prev.title,
      panels: newPanels,
    }));
    setCurrentTime(0);
    setSelectedPanelIndex(0);
  };

  const selectedPanel = project.panels[selectedPanelIndex] || project.panels[0];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#09090e] text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-hidden">
      {/* Top Header */}
      <Header
        project={project}
        activeEngine={activeEngine}
        onUpdateProject={setProject}
        onOpenLocalModelModal={() => setIsLocalModelOpen(true)}
        onOpenAutoRecapModal={() => setIsAutoRecapOpen(true)}
        onOpenScriptModal={() => setIsScriptOpen(true)}
        onOpenExportModal={() => setIsExportOpen(true)}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onOpenBatchModal={() => {
          setBatchInitialIndices(selectedPanelIndices.length > 0 ? selectedPanelIndices : [selectedPanelIndex]);
          setIsBatchModalOpen(true);
        }}
        onOpenHelpModal={() => setIsHelpOpen(true)}
        onOpenFullScript={() => setInspectorTab('full-script')}
      />

      {/* Main Workspace (Preview Canvas + Panel Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        <PlayerPreview
          project={project}
          currentTime={currentTime}
          onTimeUpdate={setCurrentTime}
          selectedPanelIndex={selectedPanelIndex}
          onSelectPanel={setSelectedPanelIndex}
          onUpdateProject={setProject}
        />

        <PanelInspector
          panel={selectedPanel}
          panelIndex={selectedPanelIndex}
          project={project}
          onUpdatePanel={handleUpdatePanel}
          onUpdateProject={setProject}
          onSelectPanel={setSelectedPanelIndex}
          onSeek={setCurrentTime}
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
        />
      </div>

      {/* Bottom Multi-Track Timeline */}
      <Timeline
        project={project}
        currentTime={currentTime}
        onSeek={setCurrentTime}
        selectedPanelIndex={selectedPanelIndex}
        onSelectPanel={(index) => {
          setSelectedPanelIndex(index);
          setSelectedPanelIndices([index]);
        }}
        selectedPanelIndices={selectedPanelIndices}
        onSelectPanelIndices={setSelectedPanelIndices}
        onUpdateProject={setProject}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onOpenBatchModal={(indices) => {
          setBatchInitialIndices(indices && indices.length > 0 ? indices : selectedPanelIndices);
          setIsBatchModalOpen(true);
        }}
      />

      {/* Modals */}
      <LocalModelManagerModal
        isOpen={isLocalModelOpen}
        onClose={() => setIsLocalModelOpen(false)}
        onEngineChanged={(engine) => setActiveEngine(engine)}
      />

      <AutoRecapWizardModal
        isOpen={isAutoRecapOpen}
        onClose={() => setIsAutoRecapOpen(false)}
        voicePersona={project.voicePersona}
        onApplyProject={(newPanels, title, bgmTrack) => {
          setProject((prev) => ({
            ...prev,
            title: title || prev.title,
            bgmTrack: bgmTrack || prev.bgmTrack,
            panels: newPanels,
          }));
          setCurrentTime(0);
          setSelectedPanelIndex(0);
        }}
      />

      <ExportModal
        project={project}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onUpdateProject={setProject}
      />

      <ScriptGeneratorModal
        project={project}
        isOpen={isScriptOpen}
        onClose={() => setIsScriptOpen(false)}
        onApplyGeneratedScript={handleApplyScript}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onAddPanels={handleAddPanels}
      />

      <BatchAdjustmentModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        project={project}
        initialSelectedIndices={batchInitialIndices}
        onApplyBatch={(updatedPanels) => {
          setProject((prev) => ({
            ...prev,
            panels: updatedPanels,
          }));
        }}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
