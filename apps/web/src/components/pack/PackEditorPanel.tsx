import { createPortablePackEditorDraft } from "@lunchtable/games-tabletop";

const packEditorFiles = ["game.json", "objects.json", "ruleset.json"] as const;

export interface PackEditorPanelModel {
  files: typeof packEditorFiles;
  issueCount: number;
  legalIntentCount: number;
  objectCount: number;
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

  return {
    files: packEditorFiles,
    issueCount: draft.validation.issues.length,
    legalIntentCount: draft.summary.legalIntentCount,
    objectCount: draft.summary.objectCount,
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
    </section>
  );
}
