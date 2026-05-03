import {
  createDefaultRendererAdapters,
  createRendererAdapterPlan,
  createRendererAdapterRegistry,
} from "@lunchtable/games-render";
import {
  createGeneratedGameAuthoringWorkflow,
  createPortablePackEditorDraft,
  evaluateGeneratedGameReadiness,
} from "@lunchtable/games-tabletop";

const packEditorFiles = ["game.json", "objects.json", "ruleset.json"] as const;

export interface PackEditorPanelModel {
  blockingGateCount: number;
  files: typeof packEditorFiles;
  gates: string[];
  issueCount: number;
  legalIntentCount: number;
  objectCount: number;
  primaryRenderer: string;
  publishStatus: "blocked" | "publishable";
  status: "invalid" | "valid";
  title: string;
}

export function createPackEditorPanelModel(): PackEditorPanelModel {
  const draft = createPortablePackEditorDraft({
    game: {
      description: "Agent-native generated dice duel.",
      extensionLevel: 1,
      genre: "dice-tabletop",
      id: "generated-dice-duel",
      name: "Generated Dice Duel",
      runtime: "lunchtable",
      runtimeVersion: "0.1.0",
      version: "0.1.0",
    },
    objects: {
      objects: [
        {
          id: "board:felt",
          kind: "board",
          name: "Felt Board",
          ownerSeat: null,
          state: "ready",
          visibility: "public",
          zoneId: "table",
        },
        {
          id: "die:attack",
          kind: "die",
          name: "Attack Die",
          ownerSeat: null,
          state: "ready",
          visibility: "public",
          zoneId: "table",
        },
      ],
      seats: [
        {
          actorType: "human",
          id: "seat-0",
          name: "Seat 0",
          permissions: ["submitIntent"],
          status: "ready",
        },
        {
          actorType: "ai",
          id: "seat-1",
          name: "Seat 1",
          permissions: ["submitIntent"],
          status: "ready",
        },
      ],
      zones: [
        {
          id: "table",
          kind: "board",
          name: "Shared Table",
          ordering: "unordered",
          ownerSeat: null,
          visibility: "public",
        },
      ],
    },
    ruleset: {
      legalIntents: [{ kind: "roll" }, { kind: "pass" }],
      phases: ["roll"],
      victory: { kind: "score-limit" },
    },
  });
  const workflow = createGeneratedGameAuthoringWorkflow({
    brief: {
      genre: "dice-tabletop",
      playerCount: 2,
      title: draft.game.name,
      viewMode: "isometric-2.5d",
      winCondition: "Reach the score limit.",
    },
    packId: draft.game.id,
  });
  const readiness = evaluateGeneratedGameReadiness({
    agentParity: "passed",
    docsContext: "passed",
    mcpConnectivity: "passed",
    packValidation: draft.validation.ok ? "passed" : "failed",
    rendererScene: "passed",
    simulation: "passed",
  });
  const rendererPlan = createRendererAdapterPlan(
    {
      camera: {
        mode: "isometric-2.5d",
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
      },
      cue: null,
      interactions: draft.objects.objects.map((object) => ({
        affordance: "inspect",
        objectId: object.id,
        seatId: object.ownerSeat,
      })),
      objects: draft.objects.objects.map((object, index) => ({
        id: object.id,
        interactive: true,
        label: object.name,
        position: { x: index * 140, y: 0, z: 0 },
        size: { height: 96, width: 72 },
      })),
      viewport: { height: 720, width: 1280 },
    },
    createRendererAdapterRegistry(createDefaultRendererAdapters()),
  );

  return {
    blockingGateCount: readiness.blockingGateIds.length,
    files: packEditorFiles,
    gates: workflow.gates.map((gate) => gate.id),
    issueCount: draft.validation.issues.length,
    legalIntentCount: draft.summary.legalIntentCount,
    objectCount: draft.summary.objectCount,
    primaryRenderer: rendererPlan.primaryAdapter.id,
    publishStatus: readiness.status,
    status: draft.validation.ok ? "valid" : "invalid",
    title: draft.game.name,
  };
}

export function PackEditorPanel() {
  const model = createPackEditorPanelModel();

  return (
    <section className="pack-editor-panel" aria-labelledby="pack-editor-title">
      <div className="pack-editor-header">
        <div>
          <p className="eyebrow">Generated Pack Editor</p>
          <h2 id="pack-editor-title">{model.title}</h2>
        </div>
        <span
          className={`pack-editor-status pack-editor-status-${model.status}`}
        >
          {model.status}
        </span>
      </div>
      <div className="pack-editor-grid">
        <div>
          <span className="metric-label">Objects</span>
          <strong>{model.objectCount}</strong>
        </div>
        <div>
          <span className="metric-label">Legal actions</span>
          <strong>{model.legalIntentCount}</strong>
        </div>
        <div>
          <span className="metric-label">Issues</span>
          <strong>{model.issueCount}</strong>
        </div>
      </div>
      <div className="pack-editor-files">
        {model.files.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>
      <div className="pack-editor-gates">
        {model.gates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
    </section>
  );
}
